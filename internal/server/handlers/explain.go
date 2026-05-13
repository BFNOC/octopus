package handlers

import (
	"net/http"
	"strconv"

	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/relay"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/group").
		Use(middleware.Auth()).
		AddRoute(
			router.NewRoute("/:id/explain", http.MethodGet).
				Handle(explainGroup),
		).
		AddRoute(
			router.NewRoute("/:id/snapshot", http.MethodPost).
				Handle(saveSnapshot),
		).
		AddRoute(
			router.NewRoute("/:id/snapshot", http.MethodGet).
				Handle(listSnapshots),
		).
		AddRoute(
			router.NewRoute("/:id/snapshot", http.MethodDelete).
				Handle(deleteSnapshot),
		).
		AddRoute(
			router.NewRoute("/snapshot/clear-all", http.MethodDelete).
				Handle(deleteAllSnapshots),
		)
}

func explainGroup(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	group, err := op.GroupGet(idNum, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusNotFound, resp.ErrResourceNotFound)
		return
	}

	apiKeyID := c.GetInt("api_key_id")
	requestModel := c.Query("model")
	if requestModel == "" && len(group.Items) > 0 {
		requestModel = group.Items[0].ModelName
	}

	explanation, err := relay.ExplainSelection(c.Request.Context(), requestModel, apiKeyID)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	explanation.GroupID = idNum
	resp.Success(c, explanation)
}

func saveSnapshot(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	var req struct {
		RequestModel string `json:"request_model" binding:"required"`
		APIKeyID     int    `json:"api_key_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}

	explanation, err := relay.ExplainSelection(c.Request.Context(), req.RequestModel, req.APIKeyID)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	explanation.GroupID = idNum

	snapshotJSON, err := relay.SnapshotToJSON(explanation)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	snap := &model.GroupDecisionSnapshot{
		GroupID:      idNum,
		RequestModel: req.RequestModel,
		APIKeyID:     req.APIKeyID,
		Snapshot:     snapshotJSON,
	}
	if err := op.GroupSnapshotSave(snap, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, snap)
}

func listSnapshots(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	snaps, err := op.GroupSnapshotList(idNum, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, snaps)
}

func deleteSnapshot(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	if err := op.GroupSnapshotClear(idNum, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func deleteAllSnapshots(c *gin.Context) {
	if err := op.GroupSnapshotClearAll(c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}
