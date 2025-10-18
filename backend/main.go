package main

import (
	"kuma-lite/backend/api"
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/scheduler"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.Println("Kuma-Lite 启动中...")

	// 加载配置
	cfg := config.LoadConfig()
	log.Printf("配置加载成功: Kuma API = %s, Slug = %s", cfg.KumaAPIURL, cfg.KumaStatusSlug)

	// 初始化数据库
	if err := database.InitDB(cfg.DBPath); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	defer database.CloseDB()

	// 初始化缓存
	cache.InitCache(cfg.CacheDuration, cfg.CacheDuration*2)
	log.Println("缓存初始化成功")

	// 启动调度器
	scheduler.StartScheduler()

	// 设置路由
	router := api.SetupRouter()

	// 启动服务器
	addr := ":" + cfg.ServerPort
	log.Printf("服务器启动在端口 %s", cfg.ServerPort)
	log.Printf("访问 http://localhost:%s 查看监控仪表盘", cfg.ServerPort)

	// 优雅关闭
	go func() {
		if err := router.Run(addr); err != nil {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("正在关闭服务器...")
	log.Println("服务器已关闭")
}
