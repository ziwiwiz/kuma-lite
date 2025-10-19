package api

import (
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetMonitors 获取所有监控项
func GetMonitors(c *gin.Context) {
	// 尝试从缓存获取
	cacheKey := "monitors"
	if cached, found := cache.Get(cacheKey); found {
		c.JSON(http.StatusOK, models.APIResponse{
			Success:   true,
			Data:      cached,
			Timestamp: time.Now(),
		})
		return
	}

	// 从数据库获取
	monitors, err := database.GetAllMonitors()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "获取监控数据失败",
		})
		return
	}

	// 存入缓存
	cache.Set(cacheKey, monitors, config.AppConfig.CacheDuration)

	c.JSON(http.StatusOK, models.APIResponse{
		Success:   true,
		Data:      monitors,
		Timestamp: time.Now(),
	})
}

// GetMonitorByID 获取单个监控项
func GetMonitorByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "无效的监控项 ID",
		})
		return
	}

	monitor, err := database.GetMonitorByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   "监控项不存在",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    monitor,
	})
}

// GetMonitorHistory 获取监控历史
func GetMonitorHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "无效的监控项 ID",
		})
		return
	}

	// 获取查询参数 hours,默认 24 小时
	hoursStr := c.DefaultQuery("hours", "24")
	hours, err := strconv.Atoi(hoursStr)
	if err != nil || hours <= 0 {
		hours = 24
	}

	// 尝试从缓存获取历史数据
	cacheKey := "history_" + idStr + "_" + hoursStr
	if cached, found := cache.Get(cacheKey); found {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data:    cached,
		})
		return
	}

	heartbeats, err := database.GetHeartBeatHistory(id, hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "获取历史数据失败",
		})
		return
	}

	// 存入缓存,历史数据缓存30秒
	cache.Set(cacheKey, heartbeats, 30*time.Second)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    heartbeats,
	})
}

// GetStats 获取统计信息
func GetStats(c *gin.Context) {
	// 尝试从缓存获取
	cacheKey := "stats"
	if cached, found := cache.Get(cacheKey); found {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data:    cached,
		})
		return
	}

	stats, err := database.GetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "获取统计信息失败",
		})
		return
	}

	// 存入缓存
	cache.Set(cacheKey, stats, config.AppConfig.CacheDuration)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    stats,
	})
}

// HealthCheck 健康检查
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "Service is healthy"},
	})
}
