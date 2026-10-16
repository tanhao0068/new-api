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

import type { StudioMode } from './types'

export const STUDIO_NARROW_BREAKPOINT = 768

export const THINKING_BUDGET_STORAGE_KEY = 'studio_thinking_budget'

export const STUDIO_MODE_CONFIG_STORAGE_KEY = 'studio_mode_config'

export const THINKING_BUDGET_CONTROL = {
  labelKey: 'Thinking Budget',
  min: 0,
  max: 32768,
  step: 1024,
  defaultValue: 4096,
} as const

export const STUDIO_MODE_TITLE_KEY: Record<StudioMode, string> = {
  chat: 'Text Chat',
  image: 'Image Generation',
  video: 'Video Generation',
  voice: 'Voice Synthesis',
}

export const STUDIO_PROMPT_PLACEHOLDER_KEY: Record<StudioMode, string> = {
  chat: 'Type a message...',
  image: 'Describe the image you want to generate...',
  video: 'Describe the video you want to generate...',
  voice: 'Enter the text to synthesize...',
}

export const STUDIO_SEND_LABEL_KEY: Record<StudioMode, string> = {
  chat: 'Send',
  image: 'Generate',
  video: 'Generate',
  voice: 'Synthesize',
}

export const STUDIO_PROMPT_CHIPS: Record<StudioMode, readonly string[]> = {
  chat: [
    'Explain quantum computing in one sentence',
    'Write a short poem about autumn',
    'Write a Python quicksort',
    'Compare REST vs GraphQL pros and cons',
  ],
  image: [
    'A cat walking under a starry sky, cyberpunk style',
    'A Chinese courtyard in an autumn ginkgo forest',
    'Aerial view of a futuristic city',
    'A steaming cup of coffee, minimalist photography',
  ],
  video: [
    'City night timelapse with flowing traffic',
    'Slow-motion waves crashing on rocks',
    'Mist flowing through a forest at dawn',
    '360-degree rotating product showcase shot',
  ],
  voice: [
    'Welcome to AI voice synthesis',
    'Please read this news in standard Mandarin',
    'Meeting at 3pm tomorrow in the conference room',
    'This is a Mandarin synthesis test text',
  ],
}

export const STUDIO_PLACEHOLDER_DESCRIPTION_KEY: Record<
  Exclude<StudioMode, 'chat'>,
  string
> = {
  image:
    'Image generation will be available in Phase 2, supporting text-to-image, image-to-image, Image Size / Seed / Negative Prompt, and result preview & download.',
  video:
    'Video generation will be available in Phase 2, supporting text-to-video, image-to-video, Upload Image / Seed / Negative Prompt, and result preview.',
  voice:
    'Voice synthesis will be available in Phase 2, supporting text-to-speech, Speed / Volume Gain / Voice configuration, and audio download.',
}

/** 图像生成尺寸档位（原型：5 档；默认 1024x1024，与 spec REQ-013 一致）。
 *  Qwen-Image 在 1328 系尺寸下质量最佳，故同时提供 1328x1328 与两种宽幅。 */
export const STUDIO_IMAGE_SIZE_OPTIONS = [
  '768x768',
  '1024x1024',
  '1328x1328',
  '1664x928',
  '928x1664',
] as const

export const STUDIO_IMAGE_DEFAULT_SIZE = '1024x1024'

/** 图像模式默认模型（平台侧自建文生图模型 id）。
 *  注意：**不能与文本对话共用 config.model** —— 否则图像请求会被路由到聊天渠道，
 *  实测报 `no route for POST /v1/images/generations`（channel #1, 404）。
 *  模型列表「按模式区分」的完整实现见 tasks.md §3.4（待办）。 */
export const STUDIO_IMAGE_DEFAULT_MODEL = 'mibi/qwen-image'

/** 图像模式参数默认值（持久化在 mode config 中，按模式独立记忆） */
export const STUDIO_IMAGE_PARAM_DEFAULTS: Record<string, unknown> = {
  model: STUDIO_IMAGE_DEFAULT_MODEL,
  image_size: STUDIO_IMAGE_DEFAULT_SIZE,
  seed: '',
  negative_prompt: '',
}
