package cache

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

var Cache *gocache.Cache

// InitCache 初始化缓存
func InitCache(defaultExpiration, cleanupInterval time.Duration) {
	Cache = gocache.New(defaultExpiration, cleanupInterval)
}

// Set 设置缓存
func Set(key string, value interface{}, duration time.Duration) {
	Cache.Set(key, value, duration)
}

// Get 获取缓存
func Get(key string) (interface{}, bool) {
	return Cache.Get(key)
}

// Delete 删除缓存
func Delete(key string) {
	Cache.Delete(key)
}

// Clear 清空所有缓存
func Clear() {
	Cache.Flush()
}
