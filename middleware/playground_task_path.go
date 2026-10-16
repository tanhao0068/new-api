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
along with this program. If not, see <http://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// PlaygroundTaskOriginalPathKey 保存被改写前的原始请求路径（用于日志与排查）。
const PlaygroundTaskOriginalPathKey = "playground_task_original_path"

// RewriteTaskEndpointPath 把体验中心「登录态任务端点」的路径改写为平台插件端点
// **已注册的规范路径**（`/v1/videos`、`/v1/videos/:task_id`、`/v1/videos/:task_id/content`）。
//
// 为什么需要：平台的任务插件端点解析（PinTaskPluginEndpoint → pkg/jsplugin 的
// hostProtocols 路径表）、relayMode 检测、以及 distributor 的
// `expected_task_plugin_key` 身份过滤，**全部按请求路径解析**：
//   - 路径不在注册表中 → 插件无法 pin → `expected_task_plugin_key` 为空 →
//     identity 过滤会**拒绝 type-61（任务插件）渠道**，请求以
//     `No available channel` 收场。
//
// 因此登录态入口（`/pg/videos*`，用于前端 SPA 的场景：SPA 持有的是会话而非 sk- 令牌）
// 在进入上述中间件前先把路径改写为规范路径复用同一套解析逻辑，
// 从而**无需改动上游的核心路由/注册表**。原始路径记录在上下文中备查。
//
// 注意：改写只影响 URL 路径匹配；客户端实际请求的仍是 `/pg/videos*`，
// 且鉴权仍由 UserAuth 完成（不使用 TokenAuth）。
func RewriteTaskEndpointPath(canonicalPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		original := c.Request.URL.Path
		target := canonicalPath
		if strings.Contains(target, ":task_id") {
			taskID := c.Param("task_id")
			if taskID == "" {
				c.Next()
				return
			}
			target = strings.ReplaceAll(target, ":task_id", taskID)
		}
		c.Set(PlaygroundTaskOriginalPathKey, original)
		c.Request.URL.Path = target
		c.Next()
	}
}
