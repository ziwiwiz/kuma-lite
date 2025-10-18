package scheduler

import (
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/fetcher"
	"log"
	"time"
)

// StartScheduler 启动定时任务
func StartScheduler() {
	cfg := config.AppConfig

	// 立即执行一次数据获取
	go func() {
		// 添加延迟，确保数据库初始化完成
		time.Sleep(2 * time.Second)
		fetchAndStore()
	}()

	// 定时获取数据
	ticker := time.NewTicker(cfg.FetchInterval)
	go func() {
		for range ticker.C {
			fetchAndStore()
		}
	}()

	// 每天清理一次旧数据
	cleanupTicker := time.NewTicker(24 * time.Hour)
	go func() {
		for range cleanupTicker.C {
			cleanOldData()
		}
	}()

	log.Printf("调度器已启动: 数据获取间隔 %v, 数据保留 %d 天", cfg.FetchInterval, cfg.DataRetentionDays)
}

// fetchAndStore 获取并存储数据
func fetchAndStore() {
	log.Println("开始获取 Uptime Kuma 数据...")

	// 获取状态页面和心跳数据
	statusPage, heartbeatData, err := fetcher.FetchKumaData()
	if err != nil {
		log.Printf("获取数据失败: %v", err)
		return
	}

	// 解析监控项（结合心跳数据）
	monitors := fetcher.ParseMonitors(statusPage, heartbeatData)

	// 保存监控项和心跳记录
	for _, monitor := range monitors {
		if err := database.SaveMonitor(&monitor); err != nil {
			log.Printf("保存监控项失败 [%s]: %v", monitor.Name, err)
			continue
		}

		// 解析并保存心跳历史记录
		if heartbeatData != nil {
			heartbeats := fetcher.ParseHeartBeats(monitor.ID, heartbeatData)
			for _, hb := range heartbeats {
				if err := database.SaveHeartBeat(&hb); err != nil {
					// 心跳记录可能重复，不打印错误
					continue
				}
			}
		}
	}

	log.Printf("数据获取成功: %d 个监控项", len(monitors))
}

// cleanOldData 清理旧数据
func cleanOldData() {
	cfg := config.AppConfig
	log.Printf("开始清理 %d 天前的数据...", cfg.DataRetentionDays)

	if err := database.CleanOldHeartBeats(cfg.DataRetentionDays); err != nil {
		log.Printf("清理旧数据失败: %v", err)
	} else {
		log.Println("旧数据清理完成")
	}
}
