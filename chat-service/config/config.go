package config

import (
    "log"
    "os"
)

var (
    CassandraHost = mustGet("CASSANDRA_HOST")   // e.g. "cassandra:9042"
    CassandraKeyspace = mustGet("CASSANDRA_KEYSPACE") // "chats"
    JWTSecret   = mustGet("JWT_SECRET")
)

func mustGet(key string) string {
    v := os.Getenv(key)
    if v == "" {
        log.Fatalf("env %s is required", key)
    }
    return v
}
