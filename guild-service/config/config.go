package config

import (
	"log"
	"os"
)

var (
	DBUrl     string
	JWTSecret string
)

func Load() {
	DBUrl = os.Getenv("DATABASE_URL")
	if DBUrl == "" {
		log.Fatal("DATABASE_URL not set")
	}
	JWTSecret = os.Getenv("JWT_SECRET")
	if JWTSecret == "" {
		log.Fatal("JWT_SECRET not set")
	}
}