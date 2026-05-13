package compat

import (
	"encoding/json"
	"strings"

	"github.com/bestruirui/octopus/internal/transformer/model"
)

// HasWebSearchOnlyTool 检查请求是否仅包含 web_search 工具（无其他 function 工具）
func HasWebSearchOnlyTool(tools []model.Tool) bool {
	if len(tools) == 0 {
		return false
	}

	hasWebSearch := false
	hasOther := false

	for _, tool := range tools {
		switch tool.Type {
		case "web_search", "web_search_20250311", "web_search_preview", "web_search_preview_20250311":
			hasWebSearch = true
		case "function":
			hasOther = true
		case "image_generation":
			hasOther = true
		default:
			// 检查 function name 是否包含 web_search
			if strings.Contains(strings.ToLower(tool.Function.Name), "web_search") ||
				strings.Contains(strings.ToLower(tool.Function.Name), "search") {
				hasWebSearch = true
			} else {
				hasOther = true
			}
		}
	}

	return hasWebSearch && !hasOther
}

// ExtractSearchQuery 从 web_search_options 或工具参数中提取搜索查询
func ExtractSearchQuery(request *model.InternalLLMRequest) string {
	// 尝试从 web_search_options 提取
	if len(request.WebSearchOptions) > 0 {
		var opts struct {
			SearchContextSize string `json:"search_context_size"`
		}
		if json.Unmarshal(request.WebSearchOptions, &opts) == nil {
			// web_search_options 本身不含查询，查询来自最后一条用户消息
		}
	}

	// 从最后一条用户消息提取
	if len(request.Messages) > 0 {
		for i := len(request.Messages) - 1; i >= 0; i-- {
			msg := request.Messages[i]
			if msg.Role == "user" {
				// 尝试从 Content.Content 获取文本
				if msg.Content.Content != nil && *msg.Content.Content != "" {
					return *msg.Content.Content
				}
				// 处理多模态内容
				for _, mc := range msg.Content.MultipleContent {
					if mc.Type == "text" && mc.Text != nil && *mc.Text != "" {
						return *mc.Text
					}
				}
			}
		}
	}

	return ""
}
