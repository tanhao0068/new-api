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

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/lib/http-client', () => ({
  api: { get, post },
}))

import {
  createStudioVideo,
  fetchStudioVideo,
  fetchStudioVideoBlobUrl,
  studioVideoContentUrl,
  toVideoErrorMessage,
} from '../lib/video-request'

test('creates a video task on the login-scoped endpoint', async () => {
  post.mockResolvedValueOnce({ data: { id: 'task_abc', status: 'queued' } })

  const taskId = await createStudioVideo({
    model: 'mibi/wan2.2-t2v',
    prompt: '一只金毛犬在雪地里奔跑',
    seed: 42,
    negativePrompt: '低质量',
  })

  expect(post).toHaveBeenCalledWith('/pg/videos/generations', {
    model: 'mibi/wan2.2-t2v',
    prompt: '一只金毛犬在雪地里奔跑',
    seed: 42,
    negative_prompt: '低质量',
  })
  expect(taskId).toBe('task_abc')
})

test('omits optional fields when absent', async () => {
  post.mockResolvedValueOnce({ data: { id: 'task_1' } })
  await createStudioVideo({ model: 'm', prompt: 'p' })
  const body = post.mock.calls.at(-1)?.[1] as Record<string, unknown>
  expect(body).not.toHaveProperty('seed')
  expect(body).not.toHaveProperty('negative_prompt')
})

// 回归：查询端点返回 {code,message,data:{...}} 包装，且状态为大写（SUCCESS）
// —— 早期实现按顶层小写状态读取，导致任务已完成但页面一直停在「生成中」。
test('reads the wrapped task response and normalizes uppercase statuses', async () => {
  get.mockResolvedValueOnce({
    data: {
      code: 'success',
      message: '',
      data: { task_id: 'task_abc', status: 'SUCCESS', progress: '100%' },
    },
  })

  const task = await fetchStudioVideo('task_abc')
  expect(get).toHaveBeenCalledWith('/pg/videos/task_abc')
  expect(task.status).toBe('completed')
  expect(task.progress).toBe(100)
  expect(task.id).toBe('task_abc')
})

test('normalizes in-progress and failure statuses, unwrapped shape', async () => {
  get.mockResolvedValueOnce({ data: { status: 'IN_PROGRESS', progress: '30%' } })
  expect((await fetchStudioVideo('t1')).status).toBe('in_progress')

  get.mockResolvedValueOnce({
    data: { code: 'success', data: { status: 'FAILURE', fail_reason: 'comfyui error' } },
  })
  const failed = await fetchStudioVideo('t2')
  expect(failed.status).toBe('failed')
  expect(failed.errorMessage).toBe('comfyui error')
})

test('builds the same-origin content url', () => {
  expect(studioVideoContentUrl('task_abc')).toBe('/pg/videos/task_abc/content')
})

test('extracts upstream error messages', () => {
  expect(
    toVideoErrorMessage({ response: { data: { error: { message: 'boom' } } } })
  ).toBe('boom')
  expect(toVideoErrorMessage(new Error('net'))).toBe('net')
  expect(toVideoErrorMessage({})).toBe('Video generation failed')
})

// 回归：<video> 无法携带 Authorization 头，因此内容必须先经带鉴权的 Blob 取回
test('fetches video content as an authenticated blob for playback', async () => {
  const blob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
    type: 'video/webm',
  })
  get.mockResolvedValueOnce({ data: blob })
  const createObjectURL = vi.fn(() => 'blob:mock-url')
  vi.stubGlobal('URL', { ...URL, createObjectURL })

  const url = await fetchStudioVideoBlobUrl('task_abc')

  expect(get).toHaveBeenCalledWith('/pg/videos/task_abc/content', {
    responseType: 'blob',
  })
  expect(url).toBe('blob:mock-url')
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  vi.unstubAllGlobals()
})
