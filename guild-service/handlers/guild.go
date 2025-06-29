// guild-service/handlers/guild.go
package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"guild-service/models"
)

type createGuildInput struct {
    Name string `json:"name" binding:"required"`
}

// GET /guilds
func GetGuilds(db *gorm.DB) gin.HandlerFunc {
  return func(c *gin.Context) {
    userIDstr, _ := c.Get("userId")
    userID, _ := uuid.Parse(userIDstr.(string))

    var list []models.Guild
    // SELECT * FROM guilds 
    // WHERE owner_id = ? 
    //   OR id IN (SELECT guild_id FROM members WHERE user_id = ?)
    if err := db.
         Where("owner_id = ?", userID).
         Or("id IN (?)", db.Table("members").
                          Select("guild_id").
                          Where("user_id = ?", userID)).
         Find(&list).Error; err != nil {
      c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
      return
    }
    c.JSON(http.StatusOK, list)
  }
}

// POST /guilds
func CreateGuild(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        var in createGuildInput
        if err := c.ShouldBindJSON(&in); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        ownerI, _ := c.Get("userId")
        ownerID, _ := uuid.Parse(ownerI.(string))

        g := models.Guild{
            Name:    in.Name,
            OwnerID: ownerID,
        }
        if err := db.Create(&g).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusCreated, g)
    }
}

// GET /guilds/:id
func GetGuild(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
            return
        }

        var g models.Guild
        if err := db.First(&g, "id = ?", id).Error; err != nil {
            if err == gorm.ErrRecordNotFound {
                c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
            } else {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            }
            return
        }
        c.JSON(http.StatusOK, g)
    }
}
// Получение каналов по guildId
func GetChannels(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        guildIdParam := c.Param("guildId")
        guildID, err := uuid.Parse(guildIdParam)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guildId"})
            return
        }

        var channels []models.Channel
        if err := db.Where("guild_id = ?", guildID).Find(&channels).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusOK, channels)
    }
}
type CreateChannelInput struct {
    Name string               `json:"name" binding:"required"`  // Имя канала
    Type models.ChannelType   `json:"type" binding:"required,oneof=TEXT VOICE"` // Тип канала: TEXT или VOICE
}
// Создание нового канала
func CreateChannel(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        guildIdParam := c.Param("guildId")
        guildID, err := uuid.Parse(guildIdParam)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guildId"})
            return
        }

        var input CreateChannelInput
        if err := c.ShouldBindJSON(&input); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        channel := models.Channel{
            GuildID: guildID,
            Name:    input.Name,
            Type:    input.Type,
        }

        if err := db.Create(&channel).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.JSON(http.StatusCreated, channel)
    }
}
func GetMembers(db *gorm.DB) gin.HandlerFunc {
    return func(c *gin.Context) {
        guildIdParam := c.Param("guildId")
        guildID, err := uuid.Parse(guildIdParam)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guildId"})
            return
        }

        var members []models.Member
        if err := db.Where("guild_id = ?", guildID).Find(&members).Error; err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.JSON(http.StatusOK, members)
    }
}

func AddMember(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		guildIDParam := c.Param("guildId")
		gid, err := uuid.Parse(guildIDParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guildId"})
			return
		}

		var body struct {
			UserID string `json:"userId"` // ID пользователя, которого добавляем
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		uid, err := uuid.Parse(body.UserID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid userId"})
			return
		}

		member := models.Member{
			GuildID:  gid,
			UserID:   uid,
			JoinedAt: time.Now(),
		}
		if err := db.Create(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
			return
		}

		c.JSON(http.StatusCreated, member)
	}
}