package routes

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/yourorg/voice-service/config"
	"github.com/yourorg/voice-service/ws"
)

func Register(r *gin.Engine) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     config.RedisAddr,
		Password: config.RedisPass,
	})
	log.Printf("redis client created addr=%s", config.RedisAddr)

	// Убрана общая аутентификация, так как токен проверяется в обработчике
	r.GET("/ws/voice", ws.ServeSignaling(rdb))

	r.GET("/health", func(c *gin.Context) {
		c.String(200, "ok")
	})
}
