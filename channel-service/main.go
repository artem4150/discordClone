package main

import (
    "log"
    "os"
    "time"

    "github.com/gin-gonic/gin"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"

    "github.com/yourorg/channel-service/config"
    "github.com/yourorg/channel-service/models"
    "github.com/yourorg/channel-service/routes"
)

func main() {
    // Подключение к БД с retry
    dsn := config.DatabaseURL
    var db *gorm.DB
    var err error
    for i := 0; i < 10; i++ {
        db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
        if err == nil {
            break
        }
        log.Printf("Postgres not ready, retrying (%d/10)...", i+1)
        time.Sleep(2 * time.Second)
    }
    if err != nil {
        log.Fatalf("failed to connect to DB: %v", err)
    }

    // Устанавливаем расширение для uuid
    if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`).Error; err != nil {
        log.Fatalf("failed to create uuid extension: %v", err)
    }

    // Создаём enum-тип channel_type, если его нет
    if err := db.Exec(`
DO $$
BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'channel_type'
    ) THEN
      CREATE TYPE channel_type AS ENUM ('TEXT','VOICE');
    END IF;
END
$$;
`).Error; err != nil {
        log.Fatalf("failed to create enum type: %v", err)
    }

    // Миграция таблицы
    if err := db.AutoMigrate(&models.Channel{}); err != nil {
        log.Fatalf("migration failed: %v", err)
    }

    // Запуск HTTP-сервера
    r := gin.Default()
    routes.Register(r, db)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("channel-service listening on :%s", port)
    if err := r.Run(":" + port); err != nil {
        log.Fatalf("failed to run server: %v", err)
    }
}
