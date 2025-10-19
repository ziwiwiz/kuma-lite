package scheduler

import (
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/fetcher"
	"log"
	"strconv"
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

	// 收集当前的监控项ID列表
	currentMonitorIDs := make([]int, 0, len(monitors))
	for _, monitor := range monitors {
		currentMonitorIDs = append(currentMonitorIDs, monitor.ID)
	}

	// 同步删除不存在的监控项
	if err := database.SyncMonitors(currentMonitorIDs); err != nil {
		log.Printf("同步删除监控项失败: %v", err)
	}

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

	// 数据获取成功后，清空相关缓存以便下次请求时获取最新数据
	cache.Delete("monitors")
	cache.Delete("stats")

	// 为每个监控项清空历史记录缓存
	for _, monitor := range monitors {
		// 清空 limit 模式的缓存(主页使用)
		cache.Delete("history_" + strconv.Itoa(monitor.ID) + "_limit_100")

		// 清空不同时间范围的历史记录缓存(详情页使用)
		for _, hours := range []string{"1", "3", "6", "12", "24", "48", "168"} {
			cacheKey := "history_" + strconv.Itoa(monitor.ID) + "_" + hours + "h"
			cache.Delete(cacheKey)
		}
	}
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
