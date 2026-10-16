/**
 * Mibi 自建 ComfyUI · Wan2.2 文生视频插件
 *
 * 作者：CTO Agent
 *
 * 把远端自建 ComfyUI（192.168.0.43:8189，Wan2.2 T2V 14B）接入平台的统一任务后端：
 *   - 平台侧：POST /v1/videos 提交 → GET /v1/videos/:task_id 查询 → .../content 取视频
 *   - 本插件：直接驱动 ComfyUI 原生 API（提交 /prompt、轮询 /history/<id>、取件 /view）
 *
 * 不声明 `channelTypes`：OpenAI 自定义类型（1）已被内置 sora 插件占用
 * （契约规定同一 channelType 不得出现在两个插件上），故本插件走
 * **type-61「任务插件」渠道**（由渠道的 `task_plugin_key` 绑定）。
 *
 * ⚠️ ComfyUI 是内网服务，`allowedHosts` 必须显式声明，否则出站请求被拒。
 */

const FPS = 16;
const NEG_VIDEO =
  '色调艳丽,过曝,静态,细节模糊不清,字幕,最差质量,低质量,JPEG压缩残留,丑陋的,畸形的,静止不动的画面,杂乱的背景,NSFW';

// 默认与远端 chat-app/comfy_client.py::wan_video() 保持一致（已在 8189 验证可用）
const DEFAULT_SIZE = { width: 640, height: 640 };
const DEFAULT_LENGTH = 33; // 33 帧 @16fps ≈ 2.06s
const DEFAULT_STEPS = 30;
const MAX_STEPS = 50;
const MIN_LENGTH = 9;
const MAX_LENGTH = 121;

const SIZE_PRESETS = {
  '640x640': { width: 640, height: 640 },
  '832x480': { width: 832, height: 480 },
  '480x832': { width: 480, height: 832 },
  '1280x720': { width: 1280, height: 720 },
  '720x1280': { width: 720, height: 1280 },
};

export const meta = {
  apiVersion: 1,
  key: 'mibicomfy',
  name: 'Mibi 自建 ComfyUI（Wan2.2）',
  icon: 'text:Wan',
  description: {
    en: 'Text-to-video on a self-hosted ComfyUI (Wan2.2 T2V 14B, MoE high/low noise two-stage sampling)',
    zh: '自建 ComfyUI 文生视频（Wan2.2 T2V 14B，高/低噪声双阶段采样）',
  },
  version: '1.0.0',
  author: { name: 'Mibiia CTO' },
  // type-61「任务插件」渠道的默认上游地址（可被渠道配置覆盖）
  baseUrl: 'http://192.168.0.43:8189',
  allowedHosts: ['192.168.0.43:8189'],
  models: ['mibi/wan2.2-t2v'],
  fetchMode: 'per_task',
  usageSchema: {
    // 计费事实：时长（秒）。单价由计费表达式按秒配置。
    seconds: {
      type: 'number',
      unit: 'second',
      description: { en: 'Video generation unit price', zh: '视频生成单价（按秒）' },
    },
    // 计费事实：输出分辨率。
    size: {
      enum: Object.keys(SIZE_PRESETS),
      enumLabels: {
        '640x640': { en: '640x640 (square)', zh: '640x640（方形）' },
        '832x480': { en: '832x480 (landscape)', zh: '832x480（横屏）' },
        '480x832': { en: '480x832 (portrait)', zh: '480x832（竖屏）' },
        '1280x720': { en: '1280x720 (HD landscape)', zh: '1280x720（高清横屏）' },
        '720x1280': { en: '720x1280 (HD portrait)', zh: '720x1280（高清竖屏）' },
      },
      description: { en: 'Output video dimensions', zh: '输出视频尺寸' },
    },
  },
  protocols: ['openai_video'],
};

/* ────────────────────────────── 工具函数 ────────────────────────────── */

function trimmed(value) {
  return String(value == null ? '' : value).trim();
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}

