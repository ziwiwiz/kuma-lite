package api

import (
	"kuma-lite/backend/cache"
	"kuma-lite/backend/database"
	"kuma-lite/backend/fetcher"
	"kuma-lite/backend/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// MaintenanceHandlers 维护公告处理器集合
type MaintenanceHandlers struct {
	repo *database.MaintenanceRepository
}

// NewMaintenanceHandlers 创建维护处理器
func NewMaintenanceHandlers(db *database.MaintenanceRepository) *MaintenanceHandlers {
	return &MaintenanceHandlers{repo: db}
}

// GetMaintenances 获取所有活跃的维护计划
// GET /api/maintenances
func (h *MaintenanceHandlers) GetMaintenances(c *gin.Context) {
	maintenances, err := h.repo.GetAllActive()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.MaintenanceResponse{
			Success: false,
			Error:   "获取维护计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.MaintenanceResponse{
		Success:      true,
		Maintenances: maintenances,
	})
}

// GetCurrentMaintenances 获取当前进行中或即将开始的维护（从 Kuma 缓存）
// GET /api/maintenances/current
func (h *MaintenanceHandlers) GetCurrentMaintenances(c *gin.Context) {
	// 从缓存读取 Kuma 的 maintenanceList 数据
	cached, found := cache.Get("kuma_maintenance_list")
	if !found {
		c.JSON(http.StatusOK, models.MaintenanceResponse{
			Success:      true,
			Maintenances: []models.Maintenance{},
		})
		return
	}

	kumaMaintenances := cached.([]fetcher.KumaMaintenance)

	// 转换为前端需要的格式
	result := make([]models.Maintenance, 0, len(kumaMaintenances))
	for _, km := range kumaMaintenances {
		// 解析时间字符串
		startDate, _ := time.Parse("2006-01-02 15:04:05", km.StartDate)
		endDate, _ := time.Parse("2006-01-02 15:04:05", km.EndDate)

		maintenance := models.Maintenance{
			ID:          km.ID,
			Title:       km.Title,
			Description: km.Description,
			Strategy:    km.Strategy,
			StartDate:   &startDate,
			EndDate:     &endDate,
			Status:      km.Status,
		}
		result = append(result, maintenance)
	}

	c.JSON(http.StatusOK, models.MaintenanceResponse{
		Success:      true,
		Maintenances: result,
	})
}

// GetMaintenance 获取单个维护计划
// GET /api/maintenances/:id
func (h *MaintenanceHandlers) GetMaintenance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.MaintenanceResponse{
			Success: false,
			Error:   "无效的维护ID",
		})
		return
	}

	maintenance, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.MaintenanceResponse{
			Success: false,
			Error:   "维护计划不存在",
		})
		return
	}

	c.JSON(http.StatusOK, models.MaintenanceResponse{
		Success:     true,
		Maintenance: maintenance,
	})
}

// CreateMaintenance 创建维护计划
// POST /api/maintenances
func (h *MaintenanceHandlers) CreateMaintenance(c *gin.Context) {
	var maintenance models.Maintenance
	if err := c.ShouldBindJSON(&maintenance); err != nil {
		c.JSON(http.StatusBadRequest, models.MaintenanceResponse{
			Success: false,
			Error:   "请求参数错误: " + err.Error(),
		})
		return
	}

	if err := h.repo.Create(&maintenance); err != nil {
		c.JSON(http.StatusInternalServerError, models.MaintenanceResponse{
			Success: false,
			Error:   "创建维护计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.MaintenanceResponse{
		Success:     true,
		Maintenance: &maintenance,
	})
}

// UpdateMaintenance 更新维护计划
// PUT /api/maintenances/:id
func (h *MaintenanceHandlers) UpdateMaintenance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.MaintenanceResponse{
			Success: false,
			Error:   "无效的维护ID",
		})
		return
	}

	var maintenance models.Maintenance
	if err := c.ShouldBindJSON(&maintenance); err != nil {
		c.JSON(http.StatusBadRequest, models.MaintenanceResponse{
			Success: false,
			Error:   "请求参数错误: " + err.Error(),
		})
		return
	}

	maintenance.ID = id
	if err := h.repo.Update(&maintenance); err != nil {
		c.JSON(http.StatusInternalServerError, models.MaintenanceResponse{
			Success: false,
			Error:   "更新维护计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.MaintenanceResponse{
		Success:     true,
		Maintenance: &maintenance,
	})
}

