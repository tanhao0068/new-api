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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import type { NavLink } from '../../types'
import { NavGroup } from '../nav-group'

const STUDIO_ITEMS: NavLink[] = [
  { title: 'Text Chat', url: '/studio', exact: true },
  { title: 'Image Generation', url: '/studio/image', exact: true },
  { title: 'Video Generation', url: '/studio/video', exact: true },
  { title: 'Voice Synthesis', url: '/studio/voice', exact: true },
]

afterEach(() => {
  cleanup()
})

async function renderNav(path: string, items: NavLink[]) {
  const root = createRootRoute({
    component: () => (
      <SidebarProvider>
        <NavGroup title='Menu' items={items} />
      </SidebarProvider>
    ),
  })
  const routes = [
    '/studio',
    '/studio/image',
    '/studio/video',
    '/studio/voice',
    '/usage-logs',
    '/usage-logs/common',
    '/usage-logs/drawing',
    '/usage-logs/task',
    '/system-settings',
    '/system-settings/billing',
  ].map((routePath) =>
    createRoute({
      getParentRoute: () => root,
      path: routePath,
      component: () => null,
    })
  )
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('link', { name: items[0]?.title })
}

function activeLinkNames() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent)
}

test.each([
  ['/studio', 'Text Chat'],
  ['/studio/image', 'Image Generation'],
  ['/studio/video', 'Video Generation'],
  ['/studio/voice', 'Voice Synthesis'],
])(
  'on %s only the exact experience-center item %s is current',
  async (path, title) => {
    await renderNav(path, STUDIO_ITEMS)

    expect(activeLinkNames()).toEqual([title])
    expect(screen.getByRole('link', { name: title })).toHaveAttribute(
      'data-active',
      ''
    )
    for (const item of STUDIO_ITEMS) {
      if (item.title === title) continue
      expect(
        screen.getByRole('link', { name: item.title })
      ).not.toHaveAttribute('data-active')
    }
  }
)

test('a menu item without exact stays active on a child path', async () => {
  await renderNav('/usage-logs/common', [
    { title: 'Usage Logs', url: '/usage-logs' },
    { title: 'Audit Logs', url: '/usage-logs/audit' },
  ])

  expect(activeLinkNames()).toEqual(['Usage Logs'])
})

test('activeUrls still activates an item whose own path does not match', async () => {
  await renderNav('/usage-logs/drawing', [
    {
      title: 'Task Logs',
      url: '/usage-logs/task',
      activeUrls: ['/usage-logs/drawing'],
    },
    { title: 'Usage Logs', url: '/usage-logs' },
  ])

  const taskLogs = screen.getByRole('link', { name: 'Task Logs' })
  expect(taskLogs).toHaveAttribute('data-active', '')
  expect(taskLogs).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('link', { name: 'Usage Logs' })).toHaveAttribute(
    'aria-current',
    'page'
  )
})
