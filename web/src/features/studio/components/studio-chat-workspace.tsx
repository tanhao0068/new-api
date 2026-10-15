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

import { PlaygroundChat } from '@/features/playground/components/chat/playground-chat'
import type { Message } from '@/features/playground/types'

type StudioChatWorkspaceProps = {
  editingMessageKey: string | null
  isGenerating: boolean
  isLoadingMessages: boolean
  messages: Message[]
  onCancelEdit: (open: boolean) => void
  onDeleteMessage: (message: Message) => void
  onEditMessage: (message: Message) => void
  onRegenerateMessage: (message: Message) => void
  onSaveEdit: (newContent: string) => void
  onSaveEditAndSubmit: (newContent: string) => void
}

export function StudioChatWorkspace(props: StudioChatWorkspaceProps) {
  const { t } = useTranslation()

  if (!props.isLoadingMessages && props.messages.length === 0) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm'>
        {t('Select a model to start chatting')}
      </div>
    )
  }

  return (
    <PlaygroundChat
      editingKey={props.editingMessageKey}
      isGenerating={props.isGenerating}
      isLoadingMessages={props.isLoadingMessages}
      messages={props.messages}
      onCancelEdit={props.onCancelEdit}
      onDeleteMessage={props.onDeleteMessage}
      onEditMessage={props.onEditMessage}
      onRegenerateMessage={props.onRegenerateMessage}
      onSaveEdit={props.onSaveEdit}
      onSaveEditAndSubmit={props.onSaveEditAndSubmit}
    />
  )
}
