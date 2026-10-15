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
import { afterEach, expect, test } from 'vitest'

import {
  augmentPlaygroundChatBody,
  installPlaygroundRequestAugmentor,
} from '../lib/chat-request-augmentor'
import { writeStudioModeConfig } from '../lib/mode-config'
import { studioModeFromPath } from '../lib/studio-mode'
import {
  modelSupportsThinkingBudget,
  normalizeThinkingBudget,
} from '../lib/thinking-budget'

afterEach(() => {
  localStorage.clear()
})

test('studio paths map to one mode each', () => {
  expect(studioModeFromPath('/studio/chat')).toBe('chat')
  expect(studioModeFromPath('/studio/chat/')).toBe('chat')
  // 体验中心根路径会重定向到 /studio/chat，此处仍应兜底为 chat 模式
  expect(studioModeFromPath('/studio')).toBe('chat')
  expect(studioModeFromPath('/studio/')).toBe('chat')
  expect(studioModeFromPath('/studio/image')).toBe('image')
  expect(studioModeFromPath('/studio/video')).toBe('video')
  expect(studioModeFromPath('/studio/voice')).toBe('voice')
})

test('thinking budget is limited to models the relay keeps and snaps to the step', () => {
  expect(modelSupportsThinkingBudget('qwen-max')).toBe(true)
  expect(modelSupportsThinkingBudget('vendor/qwq-32b')).toBe(true)
  expect(modelSupportsThinkingBudget('gemini-2.5-pro')).toBe(true)
  expect(modelSupportsThinkingBudget('gemini-2.5-flash-image')).toBe(false)
  expect(modelSupportsThinkingBudget('gpt-4o')).toBe(false)
  expect(normalizeThinkingBudget(5000)).toBe(5120)
  expect(normalizeThinkingBudget(40000)).toBe(32768)
  expect(normalizeThinkingBudget('')).toBe(0)
})

test('a supporting model adds thinking budget to the playground chat body', () => {
  const qwen = augmentPlaygroundChatBody(
    JSON.stringify({ model: 'qwen-max', stream: true }),
    'qwen-max',
    4096,
    true
  )
  expect(JSON.parse(qwen)).toMatchObject({
    model: 'qwen-max',
    stream: true,
    thinking_budget: 4096,
  })

  const gemini = JSON.parse(
    augmentPlaygroundChatBody(
      JSON.stringify({ model: 'gemini-2.5-flash', stream: true }),
      'gemini-2.5-flash',
      4096,
      true
    )
  ) as { extra_body: { google: { thinking_config: { thinking_budget: number } } } }
  expect(gemini.extra_body.google.thinking_config.thinking_budget).toBe(4096)

  const plain = augmentPlaygroundChatBody(
    JSON.stringify({ model: 'gpt-4o' }),
    'gpt-4o',
    4096,
    false
  )
  expect(JSON.parse(plain)).toEqual({ model: 'gpt-4o' })
})

test('the request augmentor only rewrites playground chat completions', () => {
  const calls: unknown[] = []
  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function send(body) {
    calls.push(body)
  }
  const restore = installPlaygroundRequestAugmentor((body) =>
    augmentPlaygroundChatBody(body, 'qwen-max', 2048, true)
  )

  const chat = new XMLHttpRequest()
  chat.open('POST', '/pg/chat/completions')
  chat.send(JSON.stringify({ model: 'qwen-max' }))

  const other = new XMLHttpRequest()
  other.open('POST', '/api/user/models')
  other.send(JSON.stringify({ model: 'qwen-max' }))

  restore()
  XMLHttpRequest.prototype.send = originalSend

  expect(JSON.parse(String(calls[0]))).toMatchObject({ thinking_budget: 2048 })
  expect(JSON.parse(String(calls[1]))).toEqual({ model: 'qwen-max' })
})

test('saving one mode keeps the configuration stored for the others', () => {
  writeStudioModeConfig('image', { image_size: '1024x1024' })
  writeStudioModeConfig('video', { seed: '7' })

  const stored = JSON.parse(
    localStorage.getItem('studio_mode_config') ?? '{}'
  ) as {
    image: { image_size: string }
    video: { seed: string }
  }

  expect(stored.image.image_size).toBe('1024x1024')
  expect(stored.video.seed).toBe('7')
})
