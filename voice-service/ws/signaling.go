package ws

import (
    "encoding/json"
    "log"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/go-redis/redis/v8"
    "github.com/golang-jwt/jwt/v4"
    "github.com/gorilla/websocket"
    "golang.org/x/net/context"
    
    "github.com/yourorg/voice-service/config" // Добавлен импорт конфига
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

// Вынесен в глобальную область видимости
type AuthMessage struct {
    Token string `json:"token"`
}

type Signal struct {
    Type      string          `json:"type"`
    Room      string          `json:"room"`
    Sender    string          `json:"sender"`
    Target    string          `json:"target"`
    Payload   json.RawMessage `json:"payload"`
}

func ServeSignaling(rdb *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.Query("token")
        room := c.Query("channelId") // Используем channelId вместо room
        
        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
            log.Println("ws upgrade:", err)
            return
        }
        defer conn.Close()

        if token == "" {
            _, msg, err := conn.ReadMessage()
            if err != nil {
                log.Println("ws read token:", err)
                return
            }
            
            var auth AuthMessage // Теперь тип доступен
            if err := json.Unmarshal(msg, &auth); err != nil {
                conn.WriteJSON(gin.H{"error": "invalid auth message"})
                return
            }
            token = auth.Token
        }

        userID, err := validateToken(token)
        if err != nil {
            conn.WriteJSON(gin.H{"error": "invalid token"})
            return
        }

        ctx := context.Background()
        pubsub := rdb.Subscribe(ctx, room)
        defer pubsub.Close()

        conn.WriteJSON(gin.H{
            "type": "auth-response",
            "success": true,
            "userId": userID,
        })

        go func() {
            for msg := range pubsub.Channel() {
                if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
                    return
                }
            }
        }()

        for {
            _, b, err := conn.ReadMessage()
            if err != nil {
                log.Println("ws read:", err)
                break
            }
            
            var sig Signal
            if err := json.Unmarshal(b, &sig); err != nil {
                log.Println("invalid signal:", err)
                continue
            }
            
            sig.Sender = userID
            if sig.Room == "" {
                sig.Room = room
            }
            
            out, _ := json.Marshal(sig)
            rdb.Publish(ctx, sig.Room, out)
        }
    }
}

func validateToken(tokenString string) (string, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        return []byte(config.JWTSecret), nil
    })
    
    if err != nil || !token.Valid {
        return "", err
    }
    
    claims := token.Claims.(jwt.MapClaims)
    return claims["sub"].(string), nil
}