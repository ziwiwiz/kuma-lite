package database

import (
	"kuma-lite/backend/models"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库
func InitDB(dbPath string) error {
	// 确保数据目录存在
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// 打开数据库连接
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return err
	}

	DB = db

	// 优化 SQLite 性能配置
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	
	// 设置连接池参数（SQLite 只支持单个写连接）
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(0)
	
	// 启用 WAL 模式 - 提升并发性能和写入速度
	db.Exec("PRAGMA journal_mode=WAL")
	// 设置同步模式 - 平衡性能和安全性
	db.Exec("PRAGMA synchronous=NORMAL")
	// 增加缓存大小 - 64MB
	db.Exec("PRAGMA cache_size=-64000")
	// 临时表存储在内存中
	db.Exec("PRAGMA temp_store=MEMORY")
	// 设置内存映射大小 - 256MB
	db.Exec("PRAGMA mmap_size=268435456")

	// 自动迁移基础数据表
	if err := db.AutoMigrate(&models.Monitor{}, &models.HeartBeat{}); err != nil {
		return err
	}

	// 执行数据库版本迁移
	if err := MigrateDatabase(db); err != nil {
		log.Printf("数据库迁移失败: %v", err)
		return err
	}

	// 输出当前数据库版本
	version, err := GetDBVersion(db)
	if err != nil {
		log.Printf("获取数据库版本失败: %v", err)
	} else {
		log.Printf("当前数据库版本: v%d", version)
	}

	log.Println("数据库初始化成功")
	return nil
}

// CloseDB 关闭数据库连接
func CloseDB() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}
