package routes

import (
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    "github.com/yourorg/channel-service/handlers"
    "github.com/yourorg/channel-service/middleware"
)

func Register(r *gin.Engine, db *gorm.DB) {
    auth := r.Group("/", middleware.JWTAuth())
    {
        auth.GET("/guilds/:guildId/channels", handlers.GetChannels(db))
        auth.POST("/guilds/:guildId/channels", handlers.CreateChannel(db))
        // позже можно добавить PATCH/DELETE
    }
}
