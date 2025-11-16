package database

import (
	"kuma-lite/backend/models"
	"log"
	"time"
)

// SaveMonitor 保存或更新监控项（只在必要时更新，减少频繁更新）
func SaveMonitor(monitor *models.Monitor) error {
	var existing models.Monitor
	result := DB.Where("id = ?", monitor.ID).First(&existing)

	if result.Error != nil {
		// 不存在,创建新记录
		return DB.Create(monitor).Error
	}

	// 检查是否需要更新（只有关键字段变化时才更新）
	needsUpdate := existing.Name != monitor.Name ||
		existing.Type != monitor.Type ||
		existing.URL != monitor.URL ||
		existing.Group != monitor.Group ||
		existing.GroupOrder != monitor.GroupOrder ||
		existing.Order != monitor.Order ||
		existing.Status != monitor.Status ||
		existing.Uptime != monitor.Uptime

	if !needsUpdate {
		return nil // 没有变化，跳过更新
	}

	// 只更新需要的字段，保留 Enabled 状态
	updates := map[string]interface{}{
		"name":        monitor.Name,
		"type":        monitor.Type,
		"url":         monitor.URL,
		"group":       monitor.Group,
		"group_order": monitor.GroupOrder,
		"order":       monitor.Order,
		"status":      monitor.Status,
		"uptime":      monitor.Uptime,
	}

	return DB.Model(&existing).Updates(updates).Error
}

// GetAllMonitors 获取所有启用的监控项，按分组顺序和组内顺序排列
func GetAllMonitors() ([]models.Monitor, error) {
	var monitors []models.Monitor
	err := DB.Where("enabled = ?", true).
		Order("group_order ASC, `order` ASC").
		Find(&monitors).Error
	return monitors, err
}

// GetMonitorByID 根据 ID 获取监控项
func GetMonitorByID(id int) (*models.Monitor, error) {
	var monitor models.Monitor
	err := DB.Where("id = ?", id).First(&monitor).Error
	if err != nil {
		return nil, err
	}
	return &monitor, nil
}

