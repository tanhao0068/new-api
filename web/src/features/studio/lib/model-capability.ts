/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { ModelOption } from '@/features/playground/types'

/** 体验中心的四种模式 */
export type StudioModelMode = 'chat' | 'image' | 'video' | 'voice'

/** 模型能力（一个模型可同时具备多种，例如多模态文本模型） */
export type StudioModelCapability = 'text' | 'image' | 'video' | 'voice'

/** 模式 → 所需能力 */
const MODE_CAPABILITY: Record<StudioModelMode, StudioModelCapability> = {
  chat: 'text',
  image: 'image',
  video: 'video',
  voice: 'voice',
}

/**
 * 显式声明的模型能力（**最高优先级**）。
 *
 * 为什么需要声明而不是完全依赖平台的 endpoint type：
 * 平台的能力派生见 `common.GetEndpointTypesByChannelType`，只有**图像**有独立端点类型
 * （模型名命中 `IsImageGenerationModel` 时追加 `image-generation`）；
 * **语音合成没有端点类型**，**自建视频走任务插件渠道（type=61）也只标 `openai`**，
 * 二者在端点类型上与普通文本模型无法区分。
 * 因此此处对自建模型做显式声明；接入新模型时在此登记即可。
 */
export const DECLARED_MODEL_CAPABILITIES: Record<
  string,
  StudioModelCapability[]
> = {
  'mibi/qwen-image': ['image'],
  'mibi/wan2.2-t2v': ['video'],
  'mibi/edge-tts': ['voice'],
}

/** 平台 endpoint type → 能力（用于未声明的模型） */
/** 文本类端点类型 */
const TEXT_ENDPOINT_TYPES = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'openai-alpha-search',
  'anthropic',
  'gemini',
])

/** 不属于体验中心任何模式的端点类型（向量 / 重排） */
const NON_STUDIO_ENDPOINT_TYPES = new Set(['embeddings', 'jina-rerank'])

function capabilitiesFromEndpointTypes(
  endpointTypes: string[]
): StudioModelCapability[] {
  const caps = new Set<StudioModelCapability>()
  let hasUnknownType = false
  for (const type of endpointTypes) {
    if (type === 'image-generation') caps.add('image')
    else if (type === 'openai-video') caps.add('video')
    else if (TEXT_ENDPOINT_TYPES.has(type)) caps.add('text')
    else if (!NON_STUDIO_ENDPOINT_TYPES.has(type)) hasUnknownType = true
  }
  // 未识别的端点类型按文本处理，避免平台新增类型后模型从所有列表中消失
  if (hasUnknownType) caps.add('text')
  return [...caps]
}

/** 名称关键字兜底规则（平台端点类型无法区分时使用） */
const NAME_RULES: Array<[RegExp, StudioModelCapability]> = [
  [/(^|[-/_.])(tts|speech|audio|voice|cosyvoice|fish-speech|f5-tts)([-/_.]|$)/i, 'voice'],
  [/(^|[-/_.])(video|t2v|i2v|sora|veo|kling|hailuo|wan2|runway|cogvideo)([-/_.]|$)/i, 'video'],
  [/(^|[-/_.])(image|dall-e|dalle|flux|stable-diffusion|sd3|midjourney|imagen|kolors)([-/_.]|$)/i, 'image'],
]

/**
 * 解析单个模型的能力集合。
 *
 * 优先级：管理后台登记表（overrides）> 前端显式声明 > endpoint type > 名称规则；名称规则命中的"非文本"能力
 * 会把模型从文本列表中排除（例如 `xxx-image` 不应出现在文本对话里）。
 */
export function resolveModelCapabilities(
  modelName: string,
  endpointTypes: string[] = [],
  overrides: Record<string, string> = {}
): StudioModelCapability[] {
  // ① 管理后台「模型类型」登记表（最高优先级，运营可维护）
  const override = overrides[modelName]
  if (override === 'text' || override === 'image' || override === 'video' || override === 'voice') {
    return [override]
  }
  // ② 前端内置声明（平台无法表达的能力，作为后台未配置时的兜底）
  const declared = DECLARED_MODEL_CAPABILITIES[modelName]
  if (declared) return declared

  const caps = new Set<StudioModelCapability>(
    capabilitiesFromEndpointTypes(endpointTypes)
  )
  for (const [pattern, capability] of NAME_RULES) {
    if (pattern.test(modelName)) {
      caps.add(capability)
      // 名称明确表明是图像/视频/语音模型 → 移除端点类型带来的泛化文本能力
      if (capability !== 'text') caps.delete('text')
    }
  }
  // 无任何端点类型信息时才默认按文本处理（已知的 embeddings/rerank 保持「无能力」，
  // 从而不出现在体验中心任何模式的列表里）
  if (caps.size === 0 && endpointTypes.length === 0) caps.add('text')
  return [...caps]
}

/** 该模型是否可在指定模式下使用 */
export function modelSupportsMode(
  modelName: string,
  mode: StudioModelMode,
  endpointTypes: string[] = [],
  overrides: Record<string, string> = {}
): boolean {
  return resolveModelCapabilities(modelName, endpointTypes, overrides).includes(
    MODE_CAPABILITY[mode]
  )
}

/**
 * 按模式过滤模型列表。
 *
 * 安全兜底：若过滤后为空（例如平台定价接口不可用、或新模型无法识别），
 * 返回原始列表 —— 宁可多显示，也不要让选择器变空导致无法使用。
 */
export function filterModelsByMode(
  models: ModelOption[],
  mode: StudioModelMode,
  endpointTypesByModel: Map<string, string[]> = new Map(),
  overrides: Record<string, string> = {}
): ModelOption[] {
  const filtered = models.filter((model) =>
    modelSupportsMode(
      model.value,
      mode,
      endpointTypesByModel.get(model.value) ?? [],
      overrides
    )
  )
  return filtered.length > 0 ? filtered : models
}
