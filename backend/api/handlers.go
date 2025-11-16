package api

import (
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/logger"
	"kuma-lite/backend/models"
	"kuma-lite/backend/scheduler"
	"net/http"
	"strconv"
	"sync"
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

	// 获取最新的心跳记录以获取 responseTime
	heartbeats, err := database.GetRecentHeartBeats(id, 1)
	var responseData map[string]interface{}
	responseData = map[string]interface{}{
		"id":          monitor.ID,
		"name":        monitor.Name,
		"type":        monitor.Type,
		"url":         monitor.URL,
		"method":      monitor.Method,
		"tags":        monitor.Tags,
		"description": monitor.Description,
		"group":       monitor.Group,
		"groupOrder":  monitor.GroupOrder,
		"order":       monitor.Order,
		"status":      monitor.Status,
		"enabled":     monitor.Enabled,
		"uptime":      monitor.Uptime,
		"createdAt":   monitor.CreatedAt,
	}

	// 添加 responseTime
	if err == nil && len(heartbeats) > 0 {
		responseData["responseTime"] = heartbeats[0].ResponseTime
	} else {
		responseData["responseTime"] = nil
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    responseData,
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

	// 获取查询参数
	limitStr := c.Query("limit") // 限制条数(优先级高)
	hoursStr := c.Query("hours") // 时间范围

	var heartbeats []models.HeartBeat
	var cacheKey string

	// 如果提供了 limit 参数,直接获取最近 N 条记录(不限制时间)
	if limitStr != "" {
		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 100
		}

		cacheKey = "history_" + idStr + "_limit_" + limitStr

		// 使用带锁的缓存获取，避免缓存击穿（主页使用，60秒缓存）
		data, err := cache.GetOrSetWithLock(cacheKey, cache.MainPageCacheDuration, func() (interface{}, error) {
			return database.GetRecentHeartBeats(id, limit)
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Error:   "获取历史数据失败",
			})
			return
		}

		heartbeats = data.([]models.HeartBeat)
	} else {
		// 使用 hours 参数(默认24小时)
		hours := 24
		if hoursStr != "" {
			h, err := strconv.Atoi(hoursStr)
			if err == nil && h > 0 {
				hours = h
			}
		}

		cacheKey = "history_" + idStr + "_" + strconv.Itoa(hours) + "h"

		// 详情页时间范围查询，使用较长的缓存时间（5分钟）
		data, err := cache.GetOrSetWithLock(cacheKey, cache.DetailPageCacheDuration, func() (interface{}, error) {
			return database.GetHeartBeatHistory(id, hours)
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Error:   "获取历史数据失败",
			})
			return
		}

		heartbeats = data.([]models.HeartBeat)
	}

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

// GetBatchMonitorHistory 批量获取多个监控项的历史记录（用于主页并发加载）
func GetBatchMonitorHistory(c *gin.Context) {
	// 获取监控项ID列表
	var request struct {
		MonitorIDs []int `json:"monitorIds" binding:"required"`
		Limit      int   `json:"limit"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "无效的请求参数",
		})
		return
	}

	if request.Limit <= 0 {
		request.Limit = 100
	}

	// 使用并发方式查询多个监控项的历史记录
	type result struct {
		MonitorID  int                `json:"monitorId"`
		Heartbeats []models.HeartBeat `json:"heartbeats"`
		Error      string             `json:"error,omitempty"`
	}

	results := make([]result, len(request.MonitorIDs))
	var wg sync.WaitGroup

	// 使用配置的并发数限制
	semaphore := make(chan struct{}, config.AppConfig.ConcurrentQueryWorkers)

	for i, monitorID := range request.MonitorIDs {
		wg.Add(1)
		go func(index, id int) {
			defer wg.Done()

			// 获取信号量
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			cacheKey := "history_" + strconv.Itoa(id) + "_limit_" + strconv.Itoa(request.Limit)

			// 使用带锁的缓存获取，避免缓存击穿
			data, err := cache.GetOrSetWithLock(cacheKey, cache.MainPageCacheDuration, func() (interface{}, error) {
				return database.GetRecentHeartBeats(id, request.Limit)
			})

			if err != nil {
				results[index] = result{
					MonitorID: id,
					Error:     "获取数据失败",
				}
			} else {
				results[index] = result{
					MonitorID:  id,
					Heartbeats: data.([]models.HeartBeat),
				}
			}
		}(i, monitorID)
	}

	wg.Wait()

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    results,
	})
}

// HealthCheck 健康检查
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "Service is healthy"},
	})
}

// GetLogConfig 获取日志配置（用于前端）
func GetLogConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"logLevel": config.AppConfig.LogLevel,
	})
}

// TriggerFetch 触发立即采集Kuma数据
func TriggerFetch(c *gin.Context) {
	// 从查询参数获取触发来源
	source := c.Query("source")
	if source == "" {
		source = "未知"
	}

	// 根据来源显示不同的日志
	var triggerType string
	switch source {
	case "initial":
		triggerType = "首次加载"
		logger.Debug("")
		logger.Debug("╔═══════════════════════════════════════════════════════╗")
		logger.Info("║  🟢 前端首次加载触发 - %s", time.Now().Format("2006-01-02 15:04:05"))
		logger.Debug("╚═══════════════════════════════════════════════════════╝")
	case "countdown":
		triggerType = "1分钟倒计时"
		logger.Debug("")
		logger.Debug("╔═══════════════════════════════════════════════════════╗")
		logger.Info("║  🔵 前端1分钟倒计时触发 - %s", time.Now().Format("2006-01-02 15:04:05"))
		logger.Debug("╚═══════════════════════════════════════════════════════╝")
	case "manual":
		triggerType = "手动刷新"
		logger.Debug("")
		logger.Debug("╔═══════════════════════════════════════════════════════╗")
		logger.Info("║  🔴 前端手动刷新按钮触发 - %s", time.Now().Format("2006-01-02 15:04:05"))
		logger.Debug("╚═══════════════════════════════════════════════════════╝")
	default:
		triggerType = "前端触发"
		logger.Debug("")
		logger.Debug("╔═══════════════════════════════════════════════════════╗")
		logger.Info("║  ⚪ 前端触发 - %s", time.Now().Format("2006-01-02 15:04:05"))
		logger.Debug("╚═══════════════════════════════════════════════════════╝")
	}

	logger.Info("📨 [API] 收到前端采集请求 - 来源: %s", triggerType)

	// 异步执行，避免阻塞请求
	go scheduler.FetchAndStoreWithSource(triggerType)

	logger.Info("✅ [API] 已启动异步采集任务 - 来源: %s", triggerType)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"message": "数据采集已触发", "source": triggerType},
	})
}
