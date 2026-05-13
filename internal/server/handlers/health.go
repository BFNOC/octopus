package handlers

import (
	"net/http"
	"strconv"

	"github.com/bestruirui/octopus/internal/health"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/health").
		Use(middleware.Auth()).
		AddRoute(
			router.NewRoute("/channels", http.MethodGet).
				Handle(listChannelHealth),
		).
		AddRoute(
			router.NewRoute("/channels/:id", http.MethodGet).
				Handle(getChannelHealth),
		)
}

func listChannelHealth(c *gin.Context) {
	summary, err := health.ListChannelHealthStates(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, summary)
}

func getChannelHealth(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}

	view, err := health.GetChannelHealthState(idNum, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusNotFound, resp.ErrResourceNotFound)
		return
	}
	resp.Success(c, view)
}