/** 解析请求参数 → ComfyUI 工作流参数 */
function resolveParams(req) {
  const raw = req || {};
  const sizeKey = trimmed(raw.size) || '640x640';
  const preset = SIZE_PRESETS[sizeKey] || DEFAULT_SIZE;

  // 时长：客户端给 seconds 优先；否则用 length（帧）；再否则用默认
  let length = DEFAULT_LENGTH;
  const seconds = Number(raw.seconds != null ? raw.seconds : raw.duration);
  if (Number.isFinite(seconds) && seconds > 0) {
    length = seconds * FPS;
  } else if (raw.length != null && Number.isFinite(Number(raw.length))) {
    length = Number(raw.length);
  }
  // Wan 要求帧数为 4n+1，取最接近的合法值
  length = Math.round(clamp(length, MIN_LENGTH, MAX_LENGTH) / 4) * 4 + 1;
  length = clamp(length, MIN_LENGTH, MAX_LENGTH);

  const steps = raw.steps != null ? clamp(raw.steps, 1, MAX_STEPS) : DEFAULT_STEPS;
  const seed =
    raw.seed != null && Number.isFinite(Number(raw.seed))
      ? Math.abs(Math.trunc(Number(raw.seed))) % 2147483647
      : Math.floor(Math.random() * 2147483646) + 1;
  const negative = trimmed(raw.negative_prompt) || NEG_VIDEO;
  const prompt = trimmed(raw.prompt);

  return {
    prompt,
    negative,
    seed,
    steps,
    width: preset.width,
    height: preset.height,
    sizeKey: SIZE_PRESETS[sizeKey] ? sizeKey : '640x640',
    length,
  };
}

/** Wan2.2 文生视频工作流（与远端 comfy_client.py::wan_video() 逐节点一致） */
function buildWorkflow(p) {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors', weight_dtype: 'default' },
    },
    2: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors', weight_dtype: 'default' },
    },
    3: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan', device: 'default' },
    },
    4: { class_type: 'VAELoader', inputs: { vae_name: 'wan_2.1_vae.safetensors' } },
    5: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: p.prompt } },
    6: { class_type: 'CLIPTextEncode', inputs: { clip: ['3', 0], text: p.negative } },
    7: {
      class_type: 'EmptyHunyuanLatentVideo',
      inputs: { width: p.width, height: p.height, length: p.length, batch_size: 1 },
    },
    8: { class_type: 'ModelSamplingSD3', inputs: { model: ['1', 0], shift: 5.0 } },
    9: { class_type: 'ModelSamplingSD3', inputs: { model: ['2', 0], shift: 5.0 } },
    10: {
      class_type: 'KSamplerAdvanced',
      inputs: {
        model: ['8', 0],
        positive: ['5', 0],
        negative: ['6', 0],
        latent_image: ['7', 0],
        add_noise: 'enable',
        noise_seed: p.seed,
        control_after_generate: 'randomize',
        steps: p.steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        start_at_step: 0,
        end_at_step: Math.floor(p.steps / 3),
        return_with_leftover_noise: 'enable',
      },
    },
    11: {
      class_type: 'KSamplerAdvanced',
      inputs: {
        model: ['9', 0],
        positive: ['5', 0],
        negative: ['6', 0],
        latent_image: ['10', 0],
        add_noise: 'disable',
        noise_seed: p.seed,
        control_after_generate: 'fixed',
        steps: p.steps,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        start_at_step: Math.floor(p.steps / 3),
        end_at_step: p.steps,
        return_with_leftover_noise: 'disable',
      },
    },
    12: { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['4', 0] } },
    13: {
      class_type: 'SaveWEBM',
      inputs: { images: ['12', 0], filename_prefix: 'mibi_t2v', codec: 'vp9', fps: FPS, crf: 32 },
    },
  };
}

