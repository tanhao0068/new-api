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
import { Globe, Paperclip, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ATTACHMENT_ACTIONS,
  getAttachmentActionNotice,
  getSearchActionNotice,
} from '@/features/playground/lib/input/input-tool-utils'
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

  // 与官方 playground 输入区同源：附件动作与联网搜索在当前版本为占位提示
  // （官方实现即 ATTACHMENT_ACTIONS + getAttachmentActionNotice → toast，文案完全复用）
  const handleFileAction = (action: string) => {
    const notice = getAttachmentActionNotice(action)
    toast.info(t(notice.title), { description: notice.description })
  }

  const handleSearchAction = () => {
    const notice = getSearchActionNotice()
    toast.info(t(notice.title))
  }

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
        <PromptInputFooter>
          {/* 工具行：附件菜单 + 联网搜索 —— 与官方 playground 输入区同一套动作、
              同一套常量与提示文案（避免两处实现漂移） */}
          <TooltipProvider>
            <PromptInputTools className='bg-background/70 border-border/60 rounded-lg border p-1 shadow-xs'>
              <Tooltip>
                <DropdownMenu>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        render={
                          <PromptInputButton
                            aria-label={t('Attach')}
                            className='text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
                            disabled={!chatEnabled}
                            variant='ghost'
                          />
                        }
                      >
                        <Paperclip aria-hidden='true' size={16} />
                      </DropdownMenuTrigger>
                    }
                  />
                  <TooltipContent>
                    <p>{t('Attach')}</p>
                  </TooltipContent>
                  <DropdownMenuContent align='start'>
                    {ATTACHMENT_ACTIONS.map(({ action, icon: Icon, label }) => (
                      <DropdownMenuItem
                        key={action}
                        onClick={() => handleFileAction(action)}
                      >
                        <Icon aria-hidden='true' className='mr-2' size={16} />
                        {t(label)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <PromptInputButton
                      aria-label={t('Search')}
                      className='text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
                      disabled={!chatEnabled}
                      onClick={handleSearchAction}
                      variant='ghost'
                    >
                      <Globe aria-hidden='true' size={16} />
                    </PromptInputButton>
                  }
                />
                <TooltipContent>
                  <p>{t('Search')}</p>
                </TooltipContent>
              </Tooltip>
            </PromptInputTools>
          </TooltipProvider>

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
