package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

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

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = pongWait * 9 / 10
)

// Вынесен в глобальную область видимости
type AuthMessage struct {
	Token string `json:"token"`
}

type Signal struct {
	Type    string          `json:"type"`
	Room    string          `json:"room"`
	Sender  string          `json:"sender"`
	Target  string          `json:"target"`
	Payload json.RawMessage `json:"payload"`
}

func ServeSignaling(rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		room := c.Query("channelId") // Используем channelId вместо room

		var userID string

		log.Printf("new ws request from %s to room %s", c.ClientIP(), room)

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}

		conn.SetReadLimit(512)
		conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})

		ticker := time.NewTicker(pingPeriod)
		defer ticker.Stop()
		go func() {
			for range ticker.C {
				conn.SetWriteDeadline(time.Now().Add(writeWait))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}()
		defer func() {
			log.Printf("connection closed user=%s room=%s", userID, room)
			conn.Close()
		}()

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

		userID, err = validateToken(token)
		if err != nil {
			log.Println("token validation failed:", err)
			conn.WriteJSON(gin.H{"error": "invalid token"})
			return
		}

		log.Printf("client %s authenticated as %s", c.ClientIP(), userID)

		ctx := context.Background()
		roomKey := "voice_room_users:" + room

		// Добавляем пользователя в комнату и отправляем список участников
		if err := rdb.SAdd(ctx, roomKey, userID).Err(); err != nil {
			log.Println("redis sadd:", err)
		}
		members, _ := rdb.SMembers(ctx, roomKey).Result()
		log.Printf("room %s members after join: %v", room, members)

		conn.WriteJSON(gin.H{
			"type":    "auth-response",
			"success": true,
			"userId":  userID,
		})
		conn.WriteJSON(gin.H{
			"type":    "user-list",
			"payload": gin.H{"users": members},
		})

		// Уведомляем остальных о подключении
		joinMsg, _ := json.Marshal(Signal{Type: "join", Room: room, Sender: userID})
		if err := rdb.Publish(ctx, room, joinMsg).Err(); err != nil {
			log.Println("redis publish join:", err)
		}

		// Рассылаем обновленный список участников
		updatedMembers, _ := rdb.SMembers(ctx, roomKey).Result()
		payload, _ := json.Marshal(gin.H{"users": updatedMembers})
		userListMsg, _ := json.Marshal(Signal{Type: "user-list", Room: room, Payload: payload})
		if err := rdb.Publish(ctx, room, userListMsg).Err(); err != nil {
			log.Println("redis publish user-list:", err)
		}

		pubsub := rdb.Subscribe(ctx, room)
		defer func() {
			log.Printf("closing pubsub for user=%s room=%s", userID, room)
			pubsub.Close()
		}()

		go func() {
			for msg := range pubsub.Channel() {
				if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
					log.Println("ws write:", err)
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
			conn.SetReadDeadline(time.Now().Add(pongWait))

			var sig Signal
			if err := json.Unmarshal(b, &sig); err != nil {
				log.Println("invalid signal:", err)
				continue
			}

			log.Printf("received signal from %s: %s", userID, sig.Type)

			sig.Sender = userID
			if sig.Room == "" {
				sig.Room = room
			}

			out, _ := json.Marshal(sig)
			if err := rdb.Publish(ctx, sig.Room, out).Err(); err != nil {
				log.Println("redis publish signal:", err)
			}
		}

		// При закрытии соединения удаляем пользователя из комнаты
		rdb.SRem(ctx, roomKey, userID)
		leaveMsg, _ := json.Marshal(Signal{Type: "leave", Room: room, Sender: userID})
		if err := rdb.Publish(ctx, room, leaveMsg).Err(); err != nil {
			log.Println("redis publish leave:", err)
		}

		// Рассылаем обновленный список участников
		remainingMembers, _ := rdb.SMembers(ctx, roomKey).Result()
		log.Printf("room %s members after leave: %v", room, remainingMembers)
		payloadLeave, _ := json.Marshal(gin.H{"users": remainingMembers})
		userListMsgLeave, _ := json.Marshal(Signal{Type: "user-list", Room: room, Payload: payloadLeave})
		if err := rdb.Publish(ctx, room, userListMsgLeave).Err(); err != nil {
			log.Println("redis publish updated list:", err)
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
