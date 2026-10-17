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
import { expect, test } from 'vitest'

import {
  filterModelsByMode,
  modelSupportsMode,
  resolveModelCapabilities,
} from '../lib/model-capability'

const opts = (...values: string[]) => values.map((v) => ({ label: v, value: v }))

test('自建模型使用显式声明的能力（平台端点类型无法表达）', () => {
  // 这三个模型在平台的 supported_endpoint_types 上分别是
  // ['image-generation','openai']、['openai']、['openai']
  expect(resolveModelCapabilities('mibi/qwen-image', ['image-generation', 'openai'])).toEqual(['image'])
  expect(resolveModelCapabilities('mibi/wan2.2-t2v', ['openai'])).toEqual(['video'])
  expect(resolveModelCapabilities('mibi/edge-tts', ['openai'])).toEqual(['voice'])
})

test('未声明模型按端点类型判定：图像模型不得出现在文本列表', () => {
  const caps = resolveModelCapabilities('vendor/flux-pro', ['image-generation', 'openai'])
  expect(caps).toContain('image')
  expect(caps).not.toContain('text')
  expect(modelSupportsMode('vendor/flux-pro', 'image', ['image-generation', 'openai'])).toBe(true)
  expect(modelSupportsMode('vendor/flux-pro', 'chat', ['image-generation', 'openai'])).toBe(false)
})

test('普通文本模型归入文本能力', () => {
  expect(resolveModelCapabilities('cohere/north-mini-code:free', ['openai'])).toEqual(['text'])
  expect(resolveModelCapabilities('claude-x', ['anthropic'])).toEqual(['text'])
  // 无端点类型信息时默认按文本处理
  expect(resolveModelCapabilities('unknown-model')).toEqual(['text'])
})

test('名称关键字兜底：语音 / 视频 / 图像', () => {
  expect(resolveModelCapabilities('acme/tts-v2', ['openai'])).toEqual(['voice'])
  expect(resolveModelCapabilities('acme/speech-hd', ['openai'])).toEqual(['voice'])
  expect(resolveModelCapabilities('acme/video-gen', ['openai'])).toEqual(['video'])
  expect(resolveModelCapabilities('acme/t2v-small', ['openai'])).toEqual(['video'])
  expect(resolveModelCapabilities('acme/image-pro', ['openai'])).toEqual(['image'])
})

test('embeddings / rerank 不属于任何体验中心模式', () => {
  expect(resolveModelCapabilities('text-embedding-3-large', ['embeddings'])).toEqual([])
  expect(modelSupportsMode('text-embedding-3-large', 'chat', ['embeddings'])).toBe(false)
})

test('按模式过滤：各模式只保留对应能力的模型', () => {
  const models = opts(
    'cohere/north-mini-code:free',
    'mibi/qwen-image',
    'mibi/wan2.2-t2v',
    'mibi/edge-tts'
  )
  const types = new Map<string, string[]>([
    ['cohere/north-mini-code:free', ['openai']],
    ['mibi/qwen-image', ['image-generation', 'openai']],
    ['mibi/wan2.2-t2v', ['openai']],
    ['mibi/edge-tts', ['openai']],
  ])

  expect(filterModelsByMode(models, 'chat', types).map((m) => m.value)).toEqual([
    'cohere/north-mini-code:free',
  ])
  expect(filterModelsByMode(models, 'image', types).map((m) => m.value)).toEqual([
    'mibi/qwen-image',
  ])
  expect(filterModelsByMode(models, 'video', types).map((m) => m.value)).toEqual([
    'mibi/wan2.2-t2v',
  ])
  expect(filterModelsByMode(models, 'voice', types).map((m) => m.value)).toEqual([
    'mibi/edge-tts',
  ])
})

test('过滤结果为空时回退为完整列表（不让选择器变空）', () => {
  const models = opts('cohere/north-mini-code:free')
  const types = new Map<string, string[]>([['cohere/north-mini-code:free', ['openai']]])
  expect(filterModelsByMode(models, 'image', types)).toEqual(models)
  // 定价接口不可用（无端点类型映射）时同样按文本模型处理，不会清空
  expect(filterModelsByMode(models, 'chat', new Map())).toEqual(models)
})
