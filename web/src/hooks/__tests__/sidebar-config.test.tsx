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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import { Image, MessageSquare, Mic, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkIsActive } from '@/components/layout/lib/url-utils'
import {
  parseSidebarModulesAdmin,
  serializeSidebarModulesAdmin,
} from '@/features/system-settings/maintenance/config'
import { useAuthStore } from '@/stores/auth-store'

import { useSidebarConfig } from '../use-sidebar-config'
import { useSidebarData } from '../use-sidebar-data'

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
})

function sidebarFor(admin?: object, user?: object, canConfigure = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    SidebarModulesAdmin: admin ? JSON.stringify(admin) : '',
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: 1,
    permissions: { sidebar_settings: canConfigure },
    sidebar_modules: user ? JSON.stringify(user) : '',
  })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  const result = renderHook(
    () => useSidebarConfig(useSidebarData().navGroups),
    { wrapper: Wrapper }
  )
  return result
}

describe('security sidebar visibility', () => {
  it('old configurations show Security & Access immediately after Profile and keep API Keys', () => {
    const { result } = sidebarFor(
      { personal: { enabled: true, personal: true, topup: true } },
      { personal: { enabled: true, personal: true } }
    )
    expect(
      result.current
        .find((group) => group.id === 'personal')
        ?.items.map((item) => item.title)
    ).toEqual(['Wallet', 'Profile', 'Security & Access'])
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'API Keys')
    ).toBe(true)
  })
  it.each([
    [{ personal: { enabled: true, security: false } }, undefined],
    [{ personal: { enabled: false } }, { personal: { security: true } }],
    [undefined, { personal: { enabled: true, security: false } }],
    [undefined, { personal: { enabled: false } }],
  ])(
    'admin or user disablement hides Security & Access (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.title === 'Security & Access')
      ).toBe(false)
    }
  )
  it('users without sidebar configuration permission retain the admin view', () => {
    const { result } = sidebarFor(
      undefined,
      { personal: { security: false } },
      false
    )
    expect(
      result.current
        .flatMap((group) => group.items)
        .some((item) => item.title === 'Security & Access')
    ).toBe(true)
  })
})

describe('audit log sidebar entry', () => {
  it('admin settings default Audit Logs to visible and preserve its independent toggle when saved', () => {
    const config = parseSidebarModulesAdmin(
      '{"console":{"enabled":true,"log":true}}'
    )
    expect(config.console.audit).toBe(true)
    config.console.audit = false
    const saved = parseSidebarModulesAdmin(serializeSidebarModulesAdmin(config))
    const { result } = sidebarFor(saved)
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Audit Logs')
    expect(titles).toContain('Usage Logs')
  })

  it('legacy configurations show a separate Audit Logs link immediately after Usage Logs', () => {
    const { result } = sidebarFor(
      { console: { enabled: true, log: true } },
      { console: { enabled: true, log: true } }
    )
    const items =
      result.current.find((group) => group.id === 'general')?.items ?? []
    const usageIndex = items.findIndex((item) => item.title === 'Usage Logs')
    expect(items[usageIndex + 1]).toMatchObject({
      title: 'Audit Logs',
      url: '/usage-logs/audit',
    })
    const selected = items.filter((item) =>
      checkIsActive('/usage-logs/audit', item)
    )
    expect(selected.map((item) => item.title)).toEqual(['Audit Logs'])
  })

  it.each([
    [{ console: { enabled: true, audit: false } }, undefined],
    [{ console: { enabled: false } }, { console: { audit: true } }],
    [undefined, { console: { enabled: true, audit: false } }],
    [undefined, { console: { enabled: false } }],
  ])(
    'admin and personal visibility rules can hide Audit Logs (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      expect(
        result.current
          .flatMap((group) => group.items)
          .some((item) => item.title === 'Audit Logs')
      ).toBe(false)
    }
  )

  it('hiding Usage Logs does not hide the independently configured Audit Logs entry', () => {
    const { result } = sidebarFor({ console: { enabled: true, log: false } })
    const titles = result.current
      .flatMap((group) => group.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Usage Logs')
    expect(titles).toContain('Audit Logs')
  })
})

