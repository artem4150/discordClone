package models

import (
	"time"
	
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Invitation struct {
	ID          uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`
	Code        string    `gorm:"uniqueIndex;not null"`
	GuildID     uuid.UUID `gorm:"type:uuid;not null;index"`
	CreatedByID uuid.UUID `gorm:"type:uuid;not null;index"`
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	ExpiresAt   time.Time
	Used        bool `gorm:"default:false"`
	Guild   Guild `gorm:"foreignKey:GuildID"`
}

func (i *Invitation) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return
}