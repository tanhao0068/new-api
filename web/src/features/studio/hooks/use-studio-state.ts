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
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  augmentPlaygroundChatBody,
  installPlaygroundRequestAugmentor,
} from '../lib/chat-request-augmentor'
import { readStudioModeConfig, writeStudioModeConfig } from '../lib/mode-config'
import {
  normalizeThinkingBudget,
  readThinkingBudget,
  writeThinkingBudget,
} from '../lib/thinking-budget'
import type { StudioGenerationMode, StudioModeConfigMap } from '../types'

export function useStudioThinkingBudget() {
  const [value, setValueState] = useState(readThinkingBudget)

  const setValue = useCallback((next: string | number) => {
    const normalized = normalizeThinkingBudget(next)
    setValueState(normalized)
    writeThinkingBudget(normalized)
  }, [])

  return { value, setValue }
}

export function useStudioModeConfig() {
  const [configs, setConfigs] = useState<StudioModeConfigMap>(readStudioModeConfig)

  const update = useCallback(
    (mode: StudioGenerationMode, patch: Record<string, unknown>) => {
      setConfigs(writeStudioModeConfig(mode, patch))
    },
    []
  )

  return { configs, update }
}

export function useStudioChatAugmentor(
  model: string,
  budget: number,
  supported: boolean
) {
  const latest = useRef({ model, budget, supported })
  latest.current = { model, budget, supported }

  useEffect(() => {
    return installPlaygroundRequestAugmentor((body) =>
      augmentPlaygroundChatBody(
        body,
        latest.current.model,
        latest.current.budget,
        latest.current.supported
      )
    )
  }, [])
}
