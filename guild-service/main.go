// guild-service/main.go
package main

import (
    "log"
    "os"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"

    "guild-service/config"
    "guild-service/models"
    "guild-service/routes"
)

func main() {
	
    // **1. Загрузка переменных окружения**
    config.Load()

    // 2. Теперь config.DBUrl не пустой
    dsn := config.DBUrl
    log.Printf("Connecting to Postgres at %s", dsn)

    // 3. Подключаемся с retry
    var db *gorm.DB
    var err error
    for i := 0; i < 10; i++ {
        db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err == nil {
            break
        }
        log.Printf("Postgres not ready, retrying %d/10…", i+1)
        time.Sleep(2 * time.Second)
    }
    if err != nil {
        log.Fatalf("failed to connect DB: %v", err)
    }

    // Расширение для UUID
    if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`).Error; err != nil {
        log.Fatalf("failed to create uuid extension: %v", err)
    }

    // Миграция модели Guild
    if err := db.AutoMigrate(&models.Guild{}); err != nil {
        log.Fatalf("guilds migration failed: %v", err)
    }
	if err := db.AutoMigrate(&models.Invitation{}); err != nil {
		log.Fatalf("invitations migration failed: %v", err)
	}

  if err := db.AutoMigrate(&models.Guild{}, &models.Invitation{}); err != nil {
    log.Fatalf("Migration failed: %v", err)
  }
    // Запускаем HTTP
    r := gin.Default()
    // Регистрируем защищённые маршруты
    routes.Register(r.Group("/"), db)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("guild-service listening on :%s", port)
    if err := r.Run(":" + port); err != nil {
        log.Fatalf("failed to run guild-service: %v", err)
    }
}
