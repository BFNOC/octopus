package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func init() {
	router.NewGroupRouter("/api/v1/channel/filter").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/disabled/list/:channel_id", http.MethodGet).
				Handle(listDisabledModels),
		).
		AddRoute(
			router.NewRoute("/disabled/add", http.MethodPost).
				Handle(addDisabledModel),
		).
		AddRoute(
			router.NewRoute("/disabled/delete", http.MethodPost).
				Handle(deleteDisabledModel),
		).
		AddRoute(
			router.NewRoute("/allowed/list/:channel_id", http.MethodGet).
				Handle(listAllowedModels),
		).
		AddRoute(
			router.NewRoute("/allowed/add", http.MethodPost).
				Handle(addAllowedModel),
		).
		AddRoute(
			router.NewRoute("/allowed/delete", http.MethodPost).
				Handle(deleteAllowedModel),
		)
	router.NewGroupRouter("/api/v1/channel/filter").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/batch", http.MethodPost).
				Handle(batchChannelFilter),
		).
		AddRoute(
			router.NewRoute("/batch-update", http.MethodPost).
				Handle(batchUpdateChannelFilter),
		)
}

func listDisabledModels(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("channel_id"))
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}
	var models []model.ChannelDisabledModel
	if err := db.GetDB().Where("channel_id = ?", channelID).Find(&models).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, models)
}

func addDisabledModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	m := model.ChannelDisabledModel{ChannelID: req.ChannelID, ModelName: req.ModelName}
	if err := db.GetDB().Create(&m).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	op.InvalidateChannelFilterCache(req.ChannelID)
	resp.Success(c, m)
}

func deleteDisabledModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	result := db.GetDB().Where("channel_id = ? AND model_name = ?", req.ChannelID, req.ModelName).Delete(&model.ChannelDisabledModel{})
	if result.Error != nil {
		resp.Error(c, http.StatusInternalServerError, result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		resp.Error(c, http.StatusNotFound, "record not found")
		return
	}
	op.InvalidateChannelFilterCache(req.ChannelID)
	resp.Success(c, nil)
}

func listAllowedModels(c *gin.Context) {
	channelID, err := strconv.Atoi(c.Param("channel_id"))
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}
	var models []model.ChannelAllowedModel
	if err := db.GetDB().Where("channel_id = ?", channelID).Find(&models).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, models)
}

func addAllowedModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	m := model.ChannelAllowedModel{ChannelID: req.ChannelID, ModelName: req.ModelName}
	if err := db.GetDB().Create(&m).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	op.InvalidateChannelFilterCache(req.ChannelID)
	resp.Success(c, m)
}

func deleteAllowedModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	result := db.GetDB().Where("channel_id = ? AND model_name = ?", req.ChannelID, req.ModelName).Delete(&model.ChannelAllowedModel{})
	if result.Error != nil {
		resp.Error(c, http.StatusInternalServerError, result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		resp.Error(c, http.StatusNotFound, "record not found")
		return
	}
	op.InvalidateChannelFilterCache(req.ChannelID)
	resp.Success(c, nil)
}

type batchChannelFilterResponse struct {
	ChannelID       int                          `json:"channel_id"`
	ModelFilterMode string                       `json:"model_filter_mode"`
	DisabledModels  []model.ChannelDisabledModel `json:"disabled_models"`
	AllowedModels   []model.ChannelAllowedModel  `json:"allowed_models"`
}

func newBatchFilterResponse(id int, mode string, disabled []model.ChannelDisabledModel, allowed []model.ChannelAllowedModel) batchChannelFilterResponse {
	if disabled == nil {
		disabled = []model.ChannelDisabledModel{}
	}
	if allowed == nil {
		allowed = []model.ChannelAllowedModel{}
	}
	return batchChannelFilterResponse{
		ChannelID:       id,
		ModelFilterMode: mode,
		DisabledModels:  disabled,
		AllowedModels:   allowed,
	}
}

