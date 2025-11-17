package scheduler

import (
	"kuma-lite/backend/cache"
	"kuma-lite/backend/config"
	"kuma-lite/backend/database"
	"kuma-lite/backend/fetcher"
	"kuma-lite/backend/logger"
	"strconv"
	"time"
)

// StartScheduler 启动定时任务
func StartScheduler() {
	cfg := config.AppConfig

	logger.Info("╔═══════════════════════════════════════════════════════╗")
	logger.Info("║          后台定时器初始化                              ║")
	logger.Info("╚═══════════════════════════════════════════════════════╝")

	// 立即执行一次数据获取
	go func() {
		// 添加延迟，确保数据库初始化完成
		time.Sleep(2 * time.Second)
		logger.Info("🚀 [系统启动] 触发初始数据采集...")
		fetchAndStore("系统启动")
	}()

	// 定时获取数据 - 后台5分钟全局定时器
	ticker := time.NewTicker(cfg.FetchInterval)
	go func() {
		logger.Info("⏰ [后台定时器] 已启动 - 间隔: %v (每5分钟自动采集)", cfg.FetchInterval)
		for range ticker.C {
			logger.Info("")
			logger.Info("╔═══════════════════════════════════════════════════════╗")
			logger.Info("║  ⏰ 后台5分钟定时器触发 - %s", time.Now().Format("2006-01-02 15:04:05"))
			logger.Info("╚═══════════════════════════════════════════════════════╝")
			fetchAndStore("后台5分钟定时")
		}
	}()

	// 每天清理一次旧数据
	cleanupTicker := time.NewTicker(24 * time.Hour)
	go func() {
		logger.Info("🗑️  [数据清理定时器] 已启动 - 间隔: 24小时, 保留 %d 天数据", cfg.DataRetentionDays)
		for range cleanupTicker.C {
			cleanOldData()
		}
	}()

	// 每5分钟清理一次过期的主页缓存
	cacheCleanupTicker := time.NewTicker(5 * time.Minute)
	go func() {
		logger.Info("🧹 [缓存清理定时器] 已启动 - 间隔: 5分钟")
		for range cacheCleanupTicker.C {
			logger.Info("🧹 [缓存清理定时器] 开始清理过期缓存...")
			cache.CleanExpiredMainPageCaches()
		}
	}()

	logger.Info("╔═══════════════════════════════════════════════════════╗")
	logger.Info("║          所有定时器启动完成                            ║")
	logger.Info("╚═══════════════════════════════════════════════════════╝")
	logger.Info("✅ 数据采集间隔: %v", cfg.FetchInterval)
	logger.Info("✅ 数据保留天数: %d 天", cfg.DataRetentionDays)
	logger.Info("")
}

// FetchAndStore 获取并存储数据(导出供API调用,默认来源)
func FetchAndStore() {
	fetchAndStore("前端触发")
}

// FetchAndStoreWithSource 获取并存储数据(导出供API调用,指定来源)
func FetchAndStoreWithSource(source string) {
	fetchAndStore(source)
}

// getMonitorIDs 从map中提取监控项ID列表用于日志显示
func getMonitorIDs(monitors map[string]bool) []string {
	ids := make([]string, 0, len(monitors))
	for id := range monitors {
		ids = append(ids, id)
	}
	return ids
}

