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
import { useCallback, useEffect, useState } from 'react'

import { PLAYGROUND_PARAMETER_CONTROLS } from '@/features/playground/lib/parameters/playground-parameters'
import {
  useChatHandler,
  usePlaygroundConversation,
  usePlaygroundOptions,
  usePlaygroundState,
} from '@/features/playground/hooks'

import { StudioChatParameterPanel } from './components/chat/studio-chat-parameter-panel'
import { StudioChatWorkspace } from './components/studio-chat-workspace'
import { StudioImageParameterPanel } from './components/image/studio-image-parameter-panel'
import { StudioImageWorkspace } from './components/studio-image-workspace'
import { StudioLayout } from './components/studio-layout'
import { StudioPromptBar } from './components/studio-prompt-bar'
import { StudioVideoPlaceholder } from './components/studio-video-placeholder'
import { StudioVoicePlaceholder } from './components/studio-voice-placeholder'
import {
  STUDIO_IMAGE_DEFAULT_MODEL,
  STUDIO_IMAGE_DEFAULT_SIZE,
} from './constants'
import {
  useStudioChatAugmentor,
  useStudioModeConfig,
  useStudioThinkingBudget,
} from './hooks/use-studio-state'
import { generateStudioImage, toImageErrorMessage } from './lib/image-request'
import { studioModeFromPath } from './lib/studio-mode'
import { modelSupportsThinkingBudget } from './lib/thinking-budget'
import type { StudioImageState } from './types'

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
  const [imageState, setImageState] = useState<StudioImageState>({
    status: 'idle',
  })
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

  // 图像生成：登录态请求 /pg/images/generations（与文本对话同族的服务端入口），
  // 参数取自图像模式面板（Image Size / Seed / Negative Prompt），按模式独立记忆。
  const runImageGeneration = useCallback(
    async (prompt: string) => {
      const imageConfig = (modeConfig.configs.image ??
        {}) as Record<string, unknown>
      const size =
        typeof imageConfig.image_size === 'string'
          ? imageConfig.image_size
          : STUDIO_IMAGE_DEFAULT_SIZE
      const rawSeed = imageConfig.seed
      const seed =
        typeof rawSeed === 'string' && rawSeed.trim() !== ''
          ? Number(rawSeed)
          : typeof rawSeed === 'number'
            ? rawSeed
            : undefined
      const negativePrompt =
        typeof imageConfig.negative_prompt === 'string'
          ? imageConfig.negative_prompt
          : undefined
      // 图像模式使用自有模型（不共用文本对话的 config.model）
      const model =
        typeof imageConfig.model === 'string' &&
        imageConfig.model.trim() !== ''
          ? imageConfig.model.trim()
          : STUDIO_IMAGE_DEFAULT_MODEL

      setImageState({ status: 'generating', prompt, size })
      try {
        const result = await generateStudioImage({
          model,
          prompt,
          size,
          seed,
          negativePrompt,
        })
        setImageState({
          status: 'success',
          url: result.url,
          prompt,
          size,
          seed: result.seed,
          elapsed: result.elapsed,
        })
      } catch (error) {
        setImageState({
          status: 'error',
          prompt,
          size,
          error: toImageErrorMessage(error),
        })
      }
    },
    [modeConfig.configs.image]
  )

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
  if (mode === 'image')
    workspace = (
      <StudioImageWorkspace
        onRegenerate={() => {
          if (imageState.prompt) void runImageGeneration(imageState.prompt)
        }}
        state={imageState}
      />
    )
  if (mode === 'video') workspace = <StudioVideoPlaceholder />
  if (mode === 'voice') workspace = <StudioVoicePlaceholder />

  const parameterPanel =
    mode === 'image' ? (
      <StudioImageParameterPanel
        config={config}
        disabled={imageState.status === 'generating'}
        groups={groups}
        imageConfig={(modeConfig.configs.image ?? {}) as Record<string, unknown>}
        models={models}
        onConfigChange={updateConfig}
        onGroupChange={(value) => updateConfig('group', value)}
        onImageConfigChange={(patch) => modeConfig.update('image', patch)}
        onModelChange={(value) => modeConfig.update('image', { model: value })}
      />
    ) : mode === 'chat' ? (
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
            isGenerating={
              mode === 'image' ? imageState.status === 'generating' : isGenerating
            }
            mode={mode}
            onImageSubmit={
              mode === 'image'
                ? (text) => {
                    void runImageGeneration(text)
                  }
                : undefined
            }
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
