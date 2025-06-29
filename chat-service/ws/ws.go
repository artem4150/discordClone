package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gocql/gocql"
	"github.com/gorilla/websocket"

	_ "github.com/yourorg/chat-service/config"
	"github.com/yourorg/chat-service/models"
	"github.com/yourorg/chat-service/repository"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
    Hub       *Hub
    Conn      *websocket.Conn
    ChannelID string
    UserID    string
    Send      chan []byte
}

type WSMessage struct {
    Type      string `json:"type"`
    ChannelID string `json:"channelId"`
    Content   string `json:"content"`
}

func ServeWS(hub *Hub) gin.HandlerFunc {
    return func(c *gin.Context) {
        // JWTAuth уже положил userId
        userID := c.GetString("userId")
        channelID := c.Query("channelId")
        if channelID == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "channelId required"})
            return
        }

        conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
        if err != nil {
            log.Println("ws upgrade:", err)
            return
        }
        client := &Client{
            Hub:       hub,
            Conn:      conn,
            ChannelID: channelID,
            UserID:    userID,
            Send:      make(chan []byte),
        }
        hub.Register(channelID, client)

        // write pump
        go client.writePump()
        // read pump
        client.readPump()
    }
}

func (c *Client) readPump() {
    defer func() {
        c.Hub.Unregister(c.ChannelID, c)
        c.Conn.Close()
    }()
    for {
        _, msgBytes, err := c.Conn.ReadMessage()
        if err != nil {
            log.Println("read ws:", err)
            break
        }
        var in WSMessage
        if err := json.Unmarshal(msgBytes, &in); err != nil {
            log.Println("invalid ws message:", err)
            continue
        }
        if in.Type != "MESSAGE_CREATE" {
            continue
        }
		cid, err := gocql.ParseUUID(in.ChannelID)
      		if err != nil {
           log.Println("invalid channelID:", err)
           continue
       }
        // Создаём модель и сохраняем
       m := &models.Message{
           ChannelID: cid,
           MessageID: gocql.TimeUUID(), // генерация UUID Cassandra
           SenderID:  c.UserID,
           Content:   in.Content,
          CreatedAt: time.Now(),
       
        }
        if err := repository.SaveMessage(m); err != nil {
            log.Println("save message:", err)
            continue
        }
        // Шлём назад всем
        out, _ := json.Marshal(m)
        c.Hub.Broadcast(in.ChannelID, out)
    }
}

func (c *Client) writePump() {
    for msg := range c.Send {
        if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
            log.Println("ws write:", err)
            break
        }
    }
    c.Conn.Close()
}