/** 从 ComfyUI outputs 中找出视频文件（SaveWEBM 落在 images 数组里，filename 为 .webm） */
function findVideoFile(outputs) {
  const groups = outputs || {};
  for (const nodeId of Object.keys(groups)) {
    const out = groups[nodeId] || {};
    for (const key of ['images', 'gifs', 'videos']) {
      const list = out[key];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const name = trimmed(item && item.filename).toLowerCase();
        if (name.endsWith('.webm') || name.endsWith('.mp4') || name.endsWith('.gif')) return item;
      }
    }
  }
  return null;
}

function viewUrl(baseUrl, item) {
  const query =
    'filename=' +
    encodeURIComponent(item.filename || '') +
    '&subfolder=' +
    encodeURIComponent(item.subfolder || '') +
    '&type=' +
    encodeURIComponent(item.type || 'output');
  return baseUrl + '/view?' + query;
}

/* ────────────────────────────── 驱动 hooks ────────────────────────────── */

export function buildSubmitRequest(ctx) {
  const p = resolveParams(ctx.requestBody || {});
  if (!p.prompt) throw new Error('field prompt is required');
  return {
    url: ctx.baseUrl + '/prompt',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { prompt: buildWorkflow(p) },
    action: 'text_to_video',
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = (resp && resp.body) || {};
  const nodeErrors = body.node_errors;
  if (nodeErrors && typeof nodeErrors === 'object' && Object.keys(nodeErrors).length) {
    throw new Error('ComfyUI rejected the workflow: ' + JSON.stringify(nodeErrors).slice(0, 400));
  }
  const taskId = trimmed(body.prompt_id);
  if (!taskId) throw new Error('ComfyUI did not return prompt_id');

  // 参数写入 state：跨轮询保留（Task.Data 会被每次成功解析覆盖）
  const p = resolveParams(ctx.requestBody || {});
  return {
    taskId,
    taskData: { prompt_id: taskId, object: 'video', status: 'queued', size: p.sizeKey, seconds: Math.round(p.length / FPS) },
    state: { seed: p.seed, steps: p.steps, width: p.width, height: p.height, length: p.length, size: p.sizeKey },
  };
}

export function extractUsage(ctx) {
  const p = resolveParams(ctx.requestBody || {});
  return { seconds: Math.round(p.length / FPS), size: p.sizeKey };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const facts = {};
  const source = (body && typeof body === 'object' ? body : null) || (task && task.data) || {};
  const seconds = Number(source.seconds);
  if (Number.isFinite(seconds) && seconds > 0) facts.seconds = seconds;
  const size = trimmed(source.size);
  if (SIZE_PRESETS[size]) facts.size = size;
  return facts;
}

export function buildQueryRequest(ctx) {
  return {
    url: ctx.baseUrl + '/history/' + encodeURIComponent(ctx.taskId),
    method: 'GET',
  };
}

export function parseTaskResult(ctx, body) {
  const history = body && typeof body === 'object' ? body : {};
  const entry = history[ctx.taskId];

  // ComfyUI 的 /history 只保留已结束（成功/失败）的任务；查不到即仍在排队或推理中。
  // 这是**可识别**的状态，返回 IN_PROGRESS 而非 UNKNOWN（UNKNOWN 会被计为轮询失败）。
  if (!entry) {
    return { status: 'IN_PROGRESS' };
  }

  const statusStr = (entry.status && entry.status.status_str) || '';
  if (statusStr === 'error') {
    const messages = (entry.status && entry.status.messages) || [];
    return {
      status: 'FAILURE',
      reason: ('ComfyUI execution failed: ' + JSON.stringify(messages)).slice(0, 500),
    };
  }
  if (statusStr !== 'success') {
    return { status: 'IN_PROGRESS', progress: '50%' };
  }

  const file = findVideoFile(entry.outputs);
  if (!file) {
    return { status: 'FAILURE', reason: 'ComfyUI finished but produced no video artifact' };
  }
  // 注意：本 hook 的返回值只映射 Status/Progress/Reason/PluginState ——
  // 产物 URL 必须由 buildContentRequest 从 Task.Data（上游原始响应）现场构造。
  return { status: 'SUCCESS', progress: '100%' };
}

export function listArtifacts(task) {
  return task && task.status === 'SUCCESS' ? [{ key: 'video', type: 'video' }] : [];
}

/**
 * 产物下载：`Task.Data` 是 ComfyUI `/history/<id>` 的原始响应（形如 { <promptId>: {status, outputs} }），
 * 官方插件同样在本 hook 里自行定位产物（描述符不带 URL）。这里从原始响应取出 webm 文件名，
 * 拼成 ComfyUI 的 /view 下载地址，由宿主代理回客户端。
 */
export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== 'video') throw new Error('artifact_not_found');
  const history = (ctx && ctx.data) || {};
  const candidates = [ctx.taskId, ctx.upstreamTaskId].filter(function (id) {
    return trimmed(id);
  });
  let entry = null;
  for (const id of candidates) {
    if (history[id]) {
      entry = history[id];
      break;
    }
  }
  if (!entry) {
    // 兜底：扫描响应中的任意条目（仅当唯一时可信）
    const values = Object.keys(history).map(function (k) {
      return history[k];
    });
    if (values.length === 1) entry = values[0];
  }
  const file = findVideoFile(entry && entry.outputs);
  if (!file) throw new Error('artifact_not_found');
  return { url: viewUrl(ctx.baseUrl, file), method: ctx.clientRequest.method };
}

