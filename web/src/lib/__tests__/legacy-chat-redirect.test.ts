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
import { isRedirect } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { Route as ChatIndexRoute } from '@/routes/_authenticated/chat/index'
import { Route as ChatLayoutRoute } from '@/routes/_authenticated/chat/route'
import { Route as Chat2LinkRoute } from '@/routes/_authenticated/chat2link'

const TARGET = '/studio/chat'

/**
 * REQ-009 / AC-12：旧聊天入口（/chat、/chat/$chatId、/chat2link）必须重定向到
 * 体验中心文本对话 /studio/chat。此前这些路由未重定向（/chat 直接 404、
 * /chat2link 跳到第三方预览站），见 docs/bugs/BUG-20261015-03.md。
 */
describe('legacy chat routes redirect to the experience center text chat', () => {
  const cases = [
    ['/chat（子树守卫）', ChatLayoutRoute],
    ['/chat（叶子）', ChatIndexRoute],
    ['/chat2link', Chat2LinkRoute],
  ] as const

  it.each(cases)('%s：beforeLoad 抛出重定向', (_label, route) => {
    const beforeLoad = route.options.beforeLoad
    expect(typeof beforeLoad).toBe('function')

    let thrown: unknown
    try {
      // TanStack Router 的 redirect() 由调用方 throw 出，beforeLoad 即负责抛出
      ;(beforeLoad as () => unknown)()
    } catch (error) {
      thrown = error
    }

    // TanStack Router 的 redirect() 返回带 .options 的 Response（isRedirect 为其判据）
    expect(thrown, 'beforeLoad 必须抛出重定向').toBeTruthy()
    expect(isRedirect(thrown)).toBe(true)
    const options = (thrown as Response & { options?: { to?: string } }).options
    expect(options?.to).toBe(TARGET)
  })

  it('不再解析第三方聊天客户端（旧 Chat2Link 组件已移除）', () => {
    // 路由不提供 component，避免任何第三方站点跳转
    expect(Chat2LinkRoute.options.component).toBeUndefined()
  })
})
