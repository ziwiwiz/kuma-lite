package api

import (
	"kuma-lite/backend/database"

	"github.com/gin-gonic/gin"
)

// SetupRouter 设置路由
func SetupRouter() *gin.Engine {
	router := gin.Default()

	// 跨域中间件
	router.Use(corsMiddleware())

	// 初始化处理器
	maintenanceRepo := database.NewMaintenanceRepository(database.DB)
	incidentRepo := database.NewIncidentRepository(database.DB)
	configRepo := database.NewConfigRepository(database.DB)

	maintenanceHandlers := NewMaintenanceHandlers(maintenanceRepo)
	incidentHandlers := NewIncidentHandlers(incidentRepo)
	configHandlers := NewConfigHandlers(configRepo)

	// API 路由
	apiGroup := router.Group("/api")
	{
		// 健康检查和基础监控API
		apiGroup.GET("/health", HealthCheck)
		apiGroup.POST("/trigger-fetch", TriggerFetch) // 触发立即采集
		apiGroup.GET("/monitors", GetMonitors)
		apiGroup.GET("/monitors/:id", GetMonitorByID)
		apiGroup.GET("/monitors/:id/history", GetMonitorHistory)
		apiGroup.POST("/monitors/batch-history", GetBatchMonitorHistory)
		apiGroup.GET("/stats", GetStats)
		apiGroup.GET("/log-config", GetLogConfig) // 获取日志配置

		// 维护计划API
		apiGroup.GET("/maintenances", maintenanceHandlers.GetMaintenances)
		apiGroup.GET("/maintenances/current", maintenanceHandlers.GetCurrentMaintenances)
		apiGroup.GET("/maintenances/:id", maintenanceHandlers.GetMaintenance)
		apiGroup.POST("/maintenances", maintenanceHandlers.CreateMaintenance)
		apiGroup.PUT("/maintenances/:id", maintenanceHandlers.UpdateMaintenance)
		apiGroup.DELETE("/maintenances/:id", maintenanceHandlers.DeleteMaintenance)

		// 事件公告API
		apiGroup.GET("/incidents/active", incidentHandlers.GetActiveIncident)
		apiGroup.GET("/incidents", incidentHandlers.GetIncidents)
		apiGroup.GET("/incidents/:id", incidentHandlers.GetIncident)
		apiGroup.POST("/incidents", incidentHandlers.CreateIncident)
		apiGroup.PUT("/incidents/:id", incidentHandlers.UpdateIncident)
		apiGroup.DELETE("/incidents/:id", incidentHandlers.DeleteIncident)

		// 配置API
		apiGroup.GET("/config", configHandlers.GetConfig)
		apiGroup.GET("/config/export", configHandlers.ExportConfig)
		apiGroup.GET("/config/:key", configHandlers.GetConfigValue)
		apiGroup.PUT("/config/:key", configHandlers.UpdateConfig)
		apiGroup.POST("/config/batch", configHandlers.BatchUpdateConfig)
	}

	// 静态文件服务
	router.Static("/css", "./static/css")
	router.Static("/js", "./static/js")
	router.StaticFile("/index.html", "./static/index.html")
	router.StaticFile("/detail.html", "./static/detail.html")
	router.StaticFile("/cache-debug.html", "./static/cache-debug.html")
	router.StaticFile("/test-detail-api.html", "./static/test-detail-api.html")
	// 根路径放最后，避免覆盖 API 路由
	router.GET("/", func(c *gin.Context) {
		c.File("./static/index.html")
	})

	return router
}

// corsMiddleware CORS 中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
