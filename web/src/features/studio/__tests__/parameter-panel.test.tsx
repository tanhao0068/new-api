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
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { DEFAULT_CONFIG } from '@/features/playground/constants'
import { PLAYGROUND_PARAMETER_CONTROLS } from '@/features/playground/lib/parameters/playground-parameters'
import type { PlaygroundConfig } from '@/features/playground/types'

import { THINKING_BUDGET_CONTROL } from '../constants'
import { StudioChatParameterPanel } from '../components/chat/studio-chat-parameter-panel'

function renderPanel(
  overrides: Partial<{
    config: PlaygroundConfig
    showThinkingBudget: boolean
    thinkingBudget: number
  }> = {}
) {
  const onConfigChange = vi.fn()
  const onParameterEnabledChange = vi.fn()
  const onThinkingBudgetChange = vi.fn()
  const onClearSession = vi.fn()
  const onGroupChange = vi.fn()
  const onModelChange = vi.fn()

  render(
    <StudioChatParameterPanel
      config={overrides.config ?? DEFAULT_CONFIG}
      groups={[
        { label: 'Default Group', ratio: 1, value: 'default' },
        { label: 'Premium Group', ratio: 2, value: 'premium' },
      ]}
      models={[
        { label: 'GLM-5.3-Flash', value: 'glm-5.3-flash' },
        { label: 'gpt-4o', value: 'gpt-4o' },
      ]}
      onClearSession={onClearSession}
      onConfigChange={onConfigChange}
      onGroupChange={onGroupChange}
      onModelChange={onModelChange}
      onParameterEnabledChange={onParameterEnabledChange}
      onThinkingBudgetChange={onThinkingBudgetChange}
      showThinkingBudget={overrides.showThinkingBudget ?? false}
      thinkingBudget={overrides.thinkingBudget ?? THINKING_BUDGET_CONTROL.defaultValue}
    />
  )

  return {
    onClearSession,
    onConfigChange,
    onGroupChange,
    onModelChange,
    onParameterEnabledChange,
    onThinkingBudgetChange,
  }
}

test('the model selection window sits above the parameters (prototype REQ-004)', () => {
  const { onModelChange, onGroupChange } = renderPanel({
    config: { ...DEFAULT_CONFIG, group: 'default', model: 'glm-5.3-flash' },
  })

  // 模型与分组选择器（复用官方 ModelGroupSelector：一个组合选择器 + 搜索）
  expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1)

  // 当前模型回显，且位于参数控件之前
  const modelLabel = screen.getByText('GLM-5.3-Flash')
  const temperature = screen.getByText('Temperature')
  expect(
    modelLabel.compareDocumentPosition(temperature) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()

  // 一期占位：对比模型按钮不可用
  const compareButton = screen.getByRole('button', {
    name: /Add Compare Model/,
  })
  expect(compareButton).toBeDisabled()

  expect(onModelChange).toBeTypeOf('function')
  expect(onGroupChange).toBeTypeOf('function')
})

test('chat parameters use playground ranges and defaults', () => {
  renderPanel()

  for (const key of [
    'temperature',
    'top_p',
    'max_tokens',
    'frequency_penalty',
    'presence_penalty',
  ] as const) {
    const control = PLAYGROUND_PARAMETER_CONTROLS.find((item) => item.key === key)
    const input = screen.getByRole('spinbutton', { name: control?.labelKey })
    expect(input).toHaveAttribute('min', String(control?.min))
    expect(input).toHaveAttribute('max', String(control?.max))
    expect(input).toHaveAttribute('step', String(control?.step))
    expect(input).toHaveValue(DEFAULT_CONFIG[key])
  }

  const seed = PLAYGROUND_PARAMETER_CONTROLS.find((item) => item.key === 'seed')
  const seedInput = screen.getByRole('spinbutton', { name: 'Seed' })
  expect(seedInput).toHaveAttribute('min', String(seed?.min))
  expect(seedInput).toHaveAttribute('max', String(seed?.max))
  expect(seedInput).toHaveValue(null)
  expect(screen.queryByRole('spinbutton', { name: 'Thinking Budget' })).not.toBeInTheDocument()
})

test('changing temperature updates config and enables the parameter', () => {
  const handlers = renderPanel()

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Temperature' }), {
    target: { value: '0.5' },
  })

  expect(handlers.onConfigChange).toHaveBeenCalledWith('temperature', 0.5)
  expect(handlers.onParameterEnabledChange).toHaveBeenCalledWith(
    'temperature',
    true
  )
})

test('thinking budget is shown only for a supporting model and stays in range', () => {
  const handlers = renderPanel({
    showThinkingBudget: true,
    thinkingBudget: THINKING_BUDGET_CONTROL.defaultValue,
  })

  const input = screen.getByRole('spinbutton', { name: 'Thinking Budget' })
  expect(input).toHaveAttribute('min', String(THINKING_BUDGET_CONTROL.min))
  expect(input).toHaveAttribute('max', String(THINKING_BUDGET_CONTROL.max))
  expect(input).toHaveAttribute('step', String(THINKING_BUDGET_CONTROL.step))
  expect(input).toHaveValue(THINKING_BUDGET_CONTROL.defaultValue)

  fireEvent.change(input, { target: { value: '5000' } })

  expect(handlers.onThinkingBudgetChange).toHaveBeenCalledWith('5000')
})

test('clear session asks for confirmation before removing messages', async () => {
  const user = userEvent.setup()
  const handlers = renderPanel()

  await user.click(screen.getByRole('button', { name: 'Clear Session' }))
  expect(handlers.onClearSession).not.toHaveBeenCalled()

  const dialog = screen.getByRole('alertdialog', { name: 'Clear Session' })
  await user.click(within(dialog).getByRole('button', { name: 'Clear Session' }))

  expect(handlers.onClearSession).toHaveBeenCalledOnce()
})
