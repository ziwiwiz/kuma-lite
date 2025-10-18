package api

import (
	"github.com/gin-gonic/gin"
)

// SetupRouter 设置路由
func SetupRouter() *gin.Engine {
	router := gin.Default()

	// 跨域中间件
	router.Use(corsMiddleware())

	// API 路由
	apiGroup := router.Group("/api")
	{
		apiGroup.GET("/health", HealthCheck)
		apiGroup.GET("/monitors", GetMonitors)
		apiGroup.GET("/monitors/:id", GetMonitorByID)
		apiGroup.GET("/monitors/:id/history", GetMonitorHistory)
		apiGroup.GET("/stats", GetStats)
	}

	// 静态文件服务
	router.Static("/css", "./static/css")
	router.Static("/js", "./static/js")
	router.StaticFile("/", "./static/index.html")
	router.StaticFile("/index.html", "./static/index.html")
	router.StaticFile("/detail.html", "./static/detail.html")

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
