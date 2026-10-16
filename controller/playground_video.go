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
package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// 体验中心「视频生成」模式的登录态入口（三个端点）：
//
//	POST /pg/videos/generations      创建任务
//	GET  /pg/videos/:task_id         查询任务状态
//	GET  /pg/videos/:task_id/content 取视频内容
//
// 与 Playground / PlaygroundImage 同构：以登录用户构造临时令牌后走标准任务链路，
// 因此复用既有的**鉴权、插件路由、渠道选择、计费、任务持久化与后台轮询**。
// 视频是异步任务（生成耗时约 100s），故客户端按 OpenAI Videos 语义轮询。
//
// 注意：任务提交的 RelayMode（RelayModeVideoSubmit）由 middleware.PinTaskPluginEndpoint
// 在上下文设置，与请求路径无关 —— 因此这三个端点**不需要** Path2RelayMode 映射。

// setupPlaygroundTaskToken 为登录态任务请求构造临时令牌并写入上下文，
// 使任务归属到当前用户、并复用用户分组做渠道选择与计费。
func setupPlaygroundTaskToken(c *gin.Context, name string) *types.NewAPIError {
	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		return types.NewError(errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	userId := c.GetInt("id")
	// 写入用户上下文，保证 acceptUnsetRatio 等设置可用
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)
	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("%s-%s", name, relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
		// 登录态入口不绑定具体 sk- 令牌：任务预扣费会先校验令牌额度
		// （service/quota.go），故置为「不限额度」，实际扣费走用户钱包，
		// 与文本对话入口（Playground）的资金来源保持一致。
		UnlimitedQuota: true,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

// PlaygroundVideoSubmit 创建视频生成任务（登录态）
func PlaygroundVideoSubmit(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(common.UpstreamAddresses(c)...),
			})
		}
	}()
	if err := setupPlaygroundTaskToken(c, "playground-video"); err != nil {
		newAPIError = err
		return
	}
	RelayTaskPluginEndpoint(c, RelayTask)
}

// PlaygroundVideoFetch 查询视频任务状态（登录态）
func PlaygroundVideoFetch(c *gin.Context) {
	RelayTaskFetch(c)
}

// PlaygroundVideoContent 取视频内容（登录态，宿主代理转发上游产物）
func PlaygroundVideoContent(c *gin.Context) {
	VideoProxy(c)
}
