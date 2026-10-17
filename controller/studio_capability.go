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
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// StudioModelCapabilitiesOptionKey 是「体验中心模型类型」登记表在 options 表中的键。
//
// 存储格式（JSON 对象）：{"模型名": "text|image|video|voice"}
// 管理后台通过既有通用接口维护：
//   - 读：GET  /api/option/         （管理员，键名即本常量）
//   - 写：PUT  /api/option/         （管理员，{"key":"studio.model_capabilities","value":"{...}"}）
//
// 该表在体验中心的作用：模型选择区按模式（文本/图像/视频/语音）过滤时，
// **本表优先级最高**；未登记的模型退回「平台端点类型 → 名称关键字」自动推断，
// 因此新接入的模型即使不登记也能用（名称可判的场景），仅语音/自建视频等
// 平台无法表达的类型需要在此指定一次。
const StudioModelCapabilitiesOptionKey = "studio.model_capabilities"

// 允许的模型类型取值
var studioModelTypes = map[string]struct{}{
	"text":  {},
	"image": {},
	"video": {},
	"voice": {},
}

// GetStudioModelCapabilities 返回体验中心的模型类型登记表（登录用户可读）。
//
// 响应同时包含 platforms 推断结果 `suggested`，便于管理后台在新增模型时
// 预填下拉选项：suggested 来自渠道模型清单与名称/端点类型推断，
// 仅作为建议值，最终以 capabilities 为准。
func GetStudioModelCapabilities(c *gin.Context) {
	capabilities := loadStudioModelCapabilities()
	suggested := suggestStudioModelCapabilities()
	common.ApiSuccess(c, gin.H{
		"capabilities": capabilities,
		"suggested":    suggested,
		"option_key":   StudioModelCapabilitiesOptionKey,
		"types":        []string{"text", "image", "video", "voice"},
	})
}

// loadStudioModelCapabilities 从 OptionMap 读取并规范化登记表。
func loadStudioModelCapabilities() map[string]string {
	result := make(map[string]string)
	common.OptionMapRWMutex.RLock()
	raw, ok := common.OptionMap[StudioModelCapabilitiesOptionKey]
	common.OptionMapRWMutex.RUnlock()
	text := strings.TrimSpace(raw)
	if !ok {
		return result
	}
	if text == "" {
		return result
	}
	parsed := make(map[string]any)
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return result
	}
	for model, value := range parsed {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		switch v := value.(type) {
		case string:
			t := strings.TrimSpace(strings.ToLower(v))
			if _, ok := studioModelTypes[t]; ok {
				result[model] = t
			}
		case []any:
			// 兼容数组写法（模型可多能力）；体验中心一条模型归一类，
			// 取第一个合法值，避免前端处理多值歧义。
			for _, item := range v {
				if s, ok := item.(string); ok {
					t := strings.TrimSpace(strings.ToLower(s))
					if _, ok := studioModelTypes[t]; ok {
						result[model] = t
						break
					}
				}
			}
		}
	}
	return result
}

// suggestStudioModelCapabilities 为所有已配置模型给出类型建议值。
func suggestStudioModelCapabilities() map[string]string {
	suggested := make(map[string]string)
	seen := make(map[string]struct{})
	for _, modelName := range model.GetEnabledModels() {
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		suggested[modelName] = suggestStudioModelType(modelName)
	}
	return suggested
}

// suggestStudioModelType 按名称关键字推断模型类型（与前端 model-capability.ts 规则一致）。
func suggestStudioModelType(modelName string) string {
	name := strings.ToLower(modelName)
	// 统一把分隔符归一，便于按词匹配
	normalized := strings.NewReplacer("/", "-", "_", "-", ".", "-", ":", "-").Replace(name)
	tokens := strings.Split(normalized, "-")
	has := func(words ...string) bool {
		for _, token := range tokens {
			for _, word := range words {
				if token == word {
					return true
				}
			}
		}
		return false
	}
	if has("tts", "speech", "audio", "voice", "cosyvoice") {
		return "voice"
	}
	if has("video", "t2v", "i2v", "sora", "veo", "kling", "hailuo", "runway", "cogvideo") {
		return "video"
	}
	if has("image", "dalle", "flux", "imagen", "kolors", "midjourney") {
		return "image"
	}
	if has("embedding", "embeddings", "rerank") {
		return "" // 不属于体验中心任何模式
	}
	return "text"
}
