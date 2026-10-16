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
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/lib/http-client', () => ({
  api: { post },
}))

import {
  generateStudioImage,
  STUDIO_IMAGE_ENDPOINT,
  toImageErrorMessage,
} from '../lib/image-request'
import { StudioImageWorkspace } from '../components/studio-image-workspace'

test('image generation posts the OpenAI images body to the login-scoped endpoint', async () => {
  post.mockResolvedValueOnce({
    data: { data: [{ url: 'http://img/1.png', seed: 42, elapsed_s: 6.1 }] },
  })

  const result = await generateStudioImage({
    model: 'mibi/qwen-image',
    prompt: '一只猫',
    size: '1024x1024',
    seed: 42,
    negativePrompt: '模糊',
  })

  expect(post).toHaveBeenCalledWith(STUDIO_IMAGE_ENDPOINT, {
    model: 'mibi/qwen-image',
    prompt: '一只猫',
    size: '1024x1024',
    n: 1,
    seed: 42,
    negative_prompt: '模糊',
  })
  expect(STUDIO_IMAGE_ENDPOINT).toBe('/pg/images/generations')
  expect(result).toEqual({ url: 'http://img/1.png', seed: 42, elapsed: 6.1, bytes: undefined })
})

test('omits seed and negative prompt when not provided', async () => {
  post.mockResolvedValueOnce({ data: { data: [{ url: 'http://img/2.png' }] } })

  await generateStudioImage({
    model: 'mibi/qwen-image',
    prompt: 'x',
    size: '768x768',
  })

  const body = post.mock.calls.at(-1)?.[1] as Record<string, unknown>
  expect(body).not.toHaveProperty('seed')
  expect(body).not.toHaveProperty('negative_prompt')
})

test('extracts the upstream error message for the UI', () => {
  expect(
    toImageErrorMessage({ response: { data: { error: { message: 'size out of range' } } } })
  ).toBe('size out of range')
  expect(toImageErrorMessage(new Error('network down'))).toBe('network down')
  expect(toImageErrorMessage({})).toBe('Image generation failed')
})

test('workspace renders each generation state', () => {
  const { rerender } = render(
    <StudioImageWorkspace onRegenerate={vi.fn()} state={{ status: 'idle' }} />
  )
  expect(
    screen.getByText('Describe the image you want to generate...')
  ).toBeInTheDocument()

  rerender(
    <StudioImageWorkspace
      onRegenerate={vi.fn()}
      state={{ status: 'generating', prompt: '一只猫' }}
    />
  )
  expect(screen.getByText('Generating...')).toBeInTheDocument()

  rerender(
    <StudioImageWorkspace
      onRegenerate={vi.fn()}
      state={{
        status: 'success',
        url: 'http://img/1.png',
        prompt: '一只猫',
        size: '1024x1024',
        seed: 42,
        elapsed: 6.1,
      }}
    />
  )
  expect(screen.getByRole('img', { name: '一只猫' })).toHaveAttribute(
    'src',
    'http://img/1.png'
  )
  expect(screen.getByText('1024x1024')).toBeInTheDocument()
  expect(screen.getByText(/42/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Download/ })).toBeInTheDocument()

  rerender(
    <StudioImageWorkspace
      onRegenerate={vi.fn()}
      state={{ status: 'error', error: 'comfyui timeout' }}
    />
  )
  expect(screen.getByText('Image generation failed')).toBeInTheDocument()
  expect(screen.getByText('comfyui timeout')).toBeInTheDocument()
})
