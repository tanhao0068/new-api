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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { StudioLayout } from '../components/studio-layout'
import { StudioPlaceholder } from '../components/studio-placeholder'

const originalInnerWidth = window.innerWidth

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
})

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

async function renderLayout(ui: ReactElement) {
  const root = createRootRoute({ component: () => ui })
  const settings = createRoute({
    getParentRoute: () => root,
    path: '/system-settings/site',
    component: () => null,
  })
  const router = createRouter({
    routeTree: root.addChildren([settings]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByText(
    'Online experience incurs usage-based fees'
  )
}

test('desktop layout shows the mode title, billing hint, and a fixed parameter column', async () => {
  setWidth(1280)

  await renderLayout(
    <StudioLayout
      mode='chat'
      modelName='gpt-4o'
      parameterPanel={<p>Temperature control</p>}
      prompt={<p>Prompt</p>}
      workspace={<p>Messages</p>}
    />
  )

  expect(screen.getByRole('heading', { name: 'Text Chat' })).toBeVisible()
  expect(screen.getByText('gpt-4o')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'System Settings' })
  ).toHaveAttribute('href', '/system-settings/site')
  expect(screen.getByText('Temperature control')).toBeVisible()
  expect(screen.getByText('Messages')).toBeVisible()
  expect(screen.getByRole('complementary')).toHaveClass('w-80')
})

test('narrow layout opens the parameter panel in a drawer and closes it from the overlay', async () => {
  setWidth(390)
  const user = userEvent.setup()

  await renderLayout(
    <SidebarProvider>
      <StudioLayout
        mode='image'
        modelName='flux'
        parameterPanel={<p>Image size</p>}
        prompt={<p>Prompt</p>}
        workspace={<StudioPlaceholder mode='image' />}
      />
    </SidebarProvider>
  )

  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open menu' })).toBeVisible()

  const parametersButton = screen.getByRole('button', { name: 'Parameters' })
  expect(parametersButton).toHaveAttribute('aria-expanded', 'false')
  await user.click(parametersButton)

  expect(parametersButton).toHaveAttribute('aria-expanded', 'true')
  expect(
    screen.getAllByRole('heading', { name: 'Image Generation' })
  ).toHaveLength(2)
  expect(screen.getByText('Image size')).toBeVisible()
  expect(screen.getByText('Coming soon')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Close' }))

  expect(parametersButton).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('workspace wrapper is a bounded flex column so the conversation can scroll', async () => {
  // BUG-20261016-01：Conversation 的根样式是 `min-h-0 flex-1 overflow-hidden`，
  // 必须作为 flex 纵向容器的子项才有有界高度。jsdom 无布局引擎，故断言结构契约。
  setWidth(1280)

  await renderLayout(
    <StudioLayout
      mode='chat'
      modelName='gpt-4o'
      parameterPanel={<p>Temperature control</p>}
      prompt={<p>Prompt</p>}
      workspace={<p>Messages</p>}
    />
  )

  const wrapper = screen.getByText('Messages').parentElement as HTMLElement
  const tokens = wrapper.className.split(/\s+/)

  expect(tokens).toContain('flex')
  expect(tokens).toContain('flex-col')
  expect(tokens).toContain('min-h-0')
  expect(tokens).toContain('flex-1')
  expect(tokens).toContain('overflow-hidden')
})
