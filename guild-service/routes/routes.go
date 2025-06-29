package routes

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"guild-service/handlers"
	"guild-service/middleware"
)

func Register(r gin.IRouter, db *gorm.DB) {
  auth := r.Group("/", middleware.JWTAuth())
  {
    // 1. Зарегистрируем специфичные маршруты перед общими
    auth.GET("/invitations/:code", handlers.GetInvite(db)) // Добавлено
    
    // 2. Остальные маршруты
    auth.GET("/guilds", handlers.GetGuilds(db))
    auth.POST("/guilds", handlers.CreateGuild(db))
    auth.GET("/guilds/:guildId", handlers.GetGuild(db))
    auth.GET("/guilds/:guildId/channels", handlers.GetChannels(db))
    auth.POST("/guilds/:guildId/channels", handlers.CreateChannel(db))
    auth.GET("/guilds/:guildId/members", handlers.GetMembers(db))
    auth.POST("/guilds/:guildId/members", handlers.AddMember(db))
    auth.POST("/guilds/:guildId/invites", handlers.CreateInvitation(db))
    auth.POST("/invites/:code/accept", handlers.AcceptInvitation(db))
    
    // 3. УДАЛИТЬ этот общий маршрут:
    // auth.GET("/:code", handlers.GetInvite(db))
  
    // Логирование маршрутов
    fmt.Println("Registered routes:")
    fmt.Println("GET /invitations/:code")
    fmt.Println("GET /guilds")
    fmt.Println("POST /guilds")
    fmt.Println("GET /guilds/:guildId")
    fmt.Println("GET /guilds/:guildId/channels")
    fmt.Println("POST /guilds/:guildId/channels")
    fmt.Println("GET /guilds/:guildId/members")
    fmt.Println("POST /guilds/:guildId/members")
    fmt.Println("POST /guilds/:guildId/invites")
    fmt.Println("POST /invites/:code/accept")
  }
}