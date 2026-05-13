package op

import (
	"fmt"
	"strings"
	"sync"

	"github.com/bestruirui/octopus/internal/model"
)

var apiKeyFilterCache sync.Map // map[string]bool, key = "apiKeyID:modelName"

func filterCacheKey(apiKeyID int, modelName string) string {
	return fmt.Sprintf("%d:%s", apiKeyID, modelName)
}

// InvalidateAPIKeyFilterCache removes all cached filter results for the given API key.
func InvalidateAPIKeyFilterCache(apiKeyID int) {
	prefix := fmt.Sprintf("%d:", apiKeyID)
	apiKeyFilterCache.Range(func(key, _ any) bool {
		if strings.HasPrefix(key.(string), prefix) {
			apiKeyFilterCache.Delete(key)
		}
		return true
	})
}

// IsModelAllowedByAPIKey checks whether the given model is allowed by the API key's filter rules.
func IsModelAllowedByAPIKey(apiKeyID int, modelName string) bool {
	cacheKey := filterCacheKey(apiKeyID, modelName)
	if v, ok := apiKeyFilterCache.Load(cacheKey); ok {
		return v.(bool)
	}

	result := computeModelAllowedByAPIKey(apiKeyID, modelName)
	apiKeyFilterCache.Store(cacheKey, result)
	return result
}

func computeModelAllowedByAPIKey(apiKeyID int, modelName string) bool {
	apiKey, ok := apiKeyCache.Get(apiKeyID)
	if !ok {
		return true // cache miss → 放行，由旧 supportedModels 逻辑兜底
	}

	modelNameLower := strings.ToLower(modelName)

	switch apiKey.ModelFilterMode {
	case model.ModelFilterModeAllowList:
		return isModelInList(modelNameLower, apiKey.FilteredModels)
	case model.ModelFilterModeDenyList:
		return !isModelInList(modelNameLower, apiKey.FilteredModels)
	default: // "none"
		if apiKey.SupportedModels == "" {
			return true
		}
		return isModelInSupportedModels(modelNameLower, apiKey.SupportedModels)
	}
}

func isModelInList(modelNameLower string, models []string) bool {
	for _, m := range models {
		if strings.ToLower(m) == modelNameLower {
			return true
		}
	}
	return false
}

func isModelInSupportedModels(modelNameLower string, supportedModels string) bool {
	for _, m := range strings.Split(supportedModels, ",") {
		if strings.ToLower(strings.TrimSpace(m)) == modelNameLower {
			return true
		}
	}
	return false
}
