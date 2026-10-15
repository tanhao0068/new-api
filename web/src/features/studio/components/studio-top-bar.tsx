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

export function StudioTopBar(props: StudioTopBarProps) {
  const { t } = useTranslation()
  const modelName = props.modelName.trim() || t('No model selected')

  return (
    <header className='flex min-w-0 items-center gap-2 border-b px-3 py-2'>
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
      <p className='text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-xs'>
        <TriangleAlert aria-hidden='true' className='size-3.5 shrink-0' />
        <span className='truncate'>
          {t(
            'Online experience incurs usage-based fees, see Model Details'
          )}
        </span>
      </p>
      <Button
        aria-label={t('System Settings')}
        render={<Link to='/system-settings/site' />}
        size='icon-sm'
        variant='ghost'
      >
        <Settings aria-hidden='true' />
      </Button>
    </header>
  )
}
