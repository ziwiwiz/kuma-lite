package database

import (
	"fmt"
	"kuma-lite/backend/models"
	"time"

	"gorm.io/gorm"
)

// MaintenanceRepository 维护计划数据访问层
type MaintenanceRepository struct {
	db *gorm.DB
}

// NewMaintenanceRepository 创建维护计划仓库
func NewMaintenanceRepository(db *gorm.DB) *MaintenanceRepository {
	return &MaintenanceRepository{db: db}
}

// GetAllActive 获取所有活跃的维护计划
func (r *MaintenanceRepository) GetAllActive() ([]models.Maintenance, error) {
	var maintenances []models.Maintenance
	err := r.db.Preload("Monitors").
		Where("active = ?", true).
		Order("created_at DESC").
		Find(&maintenances).Error
	return maintenances, err
}

// GetByID 根据ID获取维护计划
func (r *MaintenanceRepository) GetByID(id int) (*models.Maintenance, error) {
	var maintenance models.Maintenance
	err := r.db.Preload("Monitors").First(&maintenance, id).Error
	if err != nil {
		return nil, err
	}
	return &maintenance, nil
}

// Create 创建维护计划
func (r *MaintenanceRepository) Create(maintenance *models.Maintenance) error {
	return r.db.Create(maintenance).Error
}

// Update 更新维护计划
func (r *MaintenanceRepository) Update(maintenance *models.Maintenance) error {
	return r.db.Save(maintenance).Error
}

// Delete 删除维护计划
func (r *MaintenanceRepository) Delete(id int) error {
	return r.db.Delete(&models.Maintenance{}, id).Error
}

// UpdateStatus 更新维护状态
func (r *MaintenanceRepository) UpdateStatus(id int, status string) error {
	return r.db.Model(&models.Maintenance{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// GetCurrent 获取当前进行中或即将开始的维护
func (r *MaintenanceRepository) GetCurrent() ([]models.Maintenance, error) {
	now := time.Now()
	var maintenances []models.Maintenance

	err := r.db.Preload("Monitors").
		Where("active = ? AND status IN ?", true, []string{"under-maintenance", "scheduled"}).
		Where("(start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)", now, now).
		Order("start_date ASC").
		Find(&maintenances).Error

	return maintenances, err
}

// IncidentRepository 事件公告数据访问层
type IncidentRepository struct {
	db *gorm.DB
}

// NewIncidentRepository 创建事件公告仓库
func NewIncidentRepository(db *gorm.DB) *IncidentRepository {
	return &IncidentRepository{db: db}
}

// GetActive 获取活跃的事件公告
func (r *IncidentRepository) GetActive() (*models.Incident, error) {
	var incident models.Incident
	err := r.db.Where("active = ?", true).
		Order("created_date DESC").
		First(&incident).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &incident, err
}

// GetAll 获取所有事件公告
func (r *IncidentRepository) GetAll() ([]models.Incident, error) {
	var incidents []models.Incident
	err := r.db.Order("created_date DESC").Find(&incidents).Error
	return incidents, err
}

// GetByID 根据ID获取事件公告
func (r *IncidentRepository) GetByID(id int) (*models.Incident, error) {
	var incident models.Incident
	err := r.db.First(&incident, id).Error
	if err != nil {
		return nil, err
	}
	return &incident, nil
}

// Create 创建事件公告
func (r *IncidentRepository) Create(incident *models.Incident) error {
	if incident.CreatedDate.IsZero() {
		incident.CreatedDate = time.Now()
	}
	incident.LastUpdatedDate = incident.CreatedDate
	return r.db.Create(incident).Error
}

// Update 更新事件公告
func (r *IncidentRepository) Update(incident *models.Incident) error {
	incident.LastUpdatedDate = time.Now()
	return r.db.Save(incident).Error
}

// Delete 删除事件公告
func (r *IncidentRepository) Delete(id int) error {
	return r.db.Delete(&models.Incident{}, id).Error
}

// ConfigRepository 配置数据访问层
type ConfigRepository struct {
	db *gorm.DB
}

// NewConfigRepository 创建配置仓库
func NewConfigRepository(db *gorm.DB) *ConfigRepository {
	return &ConfigRepository{db: db}
}

// GetAll 获取所有配置
func (r *ConfigRepository) GetAll() ([]models.SiteConfig, error) {
	var configs []models.SiteConfig
	err := r.db.Order("category, key").Find(&configs).Error
	return configs, err
}

// GetByCategory 根据分类获取配置
func (r *ConfigRepository) GetByCategory(category string) ([]models.SiteConfig, error) {
	var configs []models.SiteConfig
	err := r.db.Where("category = ?", category).Find(&configs).Error
	return configs, err
}

// GetByKey 根据键获取配置
func (r *ConfigRepository) GetByKey(key string) (*models.SiteConfig, error) {
	var config models.SiteConfig
	err := r.db.Where("key = ?", key).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// Set 设置配置值
func (r *ConfigRepository) Set(key, value string) error {
	var config models.SiteConfig
	err := r.db.Where("key = ?", key).First(&config).Error

	if err == gorm.ErrRecordNotFound {
		// 不存在则创建
		config = models.SiteConfig{
			Key:   key,
			Value: value,
			Type:  "string",
		}
		return r.db.Create(&config).Error
	} else if err != nil {
		return err
	}

	// 存在则更新
	config.Value = value
	return r.db.Save(&config).Error
}

// Delete 删除配置
func (r *ConfigRepository) Delete(key string) error {
	return r.db.Where("key = ?", key).Delete(&models.SiteConfig{}).Error
}

// GetAsMap 获取所有配置作为map，按分类分组
func (r *ConfigRepository) GetAsMap() (map[string]map[string]interface{}, error) {
	configs, err := r.GetAll()
	if err != nil {
		return nil, err
	}

	result := make(map[string]map[string]interface{})
	for _, config := range configs {
		category := config.Category
		if category == "" {
			category = "general"
		}

		if result[category] == nil {
			result[category] = make(map[string]interface{})
		}

		// 根据类型转换值
		var value interface{}
		switch config.Type {
		case "boolean":
			value = config.Value == "true"
		case "number":
			// 简单处理，实际使用时可能需要 strconv
			value = config.Value
		case "json":
			value = config.Value
		default:
			value = config.Value
		}

		result[category][config.Key] = value
	}

	return result, nil
}

// BatchUpdate 批量更新配置
func (r *ConfigRepository) BatchUpdate(updates map[string]string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for key, value := range updates {
			var config models.SiteConfig
			err := tx.Where("key = ?", key).First(&config).Error

			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("配置 %s 不存在", key)
			} else if err != nil {
				return err
			}

			config.Value = value
			if err := tx.Save(&config).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
