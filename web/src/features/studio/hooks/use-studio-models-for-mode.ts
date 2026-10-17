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
import { useMemo } from 'react'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import type { ModelOption } from '@/features/playground/types'

import { filterModelsByMode, type StudioModelMode } from '../lib/model-capability'

/**
 * 按当前模式过滤可选模型（文本 / 图像 / 视频 / 语音各只展示对应能力的模型）。
 *
 * 能力来源：
 *  1. `/api/pricing` 的 `supported_endpoint_types`（平台派生，仅图像等有独立端点类型）；
 *  2. `model-capability.ts` 中的显式声明（语音/自建视频等平台无法表达的能力）；
 *  3. 模型名称关键字兜底。
 *
 * 定价接口不可用时（例如模型广场关闭）自动降级为「声明 + 名称规则」，不影响使用。
 */
export function useStudioModelsForMode(
  mode: StudioModelMode,
  models: ModelOption[]
): ModelOption[] {
  const { models: pricingModels } = usePricingData()

  const endpointTypesByModel = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const model of pricingModels) {
      map.set(model.model_name, model.supported_endpoint_types ?? [])
    }
    return map
  }, [pricingModels])

  return useMemo(
    () => filterModelsByMode(models, mode, endpointTypesByModel),
    [models, mode, endpointTypesByModel]
  )
}
