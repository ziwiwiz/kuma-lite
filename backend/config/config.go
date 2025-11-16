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

	// 并发查询配置
	ConcurrentQueryWorkers int // 并发查询'last 100次记录'的线程数

	// 数据库配置
	DBPath string

	// 数据保留策略
	DataRetentionDays int

	// 日志配置
	LogLevel       string // 日志级别: DEBUG, INFO, WARN, ERROR, FATAL
	LogEnableColor bool   // 是否启用彩色输出
}

var AppConfig *Config

// LoadConfig 加载配置
func LoadConfig() *Config {
	config := &Config{
		KumaAPIURL:             getEnv("KUMA_API_URL", ""),
		KumaStatusSlug:         getEnv("KUMA_STATUS_PAGE_SLUG", ""),
		ServerPort:             getEnv("SERVER_PORT", "8080"),
		CacheDuration:          time.Duration(getEnvInt("CACHE_DURATION", 60)) * time.Second,
		FetchInterval:          time.Duration(getEnvInt("FETCH_INTERVAL", 300)) * time.Second, // 默认5分钟
		ConcurrentQueryWorkers: getEnvInt("CONCURRENT_QUERY_WORKERS", 10),                     // 默认10个并发线程
		DBPath:                 getEnv("DB_PATH", "./data/kuma-lite.db"),
		DataRetentionDays:      getEnvInt("DATA_RETENTION_DAYS", 90),
		LogLevel:               getEnv("LOG_LEVEL", "INFO"),          // 默认INFO级别
		LogEnableColor:         getEnvBool("LOG_ENABLE_COLOR", true), // 默认启用彩色
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

// getEnvBool 获取布尔类型环境变量
func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		log.Printf("警告: %s 不是有效的布尔值,使用默认值 %v", key, defaultValue)
		return defaultValue
	}

	return boolValue
}
