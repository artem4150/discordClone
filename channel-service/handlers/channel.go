package handlers

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "gorm.io/gorm"

    "github.com/yourorg/channel-service/models"
)

type CreateChannelInput struct {
    Name string               `json:"name" binding:"required"`
    Type models.ChannelType   `json:"type" binding:"required,oneof=TEXT VOICE"`
}

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
