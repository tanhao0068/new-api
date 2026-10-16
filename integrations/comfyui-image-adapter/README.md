# ComfyUI 图像适配器（OpenAI 兼容）

**作者：CTO Agent** ｜ 版本 v1.0 ｜ 2026-10-16

把**自建 ComfyUI**（Qwen-Image 文生图等）暴露为 **OpenAI 兼容图像 API**，
使 `mibi-api` 能以「OpenAI 渠道」接入，复用平台既有的**鉴权、计费、日志、限流**链路。

> **本目录不属于上游 new-api**（`mibi-devel` 上的集成件，未修改任何上游文件）。
> 台账登记见 `mibi-workspace/docs/tech/upstream-fork-ledger.md`。

## 1. 架构

```
客户端 ── sk-xxx ──▶ mibi-api (3002)
                      │  POST /v1/images/generations   （OpenAI 渠道，type=1）
                      ▼
              comfyui-image-adapter (127.0.0.1:19010)   本目录 adapter.py
                      │  ① POST /prompt   提交工作流
                      │  ② GET  /history/<id> 轮询到终态
                      │  ③ GET  /view     拉取图片并本地缓存
                      ▼
              ComfyUI @ 192.168.0.43:8188 (RTX 4090 D)
```

适配器内部把「异步的 ComfyUI 任务」包装成「OpenAI Images 的同步语义」：
请求内提交 + 轮询 + 取图，再按 OpenAI 格式返回（`url` 或 `b64_json`）。

## 2. 远端被接入的资源（侦察结论）

| 项 | 值 |
|---|---|
| 主机 | `192.168.0.43`（`zxhx-Eagle-Stream`，Ubuntu 24.04） |
| GPU | 3 × RTX 4090 D（48GB each） |
| ComfyUI 实例 | `8188`（cuda:0）/ `8189`（cuda:1）/ `8190`（cuda:2），版本 0.39.0 |
| 文生图模型 | **Qwen-Image**：`models/diffusion_models/qwen_image_fp8_e4m3fn.safetensors` + `text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors`（type `qwen_image`）+ `vae/qwen_image_vae.safetensors` |
| 其他可用资产 | Wan2.2 文生视频（high/low noise 14B）、MiniMax H3 音视频（未接入，见 §7） |
| 上游参考实现 | `/data2/genai/chat-app/comfy_client.py`（Gradio 聊天应用的工作流与轮询口径，本适配器与其保持一致） |

## 3. 部署

```bash
# 依赖：仅 Python 标准库（无需 pip 安装）
python3 adapter.py --listen 0.0.0.0 --port 19010 \
  --public-base-url http://192.168.0.42:19010 \
  --cache-dir /home/test/data/comfyui-image-cache \
  --timeout 600 --max-concurrency 2
```

systemd 用户服务：`~/.config/systemd/user/comfyui-image-adapter.service`
（`systemctl --user {start|status|restart} comfyui-image-adapter`，日志写入缓存目录 `adapter.log`）

| 参数 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `--listen` | `ADAPTER_LISTEN` | `0.0.0.0` | 监听地址 |
| `--port` | `ADAPTER_PORT` | `19010` | 监听端口 |
| `--public-base-url` | `ADAPTER_PUBLIC_BASE_URL` | `http://<listen>:<port>` | **返回给客户端的图片 URL 前缀**（须客户端可达） |
| `--cache-dir` | `ADAPTER_CACHE_DIR` | — | 生成图本地缓存目录 |
| `--timeout` | `ADAPTER_TIMEOUT` | `600` | 单次生成超时（秒） |
| `--max-concurrency` | `ADAPTER_MAX_CONCURRENCY` | `2` | 同时提交给 ComfyUI 的任务上限（防显存打爆） |

## 4. 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查（含 ComfyUI 可达性、设备、空闲显存、版本） |
| GET | `/v1/models` | 支持的模型清单 |
| POST | `/v1/images/generations` | **OpenAI 兼容文生图** |
| GET | `/v1/images/{name}` | 取生成图（本地缓存） |

### 请求字段（`POST /v1/images/generations`）

