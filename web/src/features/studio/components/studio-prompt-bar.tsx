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
import { Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { getSubmittableInputText } from '@/features/playground/lib/input/input-control-utils'

import {
  STUDIO_PROMPT_CHIPS,
  STUDIO_PROMPT_PLACEHOLDER_KEY,
  STUDIO_SEND_LABEL_KEY,
} from '../constants'
import type { StudioMode } from '../types'

type StudioPromptBarProps = {
  disabled?: boolean
  isGenerating?: boolean
  mode: StudioMode
  onSend?: (text: string) => void
  onStop?: () => void
}

export function StudioPromptBar(props: StudioPromptBarProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const chatEnabled = props.mode === 'chat' && !props.disabled

  useEffect(() => {
    setText('')
  }, [props.mode])

  const handleSubmit = (message: PromptInputMessage) => {
    if (!chatEnabled || !props.onSend) return
    const submittableText = getSubmittableInputText(
      message,
      props.isGenerating
    )
    if (!submittableText) return
    props.onSend(submittableText)
    setText('')
  }

  return (
    <div className='grid gap-3 p-3'>
      <div className='flex flex-wrap gap-2'>
        {STUDIO_PROMPT_CHIPS[props.mode].map((chip) => (
          <Button
            key={chip}
            onClick={() => setText(t(chip))}
            size='sm'
            type='button'
            variant='outline'
          >
            {t(chip)}
          </Button>
        ))}
      </div>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          disabled={!chatEnabled || props.isGenerating}
          onChange={(event) => setText(event.target.value)}
          placeholder={t(STUDIO_PROMPT_PLACEHOLDER_KEY[props.mode])}
          value={text}
        />
        <PromptInputFooter className='justify-end'>
          {props.isGenerating && props.mode === 'chat' ? (
            <Button
              aria-label={t('Stop')}
              onClick={props.onStop}
              type='button'
              variant='outline'
            >
              <Square aria-hidden='true' />
              {t('Stop')}
            </Button>
          ) : (
            <PromptInputSubmit
              aria-label={t(STUDIO_SEND_LABEL_KEY[props.mode])}
              disabled={!chatEnabled || text.trim().length === 0}
              size='default'
            >
              {t(STUDIO_SEND_LABEL_KEY[props.mode])}
            </PromptInputSubmit>
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