// fetchAndStore 获取并存储数据
func fetchAndStore(source string) {
	logger.Info("═══════════════════════════════════════════════════════")
	logger.Info("🚀 [%s] ▶ 阶段1: 开始获取 Uptime Kuma 数据", source)
	logger.Info("═══════════════════════════════════════════════════════")

	// 获取状态页面和心跳数据
	statusPage, heartbeatData, err := fetcher.FetchKumaData()
	if err != nil {
		logger.Error("❌ [%s] ✗ 获取数据失败: %v", source, err)
		logger.Info("═══════════════════════════════════════════════════════")
		return
	}
	logger.Info("✅ [%s] ✓ 成功从Kuma获取原始数据", source)

	// 解析监控项（结合心跳数据）
	monitors := fetcher.ParseMonitors(statusPage, heartbeatData)
	logger.Info("📊 [%s] ✓ 解析完成: 共 %d 个监控项", source, len(monitors))

	// 收集当前的监控项ID列表
	currentMonitorIDs := make([]int, 0, len(monitors))
	for _, monitor := range monitors {
		currentMonitorIDs = append(currentMonitorIDs, monitor.ID)
	}

	// 同步删除不存在的监控项
	if err := database.SyncMonitors(currentMonitorIDs); err != nil {
		logger.Warn("⚠️  [%s] ! 同步删除监控项失败: %v", source, err)
	}

	logger.Info("───────────────────────────────────────────────────────")
	logger.Info("💾 [%s] ▶ 阶段2: 开始更新数据库", source)
	logger.Info("───────────────────────────────────────────────────────")

	// 保存监控项和心跳记录
	// 记录哪些监控项有新数据
	updatedMonitors := make(map[string]bool)
	newHeartbeatCount := 0
	totalHeartbeats := 0
	startTime := time.Now()

	for _, monitor := range monitors {
		if err := database.SaveMonitor(&monitor); err != nil {
			logger.Error("❌ [%s] ✗ 保存监控项失败 [%s]: %v", source, monitor.Name, err)
			continue
		}

		// 批量保存心跳历史记录
		if heartbeatData != nil {
			heartbeats := fetcher.ParseHeartBeats(monitor.ID, heartbeatData)
			totalHeartbeats += len(heartbeats)

			if len(heartbeats) > 0 {
				// 使用批量保存
				newCount, err := database.BatchSaveHeartBeats(heartbeats)
				if err != nil {
					logger.Error("❌ [%s] ✗ 批量保存心跳记录失败 [监控项 %d]: %v", source, monitor.ID, err)
					continue
				}

				if newCount > 0 {
					// 有新的心跳记录，标记该监控项需要更新缓存
					monitorIDStr := strconv.Itoa(monitor.ID)
					if !updatedMonitors[monitorIDStr] {
						updatedMonitors[monitorIDStr] = true
						newHeartbeatCount++
					}
					logger.Info("  📝 [%s]   监控项 [%s] (ID:%d): 新增 %d 条记录", source, monitor.Name, monitor.ID, newCount)
				}
			}
		}
	}

	elapsed := time.Since(startTime)
	logger.Info("✅ [%s] ✓ 数据库更新完成: 处理 %d 条心跳记录, 其中 %d 个监控项有新数据 (耗时: %v)", source, totalHeartbeats, newHeartbeatCount, elapsed)

	logger.Info("───────────────────────────────────────────────────────")
	logger.Info("🔍 [%s] ▶ 阶段3: 比较新记录与缓存", source)
	logger.Info("───────────────────────────────────────────────────────")

	if newHeartbeatCount > 0 {
		logger.Info("🆕 [%s] ✓ 检测到数据变更: %d 个监控项有新记录", source, newHeartbeatCount)
		logger.Info("📋 [%s]   变更的监控项ID: %v", source, getMonitorIDs(updatedMonitors))

		logger.Info("───────────────────────────────────────────────────────")
		logger.Info("🔄 [%s] ▶ 阶段4: 开始更新缓存", source)
		logger.Info("───────────────────────────────────────────────────────")

		// 只为有新数据的监控项清空历史记录缓存(强制后续请求从数据库获取最新数据)
		logger.Info("🗑️  [%s] ✓ 清空旧缓存...", source)
		for monitorID := range updatedMonitors {
			cache.InvalidateMonitorCache(monitorID)
			logger.Info("  🗑️  [%s]   监控项 %s: 已清空所有时间段缓存", source, monitorID)
		}

		// 清空监控项列表缓存（因为可能有状态变化）
		cache.InvalidateAllMonitorCaches()
		logger.Info("  🗑️  [%s]   已清空全局监控列表和统计缓存", source)

		// 预热缓存: 为所有有新数据的监控项预先加载最近100条记录到缓存
		logger.Info("🔥 [%s] ✓ 预热缓存 (最近100次记录)...", source)
		successCount := 0
		for monitorIDStr := range updatedMonitors {
			monitorID, _ := strconv.Atoi(monitorIDStr)
			// 获取最近100条记录并存入缓存
			heartbeats, err := database.GetRecentHeartBeats(monitorID, 100)
			if err == nil {
				cacheKey := "history_" + monitorIDStr + "_limit_100"
				cache.Set(cacheKey, heartbeats, cache.MainPageCacheDuration)
				logger.Info("  💾 [%s]   监控项 %s: 已缓存 %d 条记录 (TTL:60秒)", source, monitorIDStr, len(heartbeats))
				successCount++
			} else {
				logger.Warn("  ⚠️  [%s]   监控项 %s: 缓存失败 - %v", source, monitorIDStr, err)
			}
		}
		logger.Info("✅ [%s] ✓ 缓存预热完成: 成功 %d/%d 个监控项", source, successCount, len(updatedMonitors))
	} else {
		logger.Info("ℹ️  [%s] ○ 数据无变化: 所有记录均已存在", source)
		logger.Info("───────────────────────────────────────────────────────")
		logger.Info("⏭️  [%s] ▶ 阶段4: 跳过缓存更新 (缓存保留)", source)
		logger.Info("───────────────────────────────────────────────────────")
		logger.Info("ℹ️  [%s] ○ 当前缓存继续有效,无需更新", source)
	}

	// 缓存事件和维护公告数据（来自 Kuma）
	if statusPage != nil {
		cache.Set("kuma_incident", statusPage.Incident, config.AppConfig.CacheDuration)
		cache.Set("kuma_maintenance_list", statusPage.MaintenanceList, config.AppConfig.CacheDuration)
		logger.Info("📌 [%s] ✓ 已缓存事件和维护公告数据", source)
	}

	logger.Info("═══════════════════════════════════════════════════════")
	logger.Info("🎉 [%s] ✓ 任务完成", source)
	if newHeartbeatCount > 0 {
		logger.Info("📊 [%s] 📈 本次更新: %d个监控项有新数据, 缓存已更新", source, newHeartbeatCount)
	} else {
		logger.Info("📊 [%s] 💤 本次更新: 无新数据, 缓存未变更", source)
	}
	logger.Info("═══════════════════════════════════════════════════════")
}

// cleanOldData 清理旧数据
func cleanOldData() {
	cfg := config.AppConfig
	logger.Info("开始清理 %d 天前的数据...", cfg.DataRetentionDays)

	if err := database.CleanOldHeartBeats(cfg.DataRetentionDays); err != nil {
		logger.Error("清理旧数据失败: %v", err)
	} else {
		logger.Info("旧数据清理完成")
	}
}
