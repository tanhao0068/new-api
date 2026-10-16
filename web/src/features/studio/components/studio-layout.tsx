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
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { STUDIO_MODE_TITLE_KEY, STUDIO_NARROW_BREAKPOINT } from '../constants'
import type { StudioMode } from '../types'
import { StudioTopBar } from './studio-top-bar'

type StudioLayoutProps = {
  mode: StudioMode
  modelName: string
  parameterPanel: ReactNode
  prompt: ReactNode
  workspace: ReactNode
}

export function StudioLayout(props: StudioLayoutProps) {
  const { t } = useTranslation()
  const [narrow, setNarrow] = useState(
    () => window.innerWidth < STUDIO_NARROW_BREAKPOINT
  )
  const [parametersOpen, setParametersOpen] = useState(false)
  const title = t(STUDIO_MODE_TITLE_KEY[props.mode])

  useEffect(() => {
    const onResize = () => {
      setNarrow(window.innerWidth < STUDIO_NARROW_BREAKPOINT)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!narrow) setParametersOpen(false)
  }, [narrow])

  const panel = (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='border-b px-4 py-3'>
        <h2 className='text-sm font-semibold'>{title}</h2>
      </div>
      <div className='min-h-0 flex-1'>{props.parameterPanel}</div>
    </div>
  )

  return (
    <div className='flex h-full min-h-0 w-full'>
      {narrow ? null : (
        <aside
          aria-label={title}
          className='flex w-80 shrink-0 flex-col border-r bg-[#f8f7ff] dark:bg-background'
        >
          {panel}
        </aside>
      )}
      <section className='flex min-h-0 min-w-0 flex-1 flex-col'>
        <StudioTopBar
          modelName={props.modelName}
          narrow={narrow}
          onOpenParameters={() => setParametersOpen(true)}
          parametersOpen={parametersOpen}
        />
        {/* 与官方 playground 页面同构：workspace 必须是 flex 纵向容器。
            Conversation 的根样式为 `relative min-h-0 flex-1 overflow-hidden`，
            只有作为 flex item 才能获得有界高度；否则高度随内容无限增长，
            再被 overflow-hidden 裁掉 → 对话框无法滚动、后续会话不可见。
            （BUG-20261015-05） */}
        <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          {props.workspace}
        </div>
        <div className='shrink-0 border-t'>{props.prompt}</div>
      </section>
      {narrow ? (
        <Sheet onOpenChange={setParametersOpen} open={parametersOpen}>
          <SheetContent
            className='w-80 p-0 sm:max-w-none'
            showCloseButton
            side='left'
          >
            <SheetHeader className='sr-only'>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className='h-full bg-[#f8f7ff] dark:bg-background'>{panel}</div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}
