package config

import (
    "log"
    "os"
)

var (
    DatabaseURL = mustGet("DATABASE_URL")
    JWTSecret   = mustGet("JWT_SECRET")
)

func mustGet(key string) string {
    v := os.Getenv(key)
    if v == "" {
        log.Fatalf("env %s is required", key)
    }
    return v
}
