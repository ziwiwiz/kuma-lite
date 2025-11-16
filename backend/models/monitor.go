package models

import (
	"time"
)

// Monitor 监控项模型
type Monitor struct {
	ID          int             `gorm:"primaryKey" json:"id"`
	Name        string          `gorm:"size:255;not null" json:"name"`
	Type        string          `gorm:"size:50;default:http" json:"type"` // http, tcp, ping, dns, etc.
	URL         string          `gorm:"size:500" json:"url"`
	Method      string          `gorm:"size:20" json:"method"`        // GET, POST, PUT, DELETE, etc.
	Tags        JSONStringArray `gorm:"type:text" json:"tags"`        // JSON array: ["production", "api"]
	Description string          `gorm:"type:text" json:"description"` // 监控项描述
	Group       string          `gorm:"size:100" json:"group"`        // Kuma 分组
	GroupOrder  int             `gorm:"default:0" json:"groupOrder"`  // 分组排序顺序
	Order       int             `gorm:"default:0" json:"order"`       // 监控项在组内的排序顺序
	Status      int             `gorm:"default:0" json:"status"`      // 0-异常, 1-正常, 2-维护中, -1-已禁用
	Enabled     bool            `gorm:"default:true" json:"enabled"`  // 是否在界面启用显示
	Uptime      float64         `json:"uptime"`                       // 计算字段，不存储
	CreatedAt   time.Time       `gorm:"autoCreateTime" json:"createdAt"`
}

// HeartBeat 心跳记录模型
type HeartBeat struct {
	ID           int       `gorm:"primaryKey;autoIncrement" json:"id"`
	MonitorID    int       `gorm:"index;not null" json:"monitorId"`
	Status       int       `gorm:"not null" json:"status"`
	ResponseTime *int      `json:"responseTime"` // 毫秒，使用指针以支持 NULL
	Message      string    `gorm:"size:500" json:"message"`
	CreatedAt    time.Time `gorm:"autoCreateTime;index" json:"createdAt"`
}

// Stats 统计信息
type Stats struct {
	TotalMonitors       int64   `json:"totalMonitors"`
	UpMonitors          int64   `json:"upMonitors"`          // 真正在线的(不含维护中)
	DownMonitors        int64   `json:"downMonitors"`        // 离线的
	RetryMonitors       int64   `json:"retryMonitors"`       // 重试中的
	MaintenanceMonitors int64   `json:"maintenanceMonitors"` // 维护中的
	AvgUptime           float64 `json:"avgUptime"`
	AvgResponseTime     float64 `json:"avgResponseTime"`
}

// APIResponse API 响应结构
type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Timestamp time.Time   `json:"timestamp,omitempty"`
}
