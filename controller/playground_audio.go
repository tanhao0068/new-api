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

// PlaygroundAudio 是体验中心「语音合成」模式的登录态入口（OpenAI 兼容
// `POST /pg/audio/speech`）。
//
// 与 Playground / PlaygroundImage 同构：以登录用户构造临时令牌后走标准 Relay
// （`RelayFormatOpenAIAudio`），复用既有的**鉴权、渠道选择、计费、日志**链路。
//
// 路径处理说明：平台的 relay info 已内置 `/pg` → `/v1` 前缀转换
// （relay/common/relay_info.go：`IsPlayground` 分支），因此上游请求路径自动为
// `/v1/audio/speech`；只需 `relay/constant/relay_mode.go` 的 Path2RelayMode
// 认识 `/pg/audio/speech` 即可（已登记台账）。
func PlaygroundAudio(c *gin.Context) {
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
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAIAudio, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)
	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-audio-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
		// 登录态入口不绑定具体 sk- 令牌；置为「不限额度」，
		// 实际扣费走用户钱包（与文本对话/图像/视频入口一致）。
		UnlimitedQuota: true,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	Relay(c, types.RelayFormatOpenAIAudio)
}
