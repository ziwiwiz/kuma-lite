package models

import (
	"time"
)

// Monitor 监控项模型
type Monitor struct {
	ID           int       `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:255;not null" json:"name"`
	Type         string    `gorm:"size:50" json:"type"`
	URL          string    `gorm:"size:500" json:"url"`
	Group        string    `gorm:"size:100" json:"group"`       // Kuma 分组
	GroupOrder   int       `gorm:"default:0" json:"groupOrder"` // 分组排序顺序
	Status       int       `gorm:"default:0" json:"status"`     // 0-异常, 1-正常, 2-维护中
	Uptime       float64   `json:"uptime"`
	ResponseTime int       `json:"responseTime"` // 毫秒
	UpdatedAt    time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

// HeartBeat 心跳记录模型
type HeartBeat struct {
	ID           int       `gorm:"primaryKey;autoIncrement" json:"id"`
	MonitorID    int       `gorm:"index;not null" json:"monitorId"`
	Status       int       `gorm:"not null" json:"status"`
	ResponseTime int       `json:"responseTime"` // 毫秒
	Message      string    `gorm:"size:500" json:"message"`
	CreatedAt    time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

// Stats 统计信息
type Stats struct {
	TotalMonitors   int64   `json:"totalMonitors"`
	UpMonitors      int64   `json:"upMonitors"`
	DownMonitors    int64   `json:"downMonitors"`
	AvgUptime       float64 `json:"avgUptime"`
	AvgResponseTime float64 `json:"avgResponseTime"`
}

// APIResponse API 响应结构
type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Timestamp time.Time   `json:"timestamp,omitempty"`
}
