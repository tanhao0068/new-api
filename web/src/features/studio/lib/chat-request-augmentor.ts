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

import { attachThinkingBudget } from './thinking-budget'

const PLAYGROUND_CHAT_PATH = '/pg/chat/completions'

export function installPlaygroundRequestAugmentor(
  augment: (body: string) => string
): () => void {
  const xhrProto = XMLHttpRequest.prototype
  const originalOpen = xhrProto.open
  const originalSend = xhrProto.send
  const urls = new WeakMap<XMLHttpRequest, string>()

  xhrProto.open = function open(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    urls.set(this, String(url))
    return originalOpen.call(
      this,
      method,
      url,
      async ?? true,
      username,
      password
    )
  }

  xhrProto.send = function send(body?: Document | XMLHttpRequestBodyInit | null) {
    const url = urls.get(this) ?? ''
    if (typeof body === 'string' && url.includes(PLAYGROUND_CHAT_PATH)) {
      return originalSend.call(this, augment(body))
    }
    return originalSend.call(this, body)
  }

  return () => {
    xhrProto.open = originalOpen
    xhrProto.send = originalSend
  }
}

export function augmentPlaygroundChatBody(
  body: string,
  model: string,
  budget: number,
  supported: boolean
): string {
  if (!supported) return body

  try {
    const parsed = JSON.parse(body) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return body
    }
    return JSON.stringify(
      attachThinkingBudget(parsed as Record<string, unknown>, model, budget)
    )
  } catch {
    return body
  }
}
