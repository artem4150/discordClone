package main

import (
    "log"
    "os"

    "github.com/gin-gonic/gin"
    _"github.com/yourorg/voice-service/config"
    "github.com/yourorg/voice-service/routes"
)

func main() {
    r := gin.Default()
    routes.Register(r)

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("voice-service listening on :%s", port)
    r.Run(":" + port)
}
