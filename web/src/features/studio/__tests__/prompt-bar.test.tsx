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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { info: toastInfo, success: vi.fn() },
}))

import { ATTACHMENT_ACTIONS } from '@/features/playground/lib/input/input-tool-utils'

import { StudioPromptBar } from '../components/studio-prompt-bar'

/**
 * 官方 playground 输入区的附件菜单在 studio 页面此前完全缺失
 * （见 docs/bugs/BUG-20261015-07.md）。此处断言工具行存在且动作与官方同源。
 */
test('the input tools row exposes the same attachment actions as the playground', async () => {
  const user = userEvent.setup()

  render(<StudioPromptBar mode='chat' onSend={vi.fn()} onStop={vi.fn()} />)

  // 附件与联网搜索按钮（与 playground 输入区同源）
  const attachButton = screen.getByRole('button', { name: 'Attach' })
  const searchButton = screen.getByRole('button', { name: 'Search' })
  expect(attachButton).toBeEnabled()
  expect(searchButton).toBeEnabled()

  // 菜单项与官方 ATTACHMENT_ACTIONS 一一对应，且文案复用官方词条
  await user.click(attachButton)
  for (const { label } of ATTACHMENT_ACTIONS) {
    expect(await screen.findByText(label)).toBeInTheDocument()
  }

  // 当前版本为占位提示（与官方行为一致：toast「Feature in development」+ 动作名）
  await user.click(screen.getByText(ATTACHMENT_ACTIONS[0].label))
  expect(toastInfo).toHaveBeenCalledWith('Feature in development', {
    description: ATTACHMENT_ACTIONS[0].action,
  })
})

test('the tools row is disabled outside the chat mode', () => {
  render(<StudioPromptBar mode='image' onSend={vi.fn()} onStop={vi.fn()} />)

  expect(screen.getByRole('button', { name: 'Attach' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
})
