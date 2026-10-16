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
import type {
  GroupOption,
  ModelOption,
  PlaygroundConfig,
} from '@/features/playground/types'

import {
  STUDIO_VOICE_DEFAULT_MODEL,
  STUDIO_VOICE_DEFAULT_VOICE,
  STUDIO_VOICE_OPTIONS,
  STUDIO_VOICE_SPEED,
  STUDIO_VOICE_VOLUME,
} from '../../constants'

type StudioVoiceParameterPanelProps = {
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
  onVoiceConfigChange: (patch: Record<string, unknown>) => void
  voiceConfig: Record<string, unknown>
}

/**
 * 语音合成模式参数面板（原型 REQ-013）：
 * 模型选择区（四模式共用）+ 音色 + 语速（0.5–2.0）+ 音量增益（-12–12 dB）。
 */
export function StudioVoiceParameterPanel(props: StudioVoiceParameterPanelProps) {
  const { t } = useTranslation()
  const model =
    typeof props.voiceConfig.model === 'string' &&
    (props.voiceConfig.model as string).trim() !== ''
      ? (props.voiceConfig.model as string)
      : STUDIO_VOICE_DEFAULT_MODEL
  const voice =
    typeof props.voiceConfig.voice === 'string' &&
    (props.voiceConfig.voice as string).trim() !== ''
      ? (props.voiceConfig.voice as string)
      : STUDIO_VOICE_DEFAULT_VOICE
  const rawSpeed = props.voiceConfig.speed
  const speed =
    typeof rawSpeed === 'string' || typeof rawSpeed === 'number'
      ? String(rawSpeed)
      : String(STUDIO_VOICE_SPEED.defaultValue)
  const rawVolume = props.voiceConfig.volume_gain
  const volume =
    typeof rawVolume === 'string' || typeof rawVolume === 'number'
      ? String(rawVolume)
      : String(STUDIO_VOICE_VOLUME.defaultValue)

  return (
    <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
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
        <Label htmlFor='studio-voice-name'>{t('Voice')}</Label>
        <NativeSelect
          className='w-full'
          disabled={props.disabled}
          id='studio-voice-name'
          onChange={(event) =>
            props.onVoiceConfigChange({ voice: event.target.value })
          }
          value={voice}
        >
          {STUDIO_VOICE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-voice-speed'>{t('Speed')}</Label>
        <Input
          disabled={props.disabled}
          id='studio-voice-speed'
          max={STUDIO_VOICE_SPEED.max}
          min={STUDIO_VOICE_SPEED.min}
          onChange={(event) =>
            props.onVoiceConfigChange({ speed: event.target.value })
          }
          step={STUDIO_VOICE_SPEED.step}
          type='number'
          value={speed}
        />
        <p className='text-muted-foreground text-xs'>
          {STUDIO_VOICE_SPEED.min}–{STUDIO_VOICE_SPEED.max}
        </p>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='studio-voice-volume'>{t('Volume Gain')}</Label>
        <Input
          disabled={props.disabled}
          id='studio-voice-volume'
          max={STUDIO_VOICE_VOLUME.max}
          min={STUDIO_VOICE_VOLUME.min}
          onChange={(event) =>
            props.onVoiceConfigChange({ volume_gain: event.target.value })
          }
          step={STUDIO_VOICE_VOLUME.step}
          type='number'
          value={volume}
        />
        <p className='text-muted-foreground text-xs'>
          {STUDIO_VOICE_VOLUME.min}–{STUDIO_VOICE_VOLUME.max} dB
        </p>
      </div>
    </div>
  )
}
