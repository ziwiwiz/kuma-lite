package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

// Config 应用配置
type Config struct {
	// Uptime Kuma 配置
	KumaAPIURL     string
	KumaStatusSlug string

	// 服务器配置
	ServerPort string

	// 缓存配置
	CacheDuration time.Duration
	FetchInterval time.Duration

	// 数据库配置
	DBPath string

	// 数据保留策略
	DataRetentionDays int
}

var AppConfig *Config

// LoadConfig 加载配置
func LoadConfig() *Config {
	config := &Config{
		KumaAPIURL:        getEnv("KUMA_API_URL", ""),
		KumaStatusSlug:    getEnv("KUMA_STATUS_PAGE_SLUG", ""),
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		CacheDuration:     time.Duration(getEnvInt("CACHE_DURATION", 60)) * time.Second,
		FetchInterval:     time.Duration(getEnvInt("FETCH_INTERVAL", 60)) * time.Second,
		DBPath:            getEnv("DB_PATH", "./data/kuma-lite.db"),
		DataRetentionDays: getEnvInt("DATA_RETENTION_DAYS", 30),
	}

	// 验证必需配置
	if config.KumaAPIURL == "" {
		log.Fatal("KUMA_API_URL 环境变量未设置")
	}

	if config.KumaStatusSlug == "" {
		log.Fatal("KUMA_STATUS_PAGE_SLUG 环境变量未设置")
	}

	AppConfig = config
	return config
}

// getEnv 获取环境变量,带默认值
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getEnvInt 获取整数类型环境变量
func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	intValue, err := strconv.Atoi(value)
	if err != nil {
		log.Printf("警告: %s 不是有效的整数,使用默认值 %d", key, defaultValue)
		return defaultValue
	}

	return intValue
}