/* ────────────────────────────── 协议 ────────────────────────────── */

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== 'json' && ctx.body.kind !== 'multipart')) {
        throw new Error('JSON or multipart body required');
      }
      if (ctx.body.kind === 'multipart') throw new Error('multipart is not supported by this model');
      if (!ctx.body.value || Array.isArray(ctx.body.value)) throw new Error('JSON object required');
      const req = ctx.body.value;
      if (!trimmed(req.prompt)) throw new Error('field prompt is required');
      const size = trimmed(req.size);
      if (size && !SIZE_PRESETS[size]) {
        throw new Error('size must be one of: ' + Object.keys(SIZE_PRESETS).join(', '));
      }
      const seconds = Number(req.seconds != null ? req.seconds : req.duration);
      if (req.seconds != null || req.duration != null) {
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 8) {
          throw new Error('seconds must be between 0 and 8');
        }
      }
      return {
        kind: 'submit',
        model: ctx.model,
        action: 'text_to_video',
        requestBody: Object.assign({}, req, { model: ctx.model }),
      };
    },
    render: function (ctx, task) {
      const statuses = {
        NOT_START: 'queued',
        SUBMITTED: 'queued',
        QUEUED: 'queued',
        IN_PROGRESS: 'in_progress',
        SUCCESS: 'completed',
        FAILURE: 'failed',
      };
      const data = (task && task.data) || {};
      const output = {
        id: task.task_id,
        object: 'video',
        model: ((task.properties || {}).origin_model_name) || '',
        status: statuses[task.status] || 'unknown',
        progress: Number(String(task.progress || '0').replace('%', '')) || 0,
        created_at: Number(task.created_at || 0),
        prompt_id: data.prompt_id,
        size: data.size || undefined,
        seconds: data.seconds || undefined,
        seed: data.seed != null ? data.seed : undefined,
        fps: FPS,
      };
      const completedAt = Number(task.finished_at || task.updated_at || 0);
      if (completedAt > 0) output.completed_at = completedAt;
      // 产物 URL 取宿主注入的 ctx.artifacts[key].url（客户端据此经网关下载）
      const injected = (ctx && ctx.artifacts) || {};
      const artifacts = [];
      for (const key of Object.keys(injected)) {
        const item = injected[key] || {};
        if (!trimmed(item.url)) continue;
        artifacts.push({ key: key, type: item.type || 'video', url: item.url, content_type: item.mimeType || 'video/webm' });
      }
      if (artifacts.length) output.artifacts = artifacts;
      if (task.status === 'FAILURE') {
        output.error = {
          code: 'video_generation_failed',
          message: task.fail_reason || 'The video generation task failed.',
        };
      }
      return output;
    },
  },
};