const STUDIO_TITLES = [
  'Text Chat',
  'Image Generation',
  'Video Generation',
  'Voice Synthesis',
] as const

describe('experience center sidebar', () => {
  it('replaces Playground and Chat with four mode entries', () => {
    const { result } = sidebarFor()
    const group = result.current.find((item) => item.id === 'chat')
    expect(group?.title).toBe('Experience Center')
    expect(group?.items.map((item) => item.title)).toEqual([...STUDIO_TITLES])
    expect(group?.items).toEqual([
      expect.objectContaining({
        title: 'Text Chat',
        url: '/studio',
        exact: true,
        icon: MessageSquare,
      }),
      expect.objectContaining({
        title: 'Image Generation',
        url: '/studio/image',
        exact: true,
        icon: Image,
      }),
      expect.objectContaining({
        title: 'Video Generation',
        url: '/studio/video',
        exact: true,
        icon: Video,
      }),
      expect.objectContaining({
        title: 'Voice Synthesis',
        url: '/studio/voice',
        exact: true,
        icon: Mic,
      }),
    ])
    const titles = result.current
      .flatMap((item) => item.items)
      .map((item) => item.title)
    expect(titles).not.toContain('Playground')
    expect(titles).not.toContain('Chat')
  })

  it('keeps the four entries when a saved config has no studio key', () => {
    const saved = { chat: { enabled: true, playground: true, chat: true } }
    expect(parseSidebarModulesAdmin(JSON.stringify(saved)).chat.studio).toBe(
      true
    )
    const { result } = sidebarFor(saved)
    expect(
      result.current
        .find((group) => group.id === 'chat')
        ?.items.map((item) => item.title)
    ).toEqual([...STUDIO_TITLES])
  })

  it.each([
    [{ chat: { enabled: true, studio: false } }, undefined],
    [{ chat: { enabled: false } }, { chat: { studio: true } }],
    [undefined, { chat: { enabled: true, studio: false } }],
    [undefined, { chat: { enabled: false } }],
  ])(
    'admin or user disablement hides every studio entry (%j, %j)',
    (admin, user) => {
      const { result } = sidebarFor(admin, user)
      const titles = result.current
        .flatMap((item) => item.items)
        .map((item) => item.title)
      for (const title of STUDIO_TITLES) {
        expect(titles).not.toContain(title)
      }
    }
  )

  it('keeps studio entries when the user cannot configure the sidebar', () => {
    const { result } = sidebarFor(undefined, { chat: { studio: false } }, false)
    expect(
      result.current
        .find((group) => group.id === 'chat')
        ?.items.map((item) => item.title)
    ).toEqual([...STUDIO_TITLES])
  })

  it('does not hide studio entries when only playground is disabled', () => {
    const { result } = sidebarFor({
      chat: { enabled: true, playground: false, studio: true },
    })
    expect(
      result.current
        .find((group) => group.id === 'chat')
        ?.items.map((item) => item.title)
    ).toEqual([...STUDIO_TITLES])
  })

  it('highlights only the mode entry that matches the current path', () => {
    const { result } = sidebarFor()
    const items = result.current.find((item) => item.id === 'chat')?.items ?? []
    expect(
      items
        .filter((item) => checkIsActive('/studio', item))
        .map((item) => item.title)
    ).toEqual(['Text Chat'])
    expect(
      items
        .filter((item) => checkIsActive('/studio/image', item))
        .map((item) => item.title)
    ).toEqual(['Image Generation'])
    expect(
      items
        .filter((item) => checkIsActive('/studio/video', item))
        .map((item) => item.title)
    ).toEqual(['Video Generation'])
    expect(
      items
        .filter((item) => checkIsActive('/studio/voice', item))
        .map((item) => item.title)
    ).toEqual(['Voice Synthesis'])
  })
})