// DeleteMaintenance 删除维护计划
// DELETE /api/maintenances/:id
func (h *MaintenanceHandlers) DeleteMaintenance(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.MaintenanceResponse{
			Success: false,
			Error:   "无效的维护ID",
		})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, models.MaintenanceResponse{
			Success: false,
			Error:   "删除维护计划失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "维护计划已删除",
	})
}

// IncidentHandlers 事件公告处理器集合
type IncidentHandlers struct {
	repo *database.IncidentRepository
}

// NewIncidentHandlers 创建事件处理器
func NewIncidentHandlers(repo *database.IncidentRepository) *IncidentHandlers {
	return &IncidentHandlers{repo: repo}
}

// GetActiveIncident 获取活跃的事件公告（从 Kuma 缓存）
// GET /api/incidents/active
func (h *IncidentHandlers) GetActiveIncident(c *gin.Context) {
	// 从缓存读取 Kuma 的 incident 数据
	cached, found := cache.Get("kuma_incident")
	if !found {
		c.JSON(http.StatusOK, models.IncidentResponse{
			Success:  true,
			Incident: nil,
		})
		return
	}

	incident := cached.(*fetcher.KumaIncident)
	if incident == nil {
		c.JSON(http.StatusOK, models.IncidentResponse{
			Success:  true,
			Incident: nil,
		})
		return
	}

	// 解析时间字符串
	createdDate, _ := time.Parse("2006-01-02 15:04:05", incident.CreatedDate)
	var lastUpdatedDate time.Time
	if incident.LastUpdatedDate != "" {
		lastUpdatedDate, _ = time.Parse("2006-01-02 15:04:05", incident.LastUpdatedDate)
	}

	// 转换为前端需要的格式
	result := &models.Incident{
		ID:              incident.ID,
		Title:           incident.Title,
		Content:         incident.Content,
		Style:           incident.Style,
		Active:          incident.Pin == 1,
		CreatedDate:     createdDate,
		LastUpdatedDate: lastUpdatedDate,
	}

	c.JSON(http.StatusOK, models.IncidentResponse{
		Success:  true,
		Incident: result,
	})
}

// GetIncidents 获取所有事件公告
// GET /api/incidents
func (h *IncidentHandlers) GetIncidents(c *gin.Context) {
	incidents, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "获取事件列表失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"incidents": incidents,
	})
}

// GetIncident 获取单个事件公告
// GET /api/incidents/:id
func (h *IncidentHandlers) GetIncident(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.IncidentResponse{
			Success: false,
			Error:   "无效的事件ID",
		})
		return
	}

	incident, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.IncidentResponse{
			Success: false,
			Error:   "事件公告不存在",
		})
		return
	}

	c.JSON(http.StatusOK, models.IncidentResponse{
		Success:  true,
		Incident: incident,
	})
}

// CreateIncident 创建事件公告
// POST /api/incidents
func (h *IncidentHandlers) CreateIncident(c *gin.Context) {
	var incident models.Incident
	if err := c.ShouldBindJSON(&incident); err != nil {
		c.JSON(http.StatusBadRequest, models.IncidentResponse{
			Success: false,
			Error:   "请求参数错误: " + err.Error(),
		})
		return
	}

	if err := h.repo.Create(&incident); err != nil {
		c.JSON(http.StatusInternalServerError, models.IncidentResponse{
			Success: false,
			Error:   "创建事件公告失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, models.IncidentResponse{
		Success:  true,
		Incident: &incident,
	})
}

// UpdateIncident 更新事件公告
// PUT /api/incidents/:id
func (h *IncidentHandlers) UpdateIncident(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.IncidentResponse{
			Success: false,
			Error:   "无效的事件ID",
		})
		return
	}

	var incident models.Incident
	if err := c.ShouldBindJSON(&incident); err != nil {
		c.JSON(http.StatusBadRequest, models.IncidentResponse{
			Success: false,
			Error:   "请求参数错误: " + err.Error(),
		})
		return
	}

	incident.ID = id
	if err := h.repo.Update(&incident); err != nil {
		c.JSON(http.StatusInternalServerError, models.IncidentResponse{
			Success: false,
			Error:   "更新事件公告失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.IncidentResponse{
		Success:  true,
		Incident: &incident,
	})
}

