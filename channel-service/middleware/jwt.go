package middleware

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v4"
    "github.com/yourorg/channel-service/config"
)

func JWTAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        auth := c.GetHeader("Authorization")
        if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }
        tokenStr := strings.TrimPrefix(auth, "Bearer ")
        token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
            return []byte(config.JWTSecret), nil
        })
        if err != nil || !token.Valid {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }
        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }
        sub, ok := claims["sub"].(string)
        if !ok {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }
        c.Set("userId", sub)
        c.Next()
    }
}
