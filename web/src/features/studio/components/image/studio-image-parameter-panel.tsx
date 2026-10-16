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
import { useTranslation } from 'react-i18next'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type {
  GroupOption,
  ModelOption,
  PlaygroundConfig,
} from '@/features/playground/types'

import {
  STUDIO_IMAGE_DEFAULT_MODEL,
  STUDIO_IMAGE_DEFAULT_SIZE,
  STUDIO_IMAGE_SIZE_OPTIONS,
} from '../../constants'

type StudioImageParameterPanelProps = {
  config: PlaygroundConfig
  disabled?: boolean
  groups: GroupOption[]
  imageConfig: Record<string, unknown>
  models: ModelOption[]
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onGroupChange: (value: string) => void
  onImageConfigChange: (patch: Record<string, unknown>) => void
  onModelChange: (value: string) => void
}

/**
 * 图像生成模式参数面板（原型 REQ-013）：
 * 模型选择区（所有模式共用）+ Image Size（5 档）+ Seed + Negative Prompt。
 * 参数持久化在 studio mode config，按模式独立记忆。
 */
export function StudioImageParameterPanel(props: StudioImageParameterPanelProps) {
  const { t } = useTranslation()
  const size =
    typeof props.imageConfig.image_size === 'string'
      ? (props.imageConfig.image_size as string)
      : STUDIO_IMAGE_DEFAULT_SIZE
  const seed =
    typeof props.imageConfig.seed === 'string' ||
    typeof props.imageConfig.seed === 'number'
      ? String(props.imageConfig.seed)
      : ''
  const negativePrompt =
    typeof props.imageConfig.negative_prompt === 'string'
      ? (props.imageConfig.negative_prompt as string)
      : ''
  // 图像模式使用**自有**模型（不共用文本对话的 config.model，见 constants 注释）
  const model =
    typeof props.imageConfig.model === 'string' &&
    (props.imageConfig.model as string).trim() !== ''
      ? (props.imageConfig.model as string)
      : STUDIO_IMAGE_DEFAULT_MODEL

  return (
    <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
      {/* 模型选择区（与文本对话模式同源，复用官方 ModelGroupSelector） */}
      <div className='grid gap-2'>
        <span className='text-sm font-medium'>{t('Model')}</span>
        <ModelGroupSelector
          className='w-full'
          disabled={props.disabled}
          groups={props.groups}
          models={props.models}
          onGroupChange={props.onGroupChange}
          onModelChange={props.onModelChange}
          selectedGroup={props.config.group}
          selectedModel={model}
        />
      </div>
      <div className='border-t' />

      <div className='grid gap-2'>
        <Label htmlFor='studio-image-size'>{t('Image Size')}</Label>
        <NativeSelect
          className='w-full'
          disabled={props.disabled}
          id='studio-image-size'
          onChange={(event) =>
            props.onImageConfigChange({ image_size: event.target.value })
          }
          value={size}
        >
          {STUDIO_IMAGE_SIZE_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-image-seed'>{t('Seed')}</Label>
        <Input
          disabled={props.disabled}
          id='studio-image-seed'
          inputMode='numeric'
          onChange={(event) =>
            props.onImageConfigChange({ seed: event.target.value })
          }
          placeholder={t('Random')}
          type='number'
          value={seed}
        />
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-image-negative'>{t('Negative Prompt')}</Label>
        <Textarea
          className='min-h-20'
          disabled={props.disabled}
          id='studio-image-negative'
          onChange={(event) =>
            props.onImageConfigChange({ negative_prompt: event.target.value })
          }
          placeholder={t('Negative Prompt')}
          value={negativePrompt}
        />
      </div>
    </div>
  )
}
