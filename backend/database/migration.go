package database

import (
	"fmt"
	"kuma-lite/backend/models"
	"log"

	"gorm.io/gorm"
)

const CurrentDBVersion = 2

// DBVersion 数据库版本记录
type DBVersion struct {
	Version int `gorm:"primaryKey"`
}

// MigrateDatabase 执行数据库迁移
func MigrateDatabase(db *gorm.DB) error {
	log.Println("开始数据库迁移检查...")

	// 确保版本表存在
	if err := db.AutoMigrate(&DBVersion{}); err != nil {
		return fmt.Errorf("创建版本表失败: %w", err)
	}

	// 获取当前数据库版本
	var dbVersion DBVersion
	result := db.First(&dbVersion)
	currentVersion := 0
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			// 新数据库，初始化版本
			dbVersion.Version = 0
			currentVersion = 0
		} else {
			return fmt.Errorf("获取数据库版本失败: %w", result.Error)
		}
	} else {
		currentVersion = dbVersion.Version
	}

	log.Printf("当前数据库版本: %d, 目标版本: %d", currentVersion, CurrentDBVersion)

	// 如果已经是最新版本，跳过迁移
	if currentVersion >= CurrentDBVersion {
		log.Println("数据库已是最新版本，无需迁移")
		return nil
	}

	// 执行迁移
	return db.Transaction(func(tx *gorm.DB) error {
		// V1 -> V2: 添加新表和扩展现有表
		if currentVersion < 2 {
			log.Println("执行 v1 -> v2 迁移...")

			// 自动迁移新模型
			if err := tx.AutoMigrate(
				&models.Maintenance{},
				&models.Incident{},
				&models.SiteConfig{},
			); err != nil {
				return fmt.Errorf("迁移新表失败: %w", err)
			}

			// 扩展 monitors 表（GORM AutoMigrate 会自动添加新列）
			if err := tx.AutoMigrate(&models.Monitor{}); err != nil {
				return fmt.Errorf("扩展 monitors 表失败: %w", err)
			}

			// 插入默认配置
			if err := seedDefaultConfig(tx); err != nil {
				return fmt.Errorf("插入默认配置失败: %w", err)
			}

			// 更新版本号
			if currentVersion == 0 {
				dbVersion.Version = 2
				if err := tx.Create(&dbVersion).Error; err != nil {
					return fmt.Errorf("创建版本记录失败: %w", err)
				}
			} else {
				dbVersion.Version = 2
				if err := tx.Save(&dbVersion).Error; err != nil {
					return fmt.Errorf("更新版本记录失败: %w", err)
				}
			}

			log.Println("v1 -> v2 迁移完成")
		}

		return nil
	})
}

// seedDefaultConfig 插入默认配置
func seedDefaultConfig(db *gorm.DB) error {
	log.Println("插入默认配置...")

	defaultConfigs := []models.SiteConfig{
		// 主题配置
		{Key: "theme", Value: "system", Type: "string", Category: "theme", Description: "默认主题: light, dark, system"},
		{Key: "primary_color", Value: "#3b82f6", Type: "string", Category: "theme", Description: "主色调 (蓝色)"},
		{Key: "success_color", Value: "#06b6d4", Type: "string", Category: "theme", Description: "成功色 (青色)"},
		{Key: "warning_color", Value: "#f59e0b", Type: "string", Category: "theme", Description: "警告色 (橙色)"},
		{Key: "danger_color", Value: "#ef4444", Type: "string", Category: "theme", Description: "危险色 (红色)"},
		{Key: "maintenance_color", Value: "#8b5cf6", Type: "string", Category: "theme", Description: "维护色 (紫色)"},

		// 外观配置
		{Key: "footer_text", Value: "Powered by Kuma-Lite", Type: "string", Category: "appearance", Description: "页脚文本"},
		{Key: "show_powered_by", Value: "true", Type: "boolean", Category: "appearance", Description: "显示 Powered by 信息"},

		// 功能开关
		{Key: "show_tags", Value: "true", Type: "boolean", Category: "features", Description: "显示监控标签"},
		{Key: "show_type", Value: "true", Type: "boolean", Category: "features", Description: "显示监控类型"},
		{Key: "show_method", Value: "true", Type: "boolean", Category: "features", Description: "显示 HTTP 方法"},
		{Key: "enable_maintenance", Value: "true", Type: "boolean", Category: "features", Description: "启用维护公告功能"},
		{Key: "enable_incidents", Value: "true", Type: "boolean", Category: "features", Description: "启用事件公告功能"},
	}

	for _, config := range defaultConfigs {
		// 检查配置是否已存在
		var existing models.SiteConfig
		result := db.Where("key = ?", config.Key).First(&existing)
		if result.Error == gorm.ErrRecordNotFound {
			// 不存在则创建
			if err := db.Create(&config).Error; err != nil {
				return fmt.Errorf("插入配置 %s 失败: %w", config.Key, err)
			}
			log.Printf("  ✓ 创建配置: %s = %s", config.Key, config.Value)
		} else {
			log.Printf("  - 配置已存在: %s", config.Key)
		}
	}

	log.Println("默认配置插入完成")
	return nil
}

// RollbackToVersion 回滚到指定版本（仅用于紧急情况）
func RollbackToVersion(db *gorm.DB, targetVersion int) error {
	if targetVersion >= CurrentDBVersion {
		return fmt.Errorf("目标版本 %d 必须小于当前版本 %d", targetVersion, CurrentDBVersion)
	}

	log.Printf("警告: 尝试回滚数据库到版本 %d", targetVersion)

	return db.Transaction(func(tx *gorm.DB) error {
		// 回滚操作会删除数据，需要非常谨慎
		if targetVersion < 2 {
			// 删除 v2 添加的表
			if err := tx.Migrator().DropTable(
				&models.Maintenance{},
				&models.Incident{},
				&models.SiteConfig{},
				"maintenance_monitors",
			); err != nil {
				return fmt.Errorf("删除 v2 表失败: %w", err)
			}

			// 注意: 不能删除已添加到 monitors 的列（SQLite 限制）
			log.Println("警告: SQLite 不支持删除列，monitors 表的新列将保留")
		}

		// 更新版本号
		var dbVersion DBVersion
		if err := tx.First(&dbVersion).Error; err != nil {
			return err
		}
		dbVersion.Version = targetVersion
		if err := tx.Save(&dbVersion).Error; err != nil {
			return err
		}

		log.Printf("已回滚到版本 %d", targetVersion)
		return nil
	})
}

// GetDBVersion 获取当前数据库版本
func GetDBVersion(db *gorm.DB) (int, error) {
	var dbVersion DBVersion
	result := db.First(&dbVersion)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return 0, nil
		}
		return 0, result.Error
	}
	return dbVersion.Version, nil
}
