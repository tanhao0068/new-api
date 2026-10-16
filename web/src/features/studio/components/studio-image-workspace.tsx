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
import { Download, ImageOff, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import type { StudioImageState } from '../types'

type StudioImageWorkspaceProps = {
  onRegenerate: () => void
  state: StudioImageState
}

/** 图像生成工作区：空闲提示 / 生成中 / 结果（元信息 + 下载 + 再生成）/ 失败 */
export function StudioImageWorkspace(props: StudioImageWorkspaceProps) {
  const { t } = useTranslation()
  const { state } = props

  if (state.status === 'generating') {
    return (
      <div className='text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-6 text-sm'>
        <Spinner />
        <p>{t('Generating...')}</p>
        {state.prompt ? (
          <p className='max-w-md truncate text-xs'>{state.prompt}</p>
        ) : null}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
        <ImageOff aria-hidden='true' className='text-destructive size-8' />
        <p className='text-sm font-medium'>{t('Image generation failed')}</p>
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
      <div className='flex h-full min-h-0 flex-col items-center gap-3 overflow-y-auto p-4'>
        <img
          alt={state.prompt ?? ''}
          className='max-h-[70%] max-w-full rounded-lg border object-contain shadow-sm'
          src={state.url}
        />
        <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs'>
          {state.size ? <span>{state.size}</span> : null}
          {typeof state.seed === 'number' ? (
            <span>
              {t('Seed')}: {state.seed}
            </span>
          ) : null}
          {typeof state.elapsed === 'number' ? (
            <span>{state.elapsed.toFixed(1)}s</span>
          ) : null}
          <a
            className='text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline'
            download
            href={state.url}
            rel='noreferrer'
            target='_blank'
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
      {t('Describe the image you want to generate...')}
    </div>
  )
}
