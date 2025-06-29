// guild-service/models/guild.go
package models

import (
    "time"

    "github.com/google/uuid"
    "gorm.io/gorm"
)

type Guild struct {
  ID        uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
  Name      string    `gorm:"not null;uniqueIndex"                  json:"name"`
  OwnerID   uuid.UUID `gorm:"type:uuid;not null;index"             json:"ownerId"`
  CreatedAt time.Time `gorm:"autoCreateTime"                       json:"createdAt"`
}

// BeforeCreate заполнит ID, если он пустой
func (g *Guild) BeforeCreate(tx *gorm.DB) (err error) {
    if g.ID == uuid.Nil {
        g.ID = uuid.New()
    }
    return
}
