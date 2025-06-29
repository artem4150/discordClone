package models

import (
    "time"

    "github.com/google/uuid"
    "gorm.io/gorm"
)

type ChannelType string

const (
    ChannelTypeText  ChannelType = "TEXT"
    ChannelTypeVoice ChannelType = "VOICE"
)

type Channel struct {
    ID        uuid.UUID   `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`
    GuildID   uuid.UUID   `gorm:"type:uuid;not null;index"`
    Name      string      `gorm:"not null"`
    Type      ChannelType `gorm:"type:channel_type;not null"`
    CreatedAt time.Time   `gorm:"autoCreateTime"`
}

func (c *Channel) BeforeCreate(tx *gorm.DB) (err error) {
    if c.ID == uuid.Nil {
        c.ID = uuid.New()
    }
    return
}
