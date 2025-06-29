package config

import (
    "log"
    "os"
)

var (
    RedisAddr  = mustGet("REDIS_ADDR")   // e.g. "redis:6379"
    RedisPass  = os.Getenv("REDIS_PASS") // если нужен
    JWTSecret  = mustGet("JWT_SECRET")
)

func mustGet(key string) string {
    v := os.Getenv(key)
    if v == "" {
        log.Fatalf("env %s is required", key)
    }
    return v
}
