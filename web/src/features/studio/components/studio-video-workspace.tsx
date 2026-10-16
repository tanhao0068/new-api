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
import { Download, RefreshCw, VideoOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import type { StudioVideoState } from '../types'

type StudioVideoWorkspaceProps = {
  onRegenerate: () => void
  state: StudioVideoState
}

/** 视频生成工作区：空闲 / 提交 / 排队与生成中（进度）/ 结果（播放+下载）/ 失败 */
export function StudioVideoWorkspace(props: StudioVideoWorkspaceProps) {
  const { t } = useTranslation()
  const { state } = props

  if (state.status === 'submitting' || state.status === 'generating') {
    const progress = state.progress
    return (
      <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-sm'>
        <Spinner />
        <p>
          {state.status === 'submitting'
            ? t('Submitting...')
            : t('Generating...')}
          {state.status === 'generating' && typeof progress === 'number'
            ? ` ${progress}%`
            : ''}
        </p>
        {state.prompt ? (
          <p className='max-w-md truncate text-xs'>{state.prompt}</p>
        ) : null}
        {state.taskId ? (
          <p className='text-[10px] break-all opacity-60'>{state.taskId}</p>
        ) : null}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
        <VideoOff aria-hidden='true' className='text-destructive size-8' />
        <p className='text-sm font-medium'>{t('Video generation failed')}</p>
        <p className='text-muted-foreground max-w-md text-xs break-all'>
          {state.error}
        </p>
        <Button onClick={props.onRegenerate} type='button' variant='outline'>
          <RefreshCw aria-hidden='true' />
          {t('Regenerate')}
        </Button>
      </div>
    )
  }

  if (state.status === 'success' && state.url) {
    return (
      <div className='flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto p-4'>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          className='max-h-[70%] max-w-full rounded-lg border bg-black'
          controls
          preload='metadata'
          src={state.url}
        />
        <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs'>
          <a
            className='text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline'
            download
            href={state.url}
          >
            <Download aria-hidden='true' className='size-3.5' />
            {t('Download')}
          </a>
          <Button
            onClick={props.onRegenerate}
            size='sm'
            type='button'
            variant='ghost'
          >
            <RefreshCw aria-hidden='true' />
            {t('Regenerate')}
          </Button>
        </div>
        {state.prompt ? (
          <p className='text-muted-foreground max-w-2xl text-center text-xs'>
            {state.prompt}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm'>
      {t('Describe the video you want to generate...')}
    </div>
  )
}
