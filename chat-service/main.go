package main

import (
	"log"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	_ "github.com/yourorg/chat-service/config"
	_ "github.com/yourorg/chat-service/middleware"
	"github.com/yourorg/chat-service/repository"
	"github.com/yourorg/chat-service/routes"
	"github.com/yourorg/chat-service/ws"
)

func main() {
	// Инициализируем Cassandra
	repository.InitCassandra()

	// Создаём хаб WS
	hub := ws.NewHub()

	// Запускаем Gin
	r := gin.Default()
	originsEnv := os.Getenv("ALLOW_ORIGINS")
	if originsEnv == "" {
		originsEnv = "http://localhost:3001"
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     strings.Split(originsEnv, ","),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))
	// Зарегистрируем маршруты
	routes.Register(r, hub)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("chat-service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to run chat-service: %v", err)
	}
}