// SaveHeartBeat 保存心跳记录，返回是否插入了新数据
func SaveHeartBeat(heartbeat *models.HeartBeat) (bool, error) {
	// 检查是否已存在相同的心跳记录（根据 monitorID 和 createdAt）
	var existing models.HeartBeat
	result := DB.Where("monitor_id = ? AND created_at = ?", heartbeat.MonitorID, heartbeat.CreatedAt).First(&existing)

	if result.Error == nil {
		// 已存在，跳过
		return false, nil
	}

	// 不存在，创建新记录
	err := DB.Create(heartbeat).Error
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetRecentHeartBeats 获取监控项最近N条心跳记录(不限制时间范围)
func GetRecentHeartBeats(monitorID int, limit int) ([]models.HeartBeat, error) {
	var heartbeats []models.HeartBeat

	err := DB.Where("monitor_id = ?", monitorID).
		Order("created_at DESC").
		Limit(limit).
		Find(&heartbeats).Error

	// 反转结果，使其按时间升序排列
	for i, j := 0, len(heartbeats)-1; i < j; i, j = i+1, j-1 {
		heartbeats[i], heartbeats[j] = heartbeats[j], heartbeats[i]
	}

	return heartbeats, err
}

// GetHeartBeatHistory 获取监控项的历史心跳记录(按时间范围,不限制条数)
func GetHeartBeatHistory(monitorID int, hours int) ([]models.HeartBeat, error) {
	var heartbeats []models.HeartBeat
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	err := DB.Where("monitor_id = ? AND created_at >= ?", monitorID, since).
		Order("created_at DESC").
		Find(&heartbeats).Error

	// 反转结果，使其按时间升序排列
	for i, j := 0, len(heartbeats)-1; i < j; i, j = i+1, j-1 {
		heartbeats[i], heartbeats[j] = heartbeats[j], heartbeats[i]
	}

	return heartbeats, err
}

// GetStats 获取统计信息
func GetStats() (*models.Stats, error) {
	var stats models.Stats

	// 只统计启用的监控项
	query := DB.Model(&models.Monitor{}).Where("enabled = ?", true)

	// 总监控数
	query.Count(&stats.TotalMonitors)

	// 离线监控数 (status = 0)
	DB.Model(&models.Monitor{}).Where("enabled = ? AND status = ?", true, 0).Count(&stats.DownMonitors)

	// 重试中监控数 (status = 2)
	DB.Model(&models.Monitor{}).Where("enabled = ? AND status = ?", true, 2).Count(&stats.RetryMonitors)

	// 维护中监控数 (status = 1 且最近心跳的 response_time 为 NULL)
	// 使用子查询统计维护中的监控项
	DB.Raw(`
		SELECT COUNT(DISTINCT m.id)
		FROM monitors m
		INNER JOIN heart_beats hb ON hb.monitor_id = m.id
		WHERE m.enabled = ?
		AND m.status = ?
		AND hb.response_time IS NULL
		AND hb.created_at = (
			SELECT MAX(created_at)
			FROM heart_beats
			WHERE monitor_id = m.id
		)
	`, true, 1).Scan(&stats.MaintenanceMonitors)

	// 真正在线的监控数 = status=1 的总数 - 维护中的数量
	var status1Count int64
	DB.Model(&models.Monitor{}).Where("enabled = ? AND status = ?", true, 1).Count(&status1Count)
	stats.UpMonitors = status1Count - stats.MaintenanceMonitors

	// 平均可用率
	var avgUptime float64
	DB.Model(&models.Monitor{}).Where("enabled = ?", true).Select("AVG(uptime)").Scan(&avgUptime)
	stats.AvgUptime = avgUptime

	// 平均响应时间需要从最近的心跳记录计算
	// SQLite 不支持 DISTINCT ON，使用子查询和 GROUP BY
	var avgResponseTime float64
	DB.Raw(`
		SELECT AVG(response_time) 
		FROM (
			SELECT monitor_id, response_time
			FROM heart_beats
			WHERE (monitor_id, created_at) IN (
				SELECT monitor_id, MAX(created_at)
				FROM heart_beats
				WHERE monitor_id IN (SELECT id FROM monitors WHERE enabled = ? AND status = ?)
				GROUP BY monitor_id
			)
		) AS latest_heartbeats
	`, true, 1).Scan(&avgResponseTime)
	stats.AvgResponseTime = avgResponseTime

	return &stats, nil
}

// CleanOldHeartBeats 清理旧的心跳记录
func CleanOldHeartBeats(days int) error {
	threshold := time.Now().AddDate(0, 0, -days)
	return DB.Where("created_at < ?", threshold).Delete(&models.HeartBeat{}).Error
}

// DeleteMonitor 删除监控项及其相关的心跳记录
func DeleteMonitor(id int) error {
	// 开启事务
	tx := DB.Begin()

	// 先删除相关的心跳记录
	if err := tx.Where("monitor_id = ?", id).Delete(&models.HeartBeat{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 再删除监控项
	if err := tx.Where("id = ?", id).Delete(&models.Monitor{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// SyncMonitors 同步监控项列表，将不在新列表中的监控项设置为禁用状态（不删除数据）
// 同时将重新出现的监控项设置为启用状态
func SyncMonitors(currentMonitorIDs []int) error {
	if len(currentMonitorIDs) == 0 {
		// 如果当前没有监控项，不执行操作（可能是获取数据失败）
		log.Println("警告: 获取到的监控项数量为0，跳过同步操作")
		return nil
	}

	// 获取数据库中所有的监控项
	var existingMonitors []models.Monitor
	if err := DB.Find(&existingMonitors).Error; err != nil {
		return err
	}

	// 安全检查：如果数据库中有监控项，但获取到的数量显著少于现有启用数量
	// 则认为可能是数据获取异常，不执行操作
	if len(existingMonitors) > 0 {
		enabledCount := 0
		for _, m := range existingMonitors {
			if m.Enabled {
				enabledCount++
			}
		}
		// 如果新获取的监控项数量少于现有启用数量的50%，认为异常
		if enabledCount > 0 && len(currentMonitorIDs) < enabledCount/2 {
			log.Printf("警告: 获取到的监控项数量(%d)显著少于现有启用数量(%d)，可能是Kuma服务异常，跳过同步操作",
				len(currentMonitorIDs), enabledCount)
			return nil
		}
	}

	// 创建当前监控项ID的map，便于快速查找
	currentIDMap := make(map[int]bool)
	for _, id := range currentMonitorIDs {
		currentIDMap[id] = true
	}

	// 处理监控项的启用/禁用状态
	disabledCount := 0
	enabledCount := 0
	for _, monitor := range existingMonitors {
		if !currentIDMap[monitor.ID] {
			// 这个监控项在Kuma中已不存在，设置为禁用状态
			if monitor.Enabled {
				log.Printf("检测到监控项已从Kuma移除，设置为禁用: [%s] (ID: %d)", monitor.Name, monitor.ID)
				if err := DB.Model(&monitor).Update("enabled", false).Error; err != nil {
					log.Printf("禁用监控项失败 [%s]: %v", monitor.Name, err)
					return err
				}
				disabledCount++
			}
		} else {
			// 监控项在Kuma中存在，如果之前被禁用，重新启用
			if !monitor.Enabled {
				log.Printf("检测到监控项已恢复，设置为启用: [%s] (ID: %d)", monitor.Name, monitor.ID)
				if err := DB.Model(&monitor).Update("enabled", true).Error; err != nil {
					log.Printf("启用监控项失败 [%s]: %v", monitor.Name, err)
					return err
				}
				enabledCount++
			}
		}
	}

	if disabledCount > 0 || enabledCount > 0 {
		log.Printf("同步完成: 禁用了 %d 个监控项, 启用了 %d 个监控项", disabledCount, enabledCount)
	}

	return nil
}
