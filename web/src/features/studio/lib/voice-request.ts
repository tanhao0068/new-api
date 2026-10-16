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
import { api } from '@/lib/http-client'

/** 登录态语音合成端点（与 /pg/chat/completions、/pg/images/*、/pg/videos/* 同族） */
export const STUDIO_VOICE_ENDPOINT = '/pg/audio/speech'

export type SynthesizeStudioVoiceInput = {
  model: string
  input: string
  voice: string
  speed?: number
  /** 音量增益（dB，-12–12）。平台 AudioRequest DTO 无该字段，
   *  故放在 metadata 内传递（metadata 会被平台保留并转发给上游）。 */
  volumeGain?: number
  responseFormat?: 'mp3' | 'wav'
}

export type SynthesizeStudioVoiceResult = {
  url: string
  elapsed?: number
  bytes?: number
}

type AudioErrorBody = { error?: { message?: string } }

export function toVoiceErrorMessage(error: unknown): string {
  const res = (error as { response?: { data?: AudioErrorBody | Blob } }).response
  const data = res?.data
  if (data && !(data instanceof Blob)) {
    const message = (data as AudioErrorBody)?.error?.message
    if (message) return message
  }
  if ((error as Error)?.message) return (error as Error).message
  return 'Voice synthesis failed'
}

/**
 * 语音合成（同步返回音频）。
 *
 * 与视频同理：SPA 凭据在 Authorization 头中，原生媒体标签无法携带，
 * 因此用带鉴权的 api 客户端取回 Blob，再以 object URL 交给 <audio> 播放/下载。
 */
export async function synthesizeStudioVoice(
  input: SynthesizeStudioVoiceInput
): Promise<SynthesizeStudioVoiceResult> {
  const body: Record<string, unknown> = {
    model: input.model,
    input: input.input,
    voice: input.voice,
    response_format: input.responseFormat ?? 'mp3',
  }
  if (typeof input.speed === 'number' && Number.isFinite(input.speed)) {
    body.speed = input.speed
  }
  if (
    typeof input.volumeGain === 'number' &&
    Number.isFinite(input.volumeGain) &&
    input.volumeGain !== 0
  ) {
    body.metadata = { volume_gain: input.volumeGain }
  }

  const started = Date.now()
  const response = await api.post(STUDIO_VOICE_ENDPOINT, body, {
    responseType: 'blob',
  })
  const blob = response.data as Blob
  if (!blob || blob.size === 0) {
    throw new Error('Voice synthesis returned empty audio')
  }
  return {
    url: URL.createObjectURL(blob),
    bytes: blob.size,
    elapsed: (Date.now() - started) / 1000,
  }
}
