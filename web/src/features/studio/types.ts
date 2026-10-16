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

export type StudioMode = 'chat' | 'image' | 'video' | 'voice'

export type StudioGenerationMode = Exclude<StudioMode, 'chat'>

export type StudioModeConfigMap = Partial<
  Record<StudioGenerationMode, Record<string, unknown>>
>

/** 图像生成工作区状态 */
export type StudioImageStatus = 'idle' | 'generating' | 'success' | 'error'

export type StudioImageState = {
  status: StudioImageStatus
  url?: string
  prompt?: string
  size?: string
  seed?: number
  elapsed?: number
  error?: string
}

/** 图像模式参数（持久化于 studio mode config） */
export type StudioImageConfig = {
  image_size?: string
  seed?: string | number
  negative_prompt?: string
}

/** 视频生成工作区状态（异步任务：提交 → 排队 → 生成中 → 完成/失败） */
export type StudioVideoStatus =
  | 'idle'
  | 'submitting'
  | 'generating'
  | 'success'
  | 'error'

export type StudioVideoState = {
  status: StudioVideoStatus
  taskId?: string
  url?: string
  prompt?: string
  progress?: number
  error?: string
}

/** 语音合成工作区状态（同步接口：合成中 → 成功/失败） */
export type StudioVoiceStatus = 'idle' | 'synthesizing' | 'success' | 'error'

export type StudioVoiceState = {
  status: StudioVoiceStatus
  url?: string
  text?: string
  voice?: string
  speed?: number
  volumeGain?: number
  elapsed?: number
  error?: string
}
