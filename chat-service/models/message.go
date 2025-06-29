package models

import (
    "time"

    "github.com/gocql/gocql"
)

type Message struct {
    ChannelID   gocql.UUID `json:"channelId"`
    MessageID   gocql.UUID `json:"messageId"`
    SenderID    string     `json:"senderId"`
    Content     string     `json:"content"`
    CreatedAt   time.Time  `json:"createdAt"`
}
