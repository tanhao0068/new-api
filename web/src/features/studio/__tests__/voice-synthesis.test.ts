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
import { expect, test, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/lib/http-client', () => ({
  api: { post },
}))

import {
  STUDIO_VOICE_ENDPOINT,
  synthesizeStudioVoice,
  toVoiceErrorMessage,
} from '../lib/voice-request'

test('synthesizes on the login-scoped endpoint with voice and speed', async () => {
  const blob = new Blob([new Uint8Array([0xff, 0xfb, 0x90])], {
    type: 'audio/mpeg',
  })
  post.mockResolvedValueOnce({ data: blob })
  const createObjectURL = vi.fn(() => 'blob:audio-url')
  vi.stubGlobal('URL', { ...URL, createObjectURL })

  const result = await synthesizeStudioVoice({
    model: 'mibi/edge-tts',
    input: '测试文本',
    voice: 'zh-CN-XiaoxiaoNeural',
    speed: 1.2,
  })

  expect(post).toHaveBeenCalledWith(
    STUDIO_VOICE_ENDPOINT,
    {
      model: 'mibi/edge-tts',
      input: '测试文本',
      voice: 'zh-CN-XiaoxiaoNeural',
      response_format: 'mp3',
      speed: 1.2,
    },
    { responseType: 'blob' }
  )
  expect(STUDIO_VOICE_ENDPOINT).toBe('/pg/audio/speech')
  expect(result.url).toBe('blob:audio-url')
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  vi.unstubAllGlobals()
})

// 音量增益不在平台 AudioRequest DTO 内 —— 必须放进 metadata 才能到达上游
test('passes volume gain through metadata and omits it when zero', async () => {
  post.mockResolvedValueOnce({ data: new Blob([new Uint8Array([1])]) })
  await synthesizeStudioVoice({
    model: 'm',
    input: 't',
    voice: 'v',
    volumeGain: 6,
  })
  let body = post.mock.calls.at(-1)?.[1] as Record<string, unknown>
  expect(body.metadata).toEqual({ volume_gain: 6 })

  post.mockResolvedValueOnce({ data: new Blob([new Uint8Array([1])]) })
  await synthesizeStudioVoice({
    model: 'm',
    input: 't',
    voice: 'v',
    volumeGain: 0,
  })
  body = post.mock.calls.at(-1)?.[1] as Record<string, unknown>
  expect(body).not.toHaveProperty('metadata')
})

test('rejects empty audio responses and extracts error messages', async () => {
  post.mockResolvedValueOnce({ data: new Blob([]) })
  await expect(
    synthesizeStudioVoice({ model: 'm', input: 't', voice: 'v' })
  ).rejects.toThrow('Voice synthesis returned empty audio')

  expect(
    toVoiceErrorMessage({ response: { data: { error: { message: 'bad voice' } } } })
  ).toBe('bad voice')
  expect(toVoiceErrorMessage(new Error('net'))).toBe('net')
  expect(toVoiceErrorMessage({})).toBe('Voice synthesis failed')
})
