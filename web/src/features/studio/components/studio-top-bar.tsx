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
import { Link } from '@tanstack/react-router'
import { Settings, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'

type StudioTopBarProps = {
  modelName: string
  narrow: boolean
  onOpenParameters: () => void
  parametersOpen: boolean
}

/**
 * 体验中心顶栏：三段式布局（2026-10-16 老板指令）
 *
 *   [ 当前模型（居左） ]   [ 收费提示（居中·胶囊） ]   [ 系统设置（居右） ]
 *
 * 模型名与收费提示是**相互独立的两块**：模型名居左，收费提示以琥珀色胶囊居中，
 * 右侧为系统设置入口。网格左右两列等宽（各 1fr），中间列因而在视觉上真正居中。
 * 收费提示采用原型的胶囊样式（琥珀色文字 + 半透明底 + 圆角）。
 */
export function StudioTopBar(props: StudioTopBarProps) {
  const { t } = useTranslation()
  const modelName = props.modelName.trim() || t('No model selected')

  return (
    <header
      className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 border-b px-3 py-2'
      data-testid='studio-top-bar'
    >
      {/* 左：导航按钮（窄屏）+ 当前模型 */}
      <div className='flex min-w-0 items-center gap-2'>
        {props.narrow ? (
          <div className='flex shrink-0 items-center gap-1'>
            <SidebarTrigger aria-label={t('Open menu')} />
            <Button
              aria-expanded={props.parametersOpen}
              aria-label={t('Parameters')}
              onClick={props.onOpenParameters}
              size='icon-sm'
              type='button'
              variant='ghost'
            >
              <SlidersHorizontal aria-hidden='true' />
            </Button>
          </div>
        ) : null}
        <div className='flex min-w-0 items-center gap-2'>
          <span
            aria-hidden='true'
            className='bg-emerald-500 size-2 shrink-0 rounded-full'
          />
          <span className='truncate text-sm font-medium'>{modelName}</span>
        </div>
      </div>

      {/* 中：收费提示（居中）；「模型详情」链接一期隐藏，故文案不提示「详见 模型详情」 */}
      <div
        className='flex min-w-0 items-center justify-center'
        data-testid='studio-billing-hint'
      >
        <p className='text-amber-600 dark:text-amber-400 bg-amber-500/10 inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs'>
          <TriangleAlert aria-hidden='true' className='size-3.5 shrink-0' />
          <span className='truncate'>
            {t('Online experience incurs usage-based fees')}
          </span>
        </p>
      </div>

      {/* 右：系统设置 */}
      <div className='flex min-w-0 items-center justify-end'>
        <Button
          aria-label={t('System Settings')}
          render={<Link to='/system-settings/site' />}
          size='icon-sm'
          variant='ghost'
        >
          <Settings aria-hidden='true' />
        </Button>
      </div>
    </header>
  )
}
