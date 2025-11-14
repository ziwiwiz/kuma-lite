package cache

import (
	"sync"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

var (
	Cache *gocache.Cache

	// 多层缓存策略
	// 主页'last 100次记录'缓存 - 60秒有效期
	MainPageCacheDuration = 60 * time.Second

	// 详情页时间范围查询缓存 - 根据查询范围动态调整
	DetailPageCacheDuration = 5 * time.Minute

	// 缓存更新锁，避免并发更新导致的重复查询
	cacheLocks = make(map[string]*sync.Mutex)
	locksMutex sync.RWMutex
)

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

// GetOrSetWithLock 获取缓存，如果不存在则使用加锁方式设置（避免缓存击穿）
func GetOrSetWithLock(key string, duration time.Duration, fetcher func() (interface{}, error)) (interface{}, error) {
	// 先尝试从缓存获取
	if cached, found := Cache.Get(key); found {
		return cached, nil
	}

	// 获取该key的锁
	lock := getCacheLock(key)
	lock.Lock()
	defer lock.Unlock()

	// 再次检查缓存（可能在等待锁期间已被其他协程设置）
	if cached, found := Cache.Get(key); found {
		return cached, nil
	}

	// 执行获取数据的函数
	value, err := fetcher()
	if err != nil {
		return nil, err
	}

	// 设置缓存
	Cache.Set(key, value, duration)
	return value, nil
}

// getCacheLock 获取指定key的锁
func getCacheLock(key string) *sync.Mutex {
	locksMutex.RLock()
	if lock, exists := cacheLocks[key]; exists {
		locksMutex.RUnlock()
		return lock
	}
	locksMutex.RUnlock()

	locksMutex.Lock()
	defer locksMutex.Unlock()

	// 再次检查（双重检查锁定）
	if lock, exists := cacheLocks[key]; exists {
		return lock
	}

	lock := &sync.Mutex{}
	cacheLocks[key] = lock
	return lock
}

// InvalidateMonitorCache 使指定监控项的所有相关缓存失效
func InvalidateMonitorCache(monitorID string) {
	// 清空主页缓存
	Delete("history_" + monitorID + "_limit_100")

	// 清空详情页各时间段缓存
	for _, hours := range []string{"1", "3", "6", "12", "24", "48", "168"} {
		Delete("history_" + monitorID + "_" + hours + "h")
	}
}

// InvalidateAllMonitorCaches 使所有监控项缓存失效
func InvalidateAllMonitorCaches() {
	Delete("monitors")
	Delete("stats")
	// 注意：这里不直接清空所有历史记录缓存，让它们自然过期
}
