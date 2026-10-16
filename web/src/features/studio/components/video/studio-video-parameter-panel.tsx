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
import { Textarea } from '@/components/ui/textarea'
import type {
  GroupOption,
  ModelOption,
  PlaygroundConfig,
} from '@/features/playground/types'

import { STUDIO_VIDEO_DEFAULT_MODEL } from '../../constants'

type StudioVideoParameterPanelProps = {
  config: PlaygroundConfig
  disabled?: boolean
  groups: GroupOption[]
  models: ModelOption[]
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onGroupChange: (value: string) => void
  onModelChange: (value: string) => void
  onVideoConfigChange: (patch: Record<string, unknown>) => void
  videoConfig: Record<string, unknown>
}

/**
 * 视频生成模式参数面板（原型 REQ-013）：
 * 模型选择区（四模式共用）+ Upload Image + Seed + Negative Prompt。
 *
 * 说明：Upload Image（图生视频）为原型要求的一次到位控件，但当前自建上游
 * （Wan2.2 T2V）仅支持文生视频，暂无图生视频模型 —— 故控件按原型展示但
 * 明确标注暂不可用（与「添加对比模型」一期不可点击的处理一致）。
 */
export function StudioVideoParameterPanel(props: StudioVideoParameterPanelProps) {
  const { t } = useTranslation()
  const model =
    typeof props.videoConfig.model === 'string' &&
    (props.videoConfig.model as string).trim() !== ''
      ? (props.videoConfig.model as string)
      : STUDIO_VIDEO_DEFAULT_MODEL
  const rawSeed = props.videoConfig.seed
  const seed =
    typeof rawSeed === 'string' || typeof rawSeed === 'number'
      ? String(rawSeed)
      : ''
  const negativePrompt =
    typeof props.videoConfig.negative_prompt === 'string'
      ? (props.videoConfig.negative_prompt as string)
      : ''

  return (
    <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
      {/* 模型选择区（与其余模式同源） */}
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

      {/* Upload Image（图生视频）—— 原型控件，本地上游暂无对应模型 */}
      <div className='grid gap-2'>
        <Label htmlFor='studio-video-upload'>{t('Upload Image')}</Label>
        <div
          className='border-muted-foreground/30 text-muted-foreground flex h-20 items-center justify-center rounded-md border border-dashed text-xs'
          id='studio-video-upload'
        >
          {t('Image-to-video is not available yet')}
        </div>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-video-seed'>{t('Seed')}</Label>
        <Input
          disabled={props.disabled}
          id='studio-video-seed'
          inputMode='numeric'
          onChange={(event) =>
            props.onVideoConfigChange({ seed: event.target.value })
          }
          placeholder={t('Random')}
          type='number'
          value={seed}
        />
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-video-negative'>{t('Negative Prompt')}</Label>
        <Textarea
          className='min-h-20'
          disabled={props.disabled}
          id='studio-video-negative'
          onChange={(event) =>
            props.onVideoConfigChange({ negative_prompt: event.target.value })
          }
          placeholder={t('Negative Prompt')}
          value={negativePrompt}
        />
      </div>
    </div>
  )
}
