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

import { STUDIO_MODE_CONFIG_STORAGE_KEY } from '../constants'
import type { StudioGenerationMode, StudioModeConfigMap } from '../types'

const GENERATION_MODES: readonly StudioGenerationMode[] = [
  'image',
  'video',
  'voice',
]

function modeConfigStorageKey(): string {
  const userId = useAuthStore.getState().auth.user?.id
  if (userId == null) return STUDIO_MODE_CONFIG_STORAGE_KEY
  return `${STUDIO_MODE_CONFIG_STORAGE_KEY}:${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readStudioModeConfig(): StudioModeConfigMap {
  try {
    const raw = localStorage.getItem(modeConfigStorageKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return {}

    const config: StudioModeConfigMap = {}
    for (const mode of GENERATION_MODES) {
      if (isRecord(parsed[mode])) {
        config[mode] = parsed[mode]
      }
    }
    return config
  } catch {
    return {}
  }
}

export function writeStudioModeConfig(
  mode: StudioGenerationMode,
  patch: Record<string, unknown>
): StudioModeConfigMap {
  const current = readStudioModeConfig()
  const next: StudioModeConfigMap = {
    ...current,
    [mode]: { ...current[mode], ...patch },
  }
  localStorage.setItem(modeConfigStorageKey(), JSON.stringify(next))
  return next
}