func batchChannelFilter(c *gin.Context) {
	var req struct {
		ChannelIDs []int `json:"channel_ids" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}

	// 去重
	seen := make(map[int]struct{}, len(req.ChannelIDs))
	uniqueIDs := make([]int, 0, len(req.ChannelIDs))
	for _, id := range req.ChannelIDs {
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			uniqueIDs = append(uniqueIDs, id)
		}
	}

	// 只查询存在的渠道
	var channels []model.Channel
	if err := db.GetDB().Select("id, model_filter_mode").Where("id IN ?", uniqueIDs).Find(&channels).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	channelModeMap := make(map[int]string, len(channels))
	existingIDs := make([]int, 0, len(channels))
	for _, ch := range channels {
		channelModeMap[ch.ID] = ch.ModelFilterMode
		existingIDs = append(existingIDs, ch.ID)
	}

	if len(existingIDs) == 0 {
		resp.Success(c, []batchChannelFilterResponse{})
		return
	}

	var disabledModels []model.ChannelDisabledModel
	if err := db.GetDB().Where("channel_id IN ?", existingIDs).Find(&disabledModels).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	disabledMap := make(map[int][]model.ChannelDisabledModel)
	for _, m := range disabledModels {
		disabledMap[m.ChannelID] = append(disabledMap[m.ChannelID], m)
	}

	var allowedModels []model.ChannelAllowedModel
	if err := db.GetDB().Where("channel_id IN ?", existingIDs).Find(&allowedModels).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	allowedMap := make(map[int][]model.ChannelAllowedModel)
	for _, m := range allowedModels {
		allowedMap[m.ChannelID] = append(allowedMap[m.ChannelID], m)
	}

	result := make([]batchChannelFilterResponse, 0, len(existingIDs))
	for _, id := range existingIDs {
		mode := channelModeMap[id]
		if mode == "" {
			mode = "none"
		}
		result = append(result, newBatchFilterResponse(id, mode, disabledMap[id], allowedMap[id]))
	}
	resp.Success(c, result)
}

func batchUpdateChannelFilter(c *gin.Context) {
	var req struct {
		ChannelID int      `json:"channel_id" binding:"required"`
		Action    string   `json:"action" binding:"required,oneof=add delete replace"`
		Models    []string `json:"models" binding:"required"`
		Mode      string   `json:"mode" binding:"required,oneof=allow-list deny-list"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}

	// 校验 channel_id 是否存在
	var count int64
	if err := db.GetDB().Model(&model.Channel{}).Where("id = ?", req.ChannelID).Count(&count).Error; err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if count == 0 {
		resp.Error(c, http.StatusNotFound, "channel not found")
		return
	}

	// 去重 + TrimSpace + 过滤空字符串
	seen := make(map[string]struct{}, len(req.Models))
	uniqueModels := make([]string, 0, len(req.Models))
	for _, m := range req.Models {
		name := strings.TrimSpace(m)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; !exists {
			seen[name] = struct{}{}
			uniqueModels = append(uniqueModels, name)
		}
	}

	if len(uniqueModels) == 0 {
		resp.Success(c, nil)
		return
	}

	// 使用事务保证原子性
	d := db.GetDB()
	err := d.Transaction(func(tx *gorm.DB) error {
		switch req.Action {
		case "replace":
			if req.Mode == "deny-list" {
				if err := tx.Where("channel_id = ?", req.ChannelID).Delete(&model.ChannelDisabledModel{}).Error; err != nil {
					return err
				}
				for _, name := range uniqueModels {
					if err := tx.Create(&model.ChannelDisabledModel{ChannelID: req.ChannelID, ModelName: name}).Error; err != nil {
						return err
					}
				}
			} else {
				if err := tx.Where("channel_id = ?", req.ChannelID).Delete(&model.ChannelAllowedModel{}).Error; err != nil {
					return err
				}
				for _, name := range uniqueModels {
					if err := tx.Create(&model.ChannelAllowedModel{ChannelID: req.ChannelID, ModelName: name}).Error; err != nil {
						return err
					}
				}
			}
		case "add":
			if req.Mode == "deny-list" {
				for _, name := range uniqueModels {
					m := model.ChannelDisabledModel{ChannelID: req.ChannelID, ModelName: name}
					if err := tx.Where("channel_id = ? AND model_name = ?", req.ChannelID, name).FirstOrCreate(&m).Error; err != nil {
						return err
					}
				}
			} else {
				for _, name := range uniqueModels {
					m := model.ChannelAllowedModel{ChannelID: req.ChannelID, ModelName: name}
					if err := tx.Where("channel_id = ? AND model_name = ?", req.ChannelID, name).FirstOrCreate(&m).Error; err != nil {
						return err
					}
				}
			}
		case "delete":
			if req.Mode == "deny-list" {
				if err := tx.Where("channel_id = ? AND model_name IN ?", req.ChannelID, uniqueModels).Delete(&model.ChannelDisabledModel{}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Where("channel_id = ? AND model_name IN ?", req.ChannelID, uniqueModels).Delete(&model.ChannelAllowedModel{}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	op.InvalidateChannelFilterCache(req.ChannelID)
	resp.Success(c, nil)
}
