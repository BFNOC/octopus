package handlers

import (
	"net/http"
	"strconv"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
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
