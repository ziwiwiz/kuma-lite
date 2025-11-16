package main

import (
	"kuma-lite/backend/api"
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/logger"
	"kuma-lite/backend/scheduler"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	// 加载配置
	cfg := config.LoadConfig()

	// 初始化日志系统
	logger.Init(cfg.LogLevel, cfg.LogEnableColor)
	logger.Info("Kuma-Lite 启动中...")
	logger.Info("配置加载成功: Kuma API = %s, Slug = %s", cfg.KumaAPIURL, cfg.KumaStatusSlug)

	// 初始化数据库
	if err := database.InitDB(cfg.DBPath); err != nil {
		logger.Fatal("数据库初始化失败: %v", err)
	}
	defer database.CloseDB()

	// 初始化缓存
	cache.InitCache(cfg.CacheDuration, cfg.CacheDuration*2)
	logger.Info("缓存初始化成功")

	// 启动调度器
	scheduler.StartScheduler()

	// 设置路由
	router := api.SetupRouter()

	// 启动服务器
	addr := ":" + cfg.ServerPort
	logger.Info("服务器启动在端口 %s", cfg.ServerPort)
	logger.Info("访问 http://localhost:%s 查看监控仪表盘", cfg.ServerPort)

	// 优雅关闭
	go func() {
		if err := router.Run(addr); err != nil {
			logger.Fatal("服务器启动失败: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("正在关闭服务器...")
	logger.Info("服务器已关闭")
}
