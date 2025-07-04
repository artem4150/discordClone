package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/yourorg/voice-service/config"
)

func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Поддерживаем получение токена из query-параметра
		tokenStr := c.Query("token")

		// Если нет в query, проверяем заголовок
		if tokenStr == "" {
			auth := c.GetHeader("Authorization")
			if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
				c.AbortWithStatus(http.StatusUnauthorized)
				return
			}
			tokenStr = strings.TrimPrefix(auth, "Bearer ")
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return []byte(config.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		claims := token.Claims.(jwt.MapClaims)
		sub := claims["sub"].(string)
		c.Set("userId", sub)
		c.Next()
	}
}
