package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"guild-service/models"
)

type CreateInvitationResponse struct {
	Code string `json:"code"`
}

func CreateInvitation(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		guildIDParam := c.Param("guildId")
		guildID, err := uuid.Parse(guildIDParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guildId"})
			return
		}

		userIDstr, _ := c.Get("userId")
		userID, _ := uuid.Parse(userIDstr.(string))

		// Генерация уникального кода
		bytes := make([]byte, 8)
		if _, err := rand.Read(bytes); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate code"})
			return
		}
		code := hex.EncodeToString(bytes)

		invitation := models.Invitation{
			Code:        code,
			GuildID:     guildID,
			CreatedByID: userID,
			ExpiresAt:   time.Now().Add(7 * 24 * time.Hour), // Срок действия 7 дней
		}

		if err := db.Create(&invitation).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, CreateInvitationResponse{Code: code})
	}
}

func GetInvite(db *gorm.DB) gin.HandlerFunc {
  return func(c *gin.Context) {
    code := c.Param("code")
    log.Printf("Fetching invitation for code: %s", code)
    
    var inv models.Invitation
    result := db.Where("code = ?", code).Preload("Guild").First(&inv)
    
    if result.Error != nil {
      log.Printf("Invitation not found: %v", result.Error)
      c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
      return
    }
    
    log.Printf("Found invitation: %+v", inv)
    c.JSON(http.StatusOK, gin.H{"guild": inv.Guild})
  }
}

func AcceptInvitation(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        code := c.Param("code")
        
        // Исправленная проверка пользователя
        userIDstr, exists := c.Get("userId")
        if !exists {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
            return
        }
        
        userID, err := uuid.Parse(userIDstr.(string))
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
            return
        }

        // Остальной код без изменений...
        var invitation models.Invitation
        if err := db.Where("code = ?", code).First(&invitation).Error; err != nil {
            if err == gorm.ErrRecordNotFound {
                c.JSON(http.StatusNotFound, gin.H{"error": "invitation not found"})
            } else {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            }
            return
        }

        // Проверка срока действия
        if time.Now().After(invitation.ExpiresAt) {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invitation expired"})
            return
        }

        // Проверка использования
        if invitation.Used {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invitation already used"})
            return
        }

        // Добавление пользователя на сервер
        member := models.Member{
            GuildID:  invitation.GuildID,
            UserID:   userID,
            JoinedAt: time.Now(),
        }

        if err := db.Create(&member).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
            return
        }

        // Помечаем приглашение как использованное
        db.Model(&invitation).Update("used", true)

        c.JSON(http.StatusOK, gin.H{"status": "success", "guildId": invitation.GuildID})
    }
}