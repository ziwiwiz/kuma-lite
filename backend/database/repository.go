package database

import (
	"kuma-lite/backend/models"
	"time"
)

// SaveMonitor 保存或更新监控项
func SaveMonitor(monitor *models.Monitor) error {
	var existing models.Monitor
	result := DB.Where("id = ?", monitor.ID).First(&existing)

	if result.Error != nil {
		// 不存在,创建新记录
		return DB.Create(monitor).Error
	}

	// 存在,更新记录
	return DB.Model(&existing).Updates(monitor).Error
}

// GetAllMonitors 获取所有监控项
func GetAllMonitors() ([]models.Monitor, error) {
	var monitors []models.Monitor
	err := DB.Order("id ASC").Find(&monitors).Error
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

// SaveHeartBeat 保存心跳记录
func SaveHeartBeat(heartbeat *models.HeartBeat) error {
	// 检查是否已存在相同的心跳记录（根据 monitorID 和 createdAt）
	var existing models.HeartBeat
	result := DB.Where("monitor_id = ? AND created_at = ?", heartbeat.MonitorID, heartbeat.CreatedAt).First(&existing)

	if result.Error == nil {
		// 已存在，跳过
		return nil
	}

	// 不存在，创建新记录
	return DB.Create(heartbeat).Error
}

// GetHeartBeatHistory 获取监控项的历史心跳记录
func GetHeartBeatHistory(monitorID int, hours int) ([]models.HeartBeat, error) {
	var heartbeats []models.HeartBeat
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	err := DB.Where("monitor_id = ? AND created_at >= ?", monitorID, since).
		Order("created_at ASC").
		Find(&heartbeats).Error

	return heartbeats, err
}

// GetStats 获取统计信息
func GetStats() (*models.Stats, error) {
	var stats models.Stats

	// 总监控数
	DB.Model(&models.Monitor{}).Count(&stats.TotalMonitors)

	// 正常监控数
	DB.Model(&models.Monitor{}).Where("status = ?", 1).Count(&stats.UpMonitors)

	// 异常监控数
	DB.Model(&models.Monitor{}).Where("status = ?", 0).Count(&stats.DownMonitors)

	// 平均可用率
	var avgUptime float64
	DB.Model(&models.Monitor{}).Select("AVG(uptime)").Scan(&avgUptime)
	stats.AvgUptime = avgUptime

	// 平均响应时间
	var avgResponseTime float64
	DB.Model(&models.Monitor{}).Where("status = ?", 1).Select("AVG(response_time)").Scan(&avgResponseTime)
	stats.AvgResponseTime = avgResponseTime

	return &stats, nil
}

// CleanOldHeartBeats 清理旧的心跳记录
func CleanOldHeartBeats(days int) error {
	threshold := time.Now().AddDate(0, 0, -days)
	return DB.Where("created_at < ?", threshold).Delete(&models.HeartBeat{}).Error
}
