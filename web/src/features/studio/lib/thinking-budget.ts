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

import { useAuthStore } from '@/stores/auth-store'

import { THINKING_BUDGET_CONTROL, THINKING_BUDGET_STORAGE_KEY } from '../constants'

function thinkingBudgetStorageKey(): string {
  const userId = useAuthStore.getState().auth.user?.id
  if (userId == null) return THINKING_BUDGET_STORAGE_KEY
  return `${THINKING_BUDGET_STORAGE_KEY}:${userId}`
}

export function normalizeThinkingBudget(value: string | number): number {
  const { min, max, step, defaultValue } = THINKING_BUDGET_CONTROL
  if (value === '') return min

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (Number.isNaN(parsed)) return defaultValue

  const clamped = Math.min(max, Math.max(min, parsed))
  const steps = Math.round((clamped - min) / step)
  return min + steps * step
}

export function readThinkingBudget(): number {
  try {
    const raw = localStorage.getItem(thinkingBudgetStorageKey())
    if (!raw) return THINKING_BUDGET_CONTROL.defaultValue
    const parsed = JSON.parse(raw) as { value?: unknown }
    if (typeof parsed.value !== 'number') {
      return THINKING_BUDGET_CONTROL.defaultValue
    }
    return normalizeThinkingBudget(parsed.value)
  } catch {
    return THINKING_BUDGET_CONTROL.defaultValue
  }
}

export function writeThinkingBudget(value: number): void {
  localStorage.setItem(
    thinkingBudgetStorageKey(),
    JSON.stringify({ value: normalizeThinkingBudget(value) })
  )
}

function isQwenThinkingBudgetModel(model: string): boolean {
  return (
    model.startsWith('qwen') ||
    model.includes('/qwen') ||
    model.startsWith('qwq') ||
    model.includes('/qwq')
  )
}

function isGeminiThinkingBudgetModel(model: string): boolean {
  if (!model.includes('gemini-2.5')) return false
  if (model.includes('-image')) return false
  if (model.includes('-tts')) return false
  if (model.includes('native-audio')) return false
  if (model.includes('-live')) return false
  return true
}

export function modelSupportsThinkingBudget(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  if (!normalized) return false
  return (
    isQwenThinkingBudgetModel(normalized) ||
    isGeminiThinkingBudgetModel(normalized)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function attachThinkingBudget(
  payload: Record<string, unknown>,
  model: string,
  budget: number
): Record<string, unknown> {
  if (!modelSupportsThinkingBudget(model)) return payload

  const normalized = model.trim().toLowerCase()
  const value = normalizeThinkingBudget(budget)
  if (isQwenThinkingBudgetModel(normalized)) {
    return { ...payload, thinking_budget: value }
  }

  const extraBody = isRecord(payload.extra_body) ? payload.extra_body : {}
  const google = isRecord(extraBody.google) ? extraBody.google : {}
  const thinkingConfig = isRecord(google.thinking_config)
    ? google.thinking_config
    : {}

  return {
    ...payload,
    extra_body: {
      ...extraBody,
      google: {
        ...google,
        thinking_config: {
          ...thinkingConfig,
          thinking_budget: value,
        },
      },
    },
  }
}