// DeleteIncident 删除事件公告
// DELETE /api/incidents/:id
func (h *IncidentHandlers) DeleteIncident(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.IncidentResponse{
			Success: false,
			Error:   "无效的事件ID",
		})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, models.IncidentResponse{
			Success: false,
			Error:   "删除事件公告失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "事件公告已删除",
	})
}

// ConfigHandlers 配置处理器集合
type ConfigHandlers struct {
	repo *database.ConfigRepository
}

// NewConfigHandlers 创建配置处理器
func NewConfigHandlers(repo *database.ConfigRepository) *ConfigHandlers {
	return &ConfigHandlers{repo: repo}
}

// GetConfig 获取所有配置或指定分类的配置
// GET /api/config?category=theme
func (h *ConfigHandlers) GetConfig(c *gin.Context) {
	category := c.Query("category")

	if category != "" {
		// 获取指定分类
		configs, err := h.repo.GetByCategory(category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.ConfigResponse{
				Success: false,
				Error:   "获取配置失败: " + err.Error(),
			})
			return
		}

		// 转换为 map
		result := make(map[string]interface{})
		for _, config := range configs {
			result[config.Key] = config.Value
		}

		c.JSON(http.StatusOK, models.ConfigResponse{
			Success: true,
			Config:  map[string]interface{}{category: result},
		})
		return
	}

	// 获取所有配置
	configMap, err := h.repo.GetAsMap()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ConfigResponse{
			Success: false,
			Error:   "获取配置失败: " + err.Error(),
		})
		return
	}

	// 转换类型
	result := make(map[string]interface{})
	for k, v := range configMap {
		result[k] = v
	}

	c.JSON(http.StatusOK, models.ConfigResponse{
		Success: true,
		Config:  result,
	})
}

// GetConfigValue 获取单个配置值
// GET /api/config/:key
func (h *ConfigHandlers) GetConfigValue(c *gin.Context) {
	key := c.Param("key")

	config, err := h.repo.GetByKey(key)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ConfigResponse{
			Success: false,
			Error:   "配置不存在",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"key":     config.Key,
		"value":   config.Value,
		"type":    config.Type,
	})
}

// UpdateConfig 更新单个配置
// PUT /api/config/:key
func (h *ConfigHandlers) UpdateConfig(c *gin.Context) {
	key := c.Param("key")

	var req struct {
		Value string `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ConfigResponse{
			Success: false,
			Error:   "请求参数错误",
		})
		return
	}

	if err := h.repo.Set(key, req.Value); err != nil {
		c.JSON(http.StatusInternalServerError, models.ConfigResponse{
			Success: false,
			Error:   "更新配置失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "配置已更新",
	})
}

// BatchUpdateConfig 批量更新配置
// POST /api/config/batch
func (h *ConfigHandlers) BatchUpdateConfig(c *gin.Context) {
	var updates map[string]string
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, models.ConfigResponse{
			Success: false,
			Error:   "请求参数错误",
		})
		return
	}

	if err := h.repo.BatchUpdate(updates); err != nil {
		c.JSON(http.StatusInternalServerError, models.ConfigResponse{
			Success: false,
			Error:   "批量更新失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "配置已批量更新",
	})
}

// ExportConfig 导出所有配置为JSON
// GET /api/config/export
func (h *ConfigHandlers) ExportConfig(c *gin.Context) {
	configs, err := h.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ConfigResponse{
			Success: false,
			Error:   "导出配置失败: " + err.Error(),
		})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=kuma-lite-config-"+time.Now().Format("20060102150405")+".json")
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"exportTime":  time.Now(),
		"configCount": len(configs),
		"config":      configs,
	})
}
