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

/** 体验中心图像生成端点（登录态，与 /pg/chat/completions 同族的服务端入口） */
export const STUDIO_IMAGE_ENDPOINT = '/pg/images/generations'

export type GenerateStudioImageInput = {
  model: string
  prompt: string
  size: string
  seed?: number | null
  negativePrompt?: string
}

export type GenerateStudioImageResult = {
  url: string
  seed?: number
  elapsed?: number
  bytes?: number
}

type ImageResponseBody = {
  data?: Array<{ url?: string; b64_json?: string; seed?: number; elapsed_s?: number; bytes?: number }>
  error?: { message?: string }
}

/** 提取后端/上游返回的可读错误信息 */
export function toImageErrorMessage(error: unknown): string {
  const res = (error as { response?: { data?: ImageResponseBody; status?: number } }).response
  const message = res?.data?.error?.message
  if (message) return message
  if ((error as Error)?.message) return (error as Error).message
  return 'Image generation failed'
}

export async function generateStudioImage(
  input: GenerateStudioImageInput
): Promise<GenerateStudioImageResult> {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    n: 1,
  }
  if (typeof input.seed === 'number' && Number.isFinite(input.seed)) {
    body.seed = input.seed
  }
  if (input.negativePrompt?.trim()) {
    body.negative_prompt = input.negativePrompt.trim()
  }

  const response = await api.post<ImageResponseBody>(STUDIO_IMAGE_ENDPOINT, body)
  const item = response.data?.data?.[0]
  if (!item?.url && !item?.b64_json) {
    throw new Error(response.data?.error?.message || 'Image generation returned no image')
  }
  return {
    url: item.url ?? `data:image/png;base64,${item.b64_json}`,
    seed: item.seed,
    elapsed: item.elapsed_s,
    bytes: item.bytes,
  }
}
