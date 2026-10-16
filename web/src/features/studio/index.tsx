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
import { Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import { PLAYGROUND_PARAMETER_CONTROLS } from '@/features/playground/lib/parameters/playground-parameters'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from '@/features/playground/hooks'

import { StudioChatParameterPanel } from './components/chat/studio-chat-parameter-panel'
import { StudioChatWorkspace } from './components/studio-chat-workspace'
import { StudioImagePlaceholder } from './components/studio-image-placeholder'
import { StudioLayout } from './components/studio-layout'
import { StudioPromptBar } from './components/studio-prompt-bar'
import { StudioVideoPlaceholder } from './components/studio-video-placeholder'
import { StudioVoicePlaceholder } from './components/studio-voice-placeholder'
import {
  useStudioChatAugmentor,
  useStudioModeConfig,
  useStudioThinkingBudget,
} from './hooks/use-studio-state'
import { studioModeFromPath } from './lib/studio-mode'
import { modelSupportsThinkingBudget } from './lib/thinking-budget'

export function StudioShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const mode = studioModeFromPath(pathname)
  const {
    config,
    groups,
    models,
    parameterEnabled,
    messages,
    isLoadingMessages,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    clearMessages,
  } = usePlaygroundState()
  const thinkingBudget = useStudioThinkingBudget()
  const modeConfig = useStudioModeConfig()
  const showThinkingBudget = modelSupportsThinkingBudget(config.model)

  useStudioChatAugmentor(
    config.model,
    thinkingBudget.value,
    showThinkingBudget
  )

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })
  const conversation = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat,
  })

  usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  useEffect(() => {
    for (const control of PLAYGROUND_PARAMETER_CONTROLS) {
      if (!parameterEnabled[control.key]) {
        updateParameterEnabled(control.key, true)
      }
    }
  }, [parameterEnabled, updateParameterEnabled])

  useEffect(() => {
    if (mode === 'chat') return
    if (modeConfig.configs[mode]) return
    modeConfig.update(mode, {})
  }, [mode, modeConfig.configs, modeConfig.update])

  const handleClearSession = () => {
    conversation.handleEditOpenChange(false)
    clearMessages()
  }

  let workspace = <StudioChatWorkspace
    editingMessageKey={conversation.editingMessageKey}
    isGenerating={isGenerating}
    isLoadingMessages={isLoadingMessages}
    messages={messages}
    onCancelEdit={conversation.handleEditOpenChange}
    onDeleteMessage={conversation.handleDeleteMessage}
    onEditMessage={conversation.handleEditMessage}
    onRegenerateMessage={conversation.handleRegenerateMessage}
    onSaveEdit={(newContent) => conversation.applyEdit(newContent, false)}
    onSaveEditAndSubmit={(newContent) => conversation.applyEdit(newContent, true)}
  />
  if (mode === 'image') workspace = <StudioImagePlaceholder />
  if (mode === 'video') workspace = <StudioVideoPlaceholder />
  if (mode === 'voice') workspace = <StudioVoicePlaceholder />

  const parameterPanel =
    mode === 'chat' ? (
      <StudioChatParameterPanel
        config={config}
        disabled={isGenerating}
        groups={groups}
        models={models}
        onClearSession={handleClearSession}
        onConfigChange={updateConfig}
        onGroupChange={(value) => updateConfig('group', value)}
        onModelChange={(value) => updateConfig('model', value)}
        onParameterEnabledChange={updateParameterEnabled}
        onThinkingBudgetChange={thinkingBudget.setValue}
        showThinkingBudget={showThinkingBudget}
        thinkingBudget={thinkingBudget.value}
      />
    ) : null

  return (
    <>
      <StudioLayout
        mode={mode}
        modelName={config.model}
        parameterPanel={parameterPanel}
        prompt={
          <StudioPromptBar
            isGenerating={isGenerating}
            mode={mode}
            onSend={
              mode === 'chat' ? conversation.handleSendMessage : undefined
            }
            onStop={stopGeneration}
          />
        }
        workspace={workspace}
      />
      <Outlet />
    </>
  )
}
