package models

import (
	"time"
	"github.com/google/uuid"
)

type Member struct {
	GuildID  uuid.UUID `gorm:"type:uuid;primaryKey" json:"guildId"`
	UserID   uuid.UUID `gorm:"type:uuid;primaryKey" json:"userId"`
	JoinedAt time.Time `json:"joinedAt"`
}