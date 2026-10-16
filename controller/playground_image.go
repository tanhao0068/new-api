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

// PlaygroundImage 是体验中心「图像生成」模式的登录态入口。
//
// 与 Playground（文本对话）同构：以登录用户构造临时令牌后走标准 Relay，
// 因此复用既有的**鉴权、渠道选择、计费、日志**链路 —— 不新增计费路径，
// 也不需要用户在前端持有 sk- 令牌。
//
// 与 Playground 的唯一区别是 RelayFormat 为 RelayFormatOpenAIImage，
// 请求体按 OpenAI Images 接口校验（helper.GetAndValidOpenAIImageRequest），
// 因而路由 /pg/images/generations 必须在 relay/constant.Path2RelayMode 中
// 映射为 RelayModeImagesGenerations（见该文件。
//
// 备注：本函数仅走普通渠道（含本项目的自建 ComfyUI 适配器渠道）；
// 由任务插件认领的图像模型当前不经此入口（插件端点仍由 /v1 提供）。
func PlaygroundImage(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(common.UpstreamAddresses(c)...),
			})
		}
	}()
	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIImage, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	userId := c.GetInt("id")
	// 写入用户上下文，保证 acceptUnsetRatio 等设置可用
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)
	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-image-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	Relay(c, types.RelayFormatOpenAIImage)
}
