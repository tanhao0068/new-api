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

/** 登录态视频任务端点（与 /pg/chat/completions、/pg/images/generations 同族） */
export const STUDIO_VIDEO_CREATE_ENDPOINT = '/pg/videos/generations'

export function studioVideoStatusEndpoint(taskId: string): string {
  return `/pg/videos/${encodeURIComponent(taskId)}`
}

/** 视频内容地址（同源，浏览器直接用于 <video src> 与下载） */
export function studioVideoContentUrl(taskId: string): string {
  return `${studioVideoStatusEndpoint(taskId)}/content`
}

export type CreateStudioVideoInput = {
  model: string
  prompt: string
  negativePrompt?: string
  seed?: number | null
  /** 可选：输出尺寸（WxH）与时长（秒）；不传则用插件默认 */
  size?: string
  seconds?: number
}

export type StudioVideoTask = {
  id?: string
  status?: string
  progress?: number
  errorMessage?: string
}

type CreateResponse = { id?: string; task_id?: string; error?: { message?: string } }
type TaskResponse = {
  id?: string
  task_id?: string
  status?: string
  progress?: number | string
  fail_reason?: string
  error?: { message?: string }
}

export function toVideoErrorMessage(error: unknown): string {
  const res = (error as { response?: { data?: { error?: { message?: string } } } })
    .response
  const message = res?.data?.error?.message
  if (message) return message
  if ((error as Error)?.message) return (error as Error).message
  return 'Video generation failed'
}

/** 提交视频生成任务，返回任务 id */
export async function createStudioVideo(
  input: CreateStudioVideoInput
): Promise<string> {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
  }
  if (input.negativePrompt?.trim()) body.negative_prompt = input.negativePrompt.trim()
  if (typeof input.seed === 'number' && Number.isFinite(input.seed)) body.seed = input.seed
  if (input.size) body.size = input.size
  if (typeof input.seconds === 'number' && input.seconds > 0) body.seconds = input.seconds

  const response = await api.post<CreateResponse>(STUDIO_VIDEO_CREATE_ENDPOINT, body)
  const taskId = response.data?.id ?? response.data?.task_id
  if (!taskId) {
    throw new Error(response.data?.error?.message || 'Video task was not created')
  }
  return taskId
}

/**
 * 归一化任务状态。
 *
 * `/pg/videos/:task_id` 由任务查询端点提供，状态取值来自任务行（**大写**：
 * `SUCCESS` / `FAILURE` / `IN_PROGRESS` / `QUEUED` …），与 OpenAI Videos 的小写
 * 取值（`completed` / `failed`）不同 —— 两者都接受。
 */
function normalizeVideoStatus(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const value = raw.toLowerCase()
  if (value === 'success' || value === 'completed') return 'completed'
  if (value === 'failure' || value === 'failed' || value === 'cancelled') return 'failed'
  return 'in_progress'
}

/** 查询视频任务状态（兼容 `{code,message,data}` 包装与直返两种响应体） */
export async function fetchStudioVideo(taskId: string): Promise<StudioVideoTask> {
  const response = await api.get<unknown>(studioVideoStatusEndpoint(taskId))
  const body = response.data as { data?: TaskResponse } & TaskResponse
  const payload: TaskResponse = (body?.data ?? body) as TaskResponse
  const raw = payload?.progress
  const progress =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw.replace('%', '')) || 0
        : undefined
  return {
    id: payload?.id ?? payload?.task_id,
    status: normalizeVideoStatus(payload?.status),
    progress,
    errorMessage:
      payload?.error?.message ??
      (payload as { fail_reason?: string })?.fail_reason ??
      undefined,
  }
}

/**
 * 取回视频内容并生成浏览器可播放的 object URL。
 *
 * 为什么不能直接把 `/pg/videos/:id/content` 作为 `<video src>`：
 * SPA 的凭据是 **Authorization 头里的访问令牌**（会话 cookie 只用于刷新端点），
 * 而 `<video>` 发起的请求无法附带自定义请求头 —— 直连会因未鉴权而拿不到内容
 * （表现为 networkState=NETWORK_NO_SOURCE）。因此用带鉴权的 api 客户端先取回
 * Blob，再交给 `<video>` 播放；下载链接同样复用该 object URL。
 */
export async function fetchStudioVideoBlobUrl(taskId: string): Promise<string> {
  const response = await api.get(studioVideoContentUrl(taskId), {
    responseType: 'blob',
  })
  const blob = response.data as Blob
  if (!blob || blob.size === 0) {
    throw new Error('Video content is empty')
  }
  return URL.createObjectURL(blob)
}
