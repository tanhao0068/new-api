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
import type { LucideIcon } from 'lucide-react'
import { Image as ImageIcon, Mic, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { STUDIO_MODE_TITLE_KEY, STUDIO_PLACEHOLDER_DESCRIPTION_KEY } from '../constants'
import type { StudioGenerationMode } from '../types'

const PLACEHOLDER_ICON: Record<StudioGenerationMode, LucideIcon> = {
  image: ImageIcon,
  video: Video,
  voice: Mic,
}

export function StudioPlaceholder(props: { mode: StudioGenerationMode }) {
  const { t } = useTranslation()
  const Icon = PLACEHOLDER_ICON[props.mode]

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
      <Icon aria-hidden='true' className='text-muted-foreground size-14' />
      <Badge variant='secondary'>{t('Coming soon')}</Badge>
      <h2 className='text-lg font-semibold'>
        {t(STUDIO_MODE_TITLE_KEY[props.mode])}
      </h2>
      <p className='text-muted-foreground max-w-md text-sm leading-6'>
        {t(STUDIO_PLACEHOLDER_DESCRIPTION_KEY[props.mode])}
      </p>
    </div>
  )
}
