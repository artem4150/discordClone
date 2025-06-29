package controllers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"guild-service/models"
	"gorm.io/gorm"
)

func RegisterRoutes(r *gin.Engine, db *gorm.DB) {
	grp := r.Group("/guilds", /* JWT middleware applied in main */)
	{
		grp.GET("", func(c *gin.Context) {
			userIDstr, _ := c.Get("userId")
			userID, _ := uuid.Parse(userIDstr.(string))
			var guilds []models.Guild
			db.Where("owner_id = ? OR id IN (SELECT guild_id FROM guild_members WHERE user_id = ?)", userID, userID).Find(&guilds)
			c.JSON(http.StatusOK, guilds)
		})

		grp.POST("", func(c *gin.Context) {
			var body struct { Name string `json:"name"` }
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()})
				return
			}
			userIDstr, _ := c.Get("userId")
			ownerID, _ := uuid.Parse(userIDstr.(string))
			guild := models.Guild{ Name: body.Name, OwnerID: ownerID, CreatedAt: time.Now() }
			db.Create(&guild)
			// add member
			member := models.Member{ GuildID: guild.ID, UserID: ownerID, JoinedAt: time.Now() }
			db.Create(&member)
			c.JSON(http.StatusCreated, guild)
		})

		grp.GET(":id/members", func(c *gin.Context) {
			id := c.Param("id")
			gid, err := uuid.Parse(id)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error":"invalid guild id"})
				return
			}
			var members []models.Member
			db.Where("guild_id = ?", gid).Find(&members)
			c.JSON(http.StatusOK, members)
		})



grp.POST(":id/members", func(c *gin.Context) {
	id := c.Param("id")
	gid, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid guild id"})
		return
	}

	var body struct {
		UserID string `json:"userId"` // новый участник
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
})




		grp.DELETE(":id/members/:userId", func(c *gin.Context) {
			id := c.Param("id")
			uid := c.Param("userId")
			gid, err1 := uuid.Parse(id)
			uidParsed, err2 := uuid.Parse(uid)
			if err1 != nil || err2 != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error":"invalid id"})
				return
			}
			db.Delete(&models.Member{}, "guild_id = ? AND user_id = ?", gid, uidParsed)
			c.Status(http.StatusNoContent)
		})

		
	}
}