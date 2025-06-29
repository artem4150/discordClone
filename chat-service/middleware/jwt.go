package middleware

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v4"
    "github.com/yourorg/chat-service/config"
)

func JWTAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        var tokenStr string
        
        // 1. Проверяем query-параметр "token" (для WebSocket через Kong)
        tokenStr = c.Query("token")
        
        // 2. Если в query нет токена, проверяем заголовок Authorization
        if tokenStr == "" {
            auth := c.GetHeader("Authorization")
            if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
                c.AbortWithStatus(http.StatusUnauthorized)
                return
            }
            tokenStr = strings.TrimPrefix(auth, "Bearer ")
        }

        // 3. Валидация токена
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
            return []byte(config.JWTSecret), nil
        })
        if err != nil || !token.Valid {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }

        // 4. Извлечение claims
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }

        // 5. Проверка наличия sub (subject)
        sub, ok := claims["sub"].(string)
        if !ok {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }

        // 6. Сохраняем идентификатор пользователя в контекст
        c.Set("userId", sub)
        c.Next()
    }
}