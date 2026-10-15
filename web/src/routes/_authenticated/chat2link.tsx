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
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/chat2link')({
  beforeLoad: () => {
    // REQ-009 / AC-12：原第三方聊天客户端聚合跳转页（Cherry Studio / Lobe Chat 等）功能已移除，
    // 直接重定向到体验中心文本对话，不再解析 presets 或跳转外部站点。
    throw redirect({ to: '/studio/chat', replace: true })
  },
})
