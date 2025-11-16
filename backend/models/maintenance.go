package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// Maintenance 维护计划模型
type Maintenance struct {
	ID             int        `gorm:"primaryKey;autoIncrement" json:"id"`
	Title          string     `gorm:"size:255;not null" json:"title"`
	Description    string     `gorm:"type:text" json:"description"`
	Strategy       string     `gorm:"size:50;default:manual" json:"strategy"` // manual, single, recurring-interval, scheduled
	Active         bool       `gorm:"default:true" json:"active"`
	Status         string     `gorm:"size:50;default:inactive" json:"status"` // inactive, under-maintenance, scheduled, ended
	StartDate      *time.Time `json:"startDate,omitempty"`
	EndDate        *time.Time `json:"endDate,omitempty"`
	Timezone       string     `gorm:"size:50;default:UTC" json:"timezone"`
	TimezoneOffset string     `gorm:"size:10;default:+00:00" json:"timezoneOffset"` // 例如: +08:00
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
	Monitors       []Monitor  `gorm:"many2many:maintenance_monitors;" json:"monitors,omitempty"`
}

// Incident 事件公告模型
type Incident struct {
	ID              int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Title           string    `gorm:"size:255;not null" json:"title"`
	Content         string    `gorm:"type:text;not null" json:"content"` // Markdown格式
	Style           string    `gorm:"size:20;default:info" json:"style"` // info, warning, danger, light, dark
	Active          bool      `gorm:"default:true" json:"active"`
	CreatedDate     time.Time `json:"createdDate"`
	LastUpdatedDate time.Time `json:"lastUpdatedDate"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

// SiteConfig 站点配置模型
type SiteConfig struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Key         string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"type:text" json:"value"`
	Type        string    `gorm:"size:20;default:string" json:"type"` // string, boolean, json, number
	Category    string    `gorm:"size:50" json:"category"`            // theme, appearance, features, etc.
	Description string    `gorm:"size:500" json:"description"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

// JSONStringArray 用于存储JSON字符串数组
type JSONStringArray []string

// Scan 实现 sql.Scanner 接口
func (j *JSONStringArray) Scan(value interface{}) error {
	if value == nil {
		*j = []string{}
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}

	return json.Unmarshal(bytes, j)
}

// Value 实现 driver.Valuer 接口
func (j JSONStringArray) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "[]", nil
	}
	return json.Marshal(j)
}

// MaintenanceResponse 维护计划API响应
type MaintenanceResponse struct {
	Success      bool          `json:"success"`
	Maintenances []Maintenance `json:"maintenances,omitempty"`
	Maintenance  *Maintenance  `json:"maintenance,omitempty"`
	Error        string        `json:"error,omitempty"`
}

// IncidentResponse 事件公告API响应
type IncidentResponse struct {
	Success  bool      `json:"success"`
	Incident *Incident `json:"incident,omitempty"`
	Error    string    `json:"error,omitempty"`
}

// ConfigResponse 配置API响应
type ConfigResponse struct {
	Success bool                   `json:"success"`
	Config  map[string]interface{} `json:"config,omitempty"`
	Error   string                 `json:"error,omitempty"`
}
