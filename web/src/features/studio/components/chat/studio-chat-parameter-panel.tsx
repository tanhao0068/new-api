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
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  normalizeParameterNumberValue,
  PLAYGROUND_PARAMETER_CONTROLS,
  type PlaygroundParameterKey,
} from '@/features/playground/lib/parameters/playground-parameters'
import type {
  GroupOption,
  ModelOption,
  ParameterEnabled,
  PlaygroundConfig,
} from '@/features/playground/types'

import { THINKING_BUDGET_CONTROL } from '../../constants'

type StudioChatParameterPanelProps = {
  config: PlaygroundConfig
  disabled?: boolean
  groups: GroupOption[]
  models: ModelOption[]
  onClearSession: () => void
  onGroupChange: (value: string) => void
  onModelChange: (value: string) => void
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onParameterEnabledChange: (key: PlaygroundParameterKey, value: boolean) => void
  onThinkingBudgetChange: (value: string | number) => void
  showThinkingBudget: boolean
  thinkingBudget: number
}

const PRIMARY_PARAMETER_KEYS = [
  'max_tokens',
  'temperature',
  'top_p',
] as const satisfies readonly PlaygroundParameterKey[]

const EXTRA_PARAMETER_KEYS = [
  'frequency_penalty',
  'presence_penalty',
] as const satisfies readonly PlaygroundParameterKey[]

export function StudioChatParameterPanel(props: StudioChatParameterPanelProps) {
  const { t } = useTranslation()
  const [confirmClear, setConfirmClear] = useState(false)

  const updateParameter = (
    key: PlaygroundParameterKey,
    value: string | number
  ) => {
    const normalized = normalizeParameterNumberValue(key, value)
    if (key === 'seed') {
      props.onConfigChange('seed', normalized)
    } else {
      props.onConfigChange(key, normalized ?? 0)
    }
    props.onParameterEnabledChange(key, true)
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
        {/* 模型选择区（所有模式共用，原型 REQ-004）：
            复用官方 ModelGroupSelector（与 playground 输入区同一组件，含搜索与分组联动），
            仅按原型放在左侧参数面板内。 */}
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
            selectedModel={props.config.model}
          />
          {/* 原型：一期 UI 占位，不可用 */}
          <Button
            className='border-dashed'
            disabled
            size='sm'
            title={t('Add Compare Model')}
            type='button'
            variant='outline'
          >
            <Plus aria-hidden='true' />
            {t('Add Compare Model')}
          </Button>
        </div>
        <div className='border-t' />
        {PRIMARY_PARAMETER_KEYS.map((key) => (
          <ParameterControl
            config={props.config}
            disabled={props.disabled}
            key={key}
            parameterKey={key}
            onValueChange={updateParameter}
          />
        ))}
        {props.showThinkingBudget ? (
          <ThinkingBudgetControl
            disabled={props.disabled}
            onValueChange={props.onThinkingBudgetChange}
            value={props.thinkingBudget}
          />
        ) : null}
        <SeedControl
          disabled={props.disabled}
          onValueChange={(value) => updateParameter('seed', value)}
          value={props.config.seed}
        />
        {EXTRA_PARAMETER_KEYS.map((key) => (
          <ParameterControl
            config={props.config}
            disabled={props.disabled}
            key={key}
            parameterKey={key}
            onValueChange={updateParameter}
          />
        ))}
      </div>
      <div className='border-t p-4'>
        <Button
          className='w-full'
          disabled={props.disabled}
          onClick={() => setConfirmClear(true)}
          type='button'
          variant='outline'
        >
          {t('Clear Session')}
        </Button>
      </div>
      <ConfirmDialog
        confirmText={t('Clear Session')}
        desc={t('This removes the messages stored in this browser.')}
        destructive
        handleConfirm={() => {
          props.onClearSession()
          setConfirmClear(false)
        }}
        onOpenChange={setConfirmClear}
        open={confirmClear}
        title={t('Clear Session')}
      />
    </div>
  )
}

type ParameterControlProps = {
  config: PlaygroundConfig
  disabled?: boolean
  onValueChange: (key: PlaygroundParameterKey, value: string | number) => void
  parameterKey: PlaygroundParameterKey
}

function ParameterControl(props: ParameterControlProps) {
  const control = PLAYGROUND_PARAMETER_CONTROLS.find(
    (item) => item.key === props.parameterKey
  )
  if (!control) return null

  const value = props.config[props.parameterKey]
  const numericValue = typeof value === 'number' ? value : 0

  return (
    <SliderNumberControl
      disabled={props.disabled}
      inputId={`studio-${control.key}`}
      labelKey={control.labelKey}
      max={control.max}
      min={control.min}
      onValueChange={(next) => props.onValueChange(control.key, next)}
      sliderValue={numericValue}
      step={control.step}
      value={numericValue}
    />
  )
}

type SeedControlProps = {
  disabled?: boolean
  onValueChange: (value: string) => void
  value: number | null
}

function SeedControl(props: SeedControlProps) {
  const { t } = useTranslation()
  const control = PLAYGROUND_PARAMETER_CONTROLS.find((item) => item.key === 'seed')
  if (!control) return null

  return (
    <div className='grid gap-2'>
      <label className='text-sm font-medium' htmlFor='studio-seed'>
        {t(control.labelKey)}
      </label>
      <Input
        disabled={props.disabled}
        id='studio-seed'
        inputMode='numeric'
        max={control.max}
        min={control.min}
        onChange={(event) => props.onValueChange(event.target.value)}
        step={control.step}
        type='number'
        value={props.value ?? ''}
      />
    </div>
  )
}

type ThinkingBudgetControlProps = {
  disabled?: boolean
  onValueChange: (value: string | number) => void
  value: number
}

function ThinkingBudgetControl(props: ThinkingBudgetControlProps) {
  return (
    <SliderNumberControl
      disabled={props.disabled}
      inputId='studio-thinking-budget'
      labelKey={THINKING_BUDGET_CONTROL.labelKey}
      max={THINKING_BUDGET_CONTROL.max}
      min={THINKING_BUDGET_CONTROL.min}
      onValueChange={props.onValueChange}
      sliderValue={props.value}
      step={THINKING_BUDGET_CONTROL.step}
      value={props.value}
    />
  )
}

type SliderNumberControlProps = {
  disabled?: boolean
  inputId: string
  labelKey: string
  max: number
  min: number
  onValueChange: (value: string | number) => void
  sliderValue: number
  step: number
  value: number
}

function SliderNumberControl(props: SliderNumberControlProps) {
  const { t } = useTranslation()

  return (
    <div className='grid gap-2'>
      <div className='flex items-center justify-between gap-3'>
        <label className='text-sm font-medium' htmlFor={props.inputId}>
          {t(props.labelKey)}
        </label>
        <Input
          className='h-8 w-28'
          disabled={props.disabled}
          id={props.inputId}
          inputMode='decimal'
          max={props.max}
          min={props.min}
          onChange={(event) => props.onValueChange(event.target.value)}
          step={props.step}
          type='number'
          value={props.value}
        />
      </div>
      <Slider
        aria-label={t(props.labelKey)}
        disabled={props.disabled}
        max={props.max}
        min={props.min}
        onValueChange={(nextValue) => {
          const firstValue = Array.isArray(nextValue) ? nextValue[0] : nextValue
          if (typeof firstValue !== 'number') return
          props.onValueChange(firstValue)
        }}
        step={props.step}
        value={[props.sliderValue]}
      />
    </div>
  )
}
