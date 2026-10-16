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
import { Download, MicOff, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import type { StudioVoiceState } from '../types'

type StudioVoiceWorkspaceProps = {
  onRegenerate: () => void
  state: StudioVoiceState
}

/** 语音合成工作区：空闲 / 合成中 / 结果（试听 + 下载 + 再生成）/ 失败 */
export function StudioVoiceWorkspace(props: StudioVoiceWorkspaceProps) {
  const { t } = useTranslation()
  const { state } = props

  if (state.status === 'synthesizing') {
    return (
      <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-sm'>
        <Spinner />
        <p>{t('Synthesizing...')}</p>
        <p className='max-w-md text-center text-xs'>
          {state.voice} · {t('Speed')} {state.speed}
          {typeof state.volumeGain === 'number' && state.volumeGain !== 0
            ? ` · ${state.volumeGain > 0 ? '+' : ''}${state.volumeGain} dB`
            : ''}
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
        <MicOff aria-hidden='true' className='text-destructive size-8' />
        <p className='text-sm font-medium'>{t('Voice synthesis failed')}</p>
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
      <div className='flex h-full min-h-0 flex-col items-center justify-center gap-4 px-6 py-8'>
        {/* 音频为带鉴权取回的 object URL */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio className='w-full max-w-xl' controls src={state.url} />
        <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs'>
          {state.voice ? <span>{state.voice}</span> : null}
          {typeof state.speed === 'number' ? (
            <span>
              {t('Speed')} {state.speed}
            </span>
          ) : null}
          {typeof state.volumeGain === 'number' && state.volumeGain !== 0 ? (
            <span>
              {t('Volume Gain')} {state.volumeGain > 0 ? '+' : ''}
              {state.volumeGain} dB
            </span>
          ) : null}
          {typeof state.elapsed === 'number' ? (
            <span>{state.elapsed.toFixed(1)}s</span>
          ) : null}
          <a
            className='text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline'
            download='speech.mp3'
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
        {state.text ? (
          <p className='text-muted-foreground max-w-2xl text-center text-xs'>
            {state.text}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className='text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm'>
      {t('Enter the text to synthesize...')}
    </div>
  )
}
