package routes

import (
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/yourorg/chat-service/middleware"
    "github.com/yourorg/chat-service/repository"
    "github.com/yourorg/chat-service/ws"
)

func Register(r *gin.Engine, hub *ws.Hub) {
    auth := r.Group("/", middleware.JWTAuth())

    // HTTP: история сообщений
    auth.GET("/channels/:channelId/messages", func(c *gin.Context) {
        channelID := c.Param("channelId")
        limitStr := c.Query("limit")
        afterStr := c.Query("after")

        limit := 50
        if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
            limit = v
        }
        var after time.Time
        if afterStr != "" {
            if t, err := time.Parse(time.RFC3339, afterStr); err == nil {
                after = t
            }
        }

        msgs, err := repository.GetMessages(channelID, limit, after)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusOK, msgs)
    })

    // WebSocket: real-time чат
    auth.GET("/ws/chat", ws.ServeWS(hub))

    // health
    r.GET("/health", func(c *gin.Context) {
        c.String(http.StatusOK, "ok")
    })
}