| 字段 | 必填 | 说明 |
|---|---|---|
| `model` | 否 | 默认 `mibi/qwen-image`；兼容别名 `qwen-image` / `qwen_image` / `qwen-image-fp8*` |
| `prompt` | **是** | 提示词 |
| `size` | 否 | `WxH`，默认 `1328x1328`；范围 256–2048 且 8 的倍数 |
| `n` | 否 | 1–4，默认 1（逐个提交，受 `max-concurrency` 约束） |
| `seed` | 否 | 缺省随机；**给定则结果可复现** |
| `steps` | 否 | 采样步数，默认 8，上限 30 |
| `negative_prompt` | 否 | 负向提示词（默认内置一套中文负向词） |
| `response_format` | 否 | `url`（默认）或 `b64_json` |

### 响应示例

```json
{
  "created": 1792120404,
  "data": [{ "index": 0, "url": "http://192.168.0.42:19010/v1/images/img_xxx.png",
             "seed": 424242, "elapsed_s": 6.0, "bytes": 1202770 }],
  "model": "qwen-image", "size": "1024x1024", "elapsed_s": 6.02
}
```

错误：`400`（参数非法，含 `param` 字段指明出错参数）、`502`（上游失败）、`504`（生成超时，ComfyUI 仍在继续）。

## 5. mibi-api 侧接入（已落地，零代码改动）

```sql
-- 渠道（type=1 OpenAI 兼容，指向本机适配器）
INSERT INTO channels (name, type, key, base_url, models, "group", status, auto_ban, priority, setting)
VALUES ('自建 ComfyUI · Qwen-Image（192.168.0.43）', 1, 'sk-self-hosted-comfyui',
        'http://127.0.0.1:19010', 'mibi/qwen-image', 'default', 1, 0, 10,
        '{"pass_through_body_enabled": true}');

-- 路由能力
INSERT INTO abilities ("group", model, channel_id, enabled, priority) VALUES ('default','mibi/qwen-image', <id>, 1, 10);

-- 计费：按次定价（quota = ModelPrice × QuotaPerUnit × GroupRatio）
-- options: ModelPrice = {"mibi/qwen-image": 0.02}  → 10000 quota/张
```

### ⚠️ 两个必须注意的点

1. **模型 id 不能叫 `qwen-image`**：该 id 已被内置 `alibaba` 任务插件认领
   （`plugins/tasks/alibaba/plugin.js` 的模型表映射到阿里云 DashScope Qwen-Image API），
   普通渠道**无法**承载被插件认领的模型（会返回
   `the model is claimed by a task plugin, which has no enabled channel serving it`）。
   → 本项目使用**命名空间化 id `mibi/qwen-image`**。
2. **必须开启渠道的「请求体透传」`pass_through_body_enabled`**：
   new-api 的 OpenAI 图像 DTO 不含 `seed`/`steps` 字段，不开启透传时这两个参数会被丢弃
   （实测：请求 `seed=424242` → 未透传时上游收到随机 seed；开启后原样生效）。

## 6. 实测基线（2026-10-16）

| 项 | 结果 |
|---|---|
| 直连 ComfyUI（绕过平台） | 12.0s / 1328×1328 |
| 经 mibi-api | HTTP 200，12.1s（8 步）；6.1s（6 步，1024×1024） |
| 计费 | `logs` 记录 `channel_id=2`、`quota=10000`（0.02 × 500000） |
| 并发 2 路 | 均 200（9.1s / 6.1s） |
| 参数透传 | `size` ✅、`seed` ✅（透传后）、`steps` ✅ |
| 错误处理 | 尺寸越界 / 缺 prompt / n 越界 → 均 400 且带明确 `param` |

## 7. 已知限制与后续

| # | 限制 | 建议 |
|---|---|---|
| 1 | **产物只在适配器本地缓存**，未接对象存储 | 接入 MinIO/S3 + CDN，并设保留期（当前缓存目录需磁盘配额） |
| 2 | **无鉴权**（依赖仅本机/内网可达） | 若对外暴露，加 `Authorization` 校验并与 mibi-api 渠道 key 对齐 |
| 3 | 单实例并发上限 2（显存约束） | 需要更高并发时按 ComfyUI 实例数（8189/8190）横向扩展 + 队列 |
| 4 | 视频（Wan2.2 / MiniMax H3）未接入 | 按 `openai_video` 协议另建适配或 mibi-api 任务插件 |
| 5 | 图像尺寸受单模型约束（Qwen-Image 最优 1328 系） | 多模型路由时按模型容量校验尺寸 |
