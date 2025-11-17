const { createApp } = Vue;

// 多语言文本
const i18n = {
    zh: {
        // 状态
        allServices: '全部服务',
        allSystemsOperational: '所有系统正常运行',
        partialOutage: '部分服务异常',
        majorOutage: '系统故障',
        online: '在线',
        offline: '离线',
        down: '离线',
        someServicesDown: '部分服务异常',
        maintenance: '维护中',
        underMaintenance: '维护中',
        retry: '重试中',
        normal: '正常',
        avgUptime: '可用率',
        avgResponse: '响应',
        
        // 统计
        uptime: '可用性',
        avgResponse: '平均响应',
        currentResponse: '当前响应',
        maxResponse: '最大响应',
        
        // 时间
        lastUpdate: '最后更新',
        autoRefresh: '自动刷新',
        paused: '已暂停',
        lastUpdateInfo: '上次刷新: {time} 将在 {countdown} 秒后刷新',
        
        // 操作
        search: '搜索监控项或分组...',
        clearSearch: '清除搜索',
        compactMode: '精简模式',
        toggleCompact: '切换精简模式',
        toggleToFull: '切换到完整模式',
        toggleToCompact: '切换到精简模式',
        refresh: '刷新',
        pause: '暂停',
        resume: '继续',
        
        // 主题
        theme: '主题',
        light: '浅色',
        dark: '深色',
        auto: '跟随系统',
        
        // 语言
        language: '语言',
        chinese: '中文',
        english: 'English',
        
        // 图表
        responseTime: '响应时间',
        last100: '最近 100 次',
        last50: '最近 50 次',
        last25: '最近 25 次',
        
        // 加载
        loading: '加载监控数据中...',
        
        // 页脚
        poweredBy: 'Powered by',
        
        // 其他
        group: '分组',
        other: '其他'
    },
    en: {
        // Status
        allServices: 'All Services',
        allSystemsOperational: 'All Systems Operational',
        partialOutage: 'Partial Outage',
        majorOutage: 'Major Outage',
        online: 'Online',
        offline: 'Offline',
        down: 'Down',
        someServicesDown: 'Some Services Down',
        maintenance: 'Maint.',
        underMaintenance: 'Under Maintenance',
        retry: 'Retry',
        normal: 'Normal',
        
        // Statistics
        uptime: 'Uptime',
        avgUptime: 'Uptime',
        avgResponse: 'Response',
        currentResponse: 'Current',
        maxResponse: 'Max Response',
        
        // Time
        lastUpdate: 'Last Update',
        autoRefresh: 'Auto Refresh',
        paused: 'Paused',
        lastUpdateInfo: 'Last update: {time} will refresh in {countdown}s',
        
        // Actions
        search: 'Search monitors or groups...',
        clearSearch: 'Clear',
        compactMode: 'Compact Mode',
        toggleCompact: 'Toggle compact mode',
        toggleToFull: 'Switch to full mode',
        toggleToCompact: 'Switch to compact mode',
        refresh: 'Refresh',
        pause: 'Pause',
        resume: 'Resume',
        
        // Theme
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        auto: 'Auto',
        
        // Language
        language: 'Language',
        chinese: '中文',
        english: 'English',
        
        // Charts
        responseTime: 'Response Time',
        last100: 'Last 100',
        last50: 'Last 50',
        last25: 'Last 25',
        
        // Loading
        loading: 'Loading monitoring data...',
        
        // Footer
        poweredBy: 'Powered by',
        
        // Others
        group: 'Group',
        other: 'Other'
    }
};

const app = createApp({
    data() {
        return {
            monitors: [],
            stats: null,
            loading: true,
            isInitialLoad: true, // 标记首次加载
            isLoadingFromCache: false, // 标记是否从缓存加载
            error: null,
            lastUpdate: '',
            countdown: 60,
            paused: false,
            compactMode: false, // 精简模式
            searchQuery: '', // 搜索关键词
            themeMode: 'auto', // 主题模式：light/dark/auto
            language: 'zh', // 语言（zh/en）
            showThemeMenu: false, // 显示主题菜单
            showLanguageMenu: false, // 显示语言菜单
            charts: {},
            chartObserver: null, // Intersection Observer 用于图表懒加载
            visibleCharts: new Set(), // 记录已进入视口的图表
            searchDebounceTimer: null, // 搜索防抖计时器
            refreshInterval: null,
            countdownInterval: null,
            autoRefreshSeconds: 60, // 前端1分钟倒计时触发后端采集
            historyCacheTTL: 300000, // 前端缓存5分钟(300秒)，避免频繁请求
            staticDataCacheTTL: 300000, // 静态数据缓存5分钟（config、stats等）
            tooltip: {
                show: false,
                text: '',
                x: 0,
                y: 0
            },
            // 维护公告和事件
            maintenances: [],
            currentMaintenances: [],
            activeIncident: null,
            config: null,
            logConfig: null, // 日志配置
            // 折叠状态
            incidentExpanded: false, // 事件通知默认折叠
            maintenanceExpanded: [], // 维护通知展开状态数组
            isReturningFromDetail: false // 标记是否从详情页返回
        };
    },
    computed: {
        // 按组分类监控项，并按照 Kuma 原始配置的分组顺序排列
        groupedMonitors() {
            // 先过滤搜索结果
            let filteredMonitors = this.monitors;
            if (this.searchQuery.trim()) {
                const query = this.searchQuery.trim().toLowerCase();
                filteredMonitors = this.monitors.filter(monitor => 
                    monitor.name.toLowerCase().includes(query) ||
                    (monitor.group && monitor.group.toLowerCase().includes(query))
                );
            }
            
            const groups = {};
            filteredMonitors.forEach(monitor => {
                // 使用 Kuma API 返回的 group 字段
                const groupName = monitor.group || 'other';
                if (!groups[groupName]) {
                    groups[groupName] = {
                        monitors: [],
                        order: monitor.groupOrder !== undefined ? monitor.groupOrder : 999 // 使用第一个 monitor 的 groupOrder
                    };
                }
                // 为每个监控项添加选中的时间段（默认100次）
                if (!monitor.selectedPeriod) {
                    monitor.selectedPeriod = 100;
                }
                groups[groupName].monitors.push(monitor);
            });
            
            // 转换为数组并按 order 排序
            const result = Object.entries(groups)
                .map(([name, data]) => ({
                    name: name,
                    monitors: data.monitors,
                    order: data.order
                }))
                .sort((a, b) => a.order - b.order);
            
            return result;
        },
        
        // 翻译文本
        t() {
            return i18n[this.language] || i18n.zh;
        },
        
        // 系统整体状态
        systemStatus() {
            if (!this.stats) return 'operational';
            
            // 如果有离线或重试中的服务，显示warning状态(橙色)
            if (this.stats.downMonitors > 0 || this.stats.retryMonitors > 0) {
                return 'warning';
            }
            
            return 'operational'; // 全部正常(绿色)
        },
        
        // 维护中的服务数量
        maintenanceCount() {
            return this.currentMaintenances.filter(m => 
                m.status === 'under-maintenance'
            ).length;
        },
        
        // 进度条百分比 (从100%递减到0%)
        progressPercent() {
            return (this.countdown / this.autoRefreshSeconds) * 100;
        },
        
        // 进度条颜色 - 根据剩余时间百分比动态变化
        progressColor() {
            const percent = this.progressPercent;
            if (percent > 66) return '#10b981'; // 绿色 - 时间充足
            if (percent > 33) return '#f59e0b'; // 橙色 - 时间过半
            return '#ef4444'; // 红色 - 即将结束
        }
    },
    mounted() {
        // 从 localStorage 恢复精简模式状态
        const savedCompactMode = localStorage.getItem('compactMode');
        if (savedCompactMode !== null) {
            this.compactMode = savedCompactMode === 'true';
        }
        
        // 从 localStorage 恢复主题模式
        const savedThemeMode = localStorage.getItem('themeMode');
        if (savedThemeMode) {
            this.themeMode = savedThemeMode;
        }
        this.applyTheme();
        
        // 监听系统主题变化
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                if (this.themeMode === 'auto') {
                    this.applyTheme();
                }
            });
        }
        
        // 从 localStorage 恢复语言设置
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage) {
            this.language = savedLanguage;
        }
        
        // 初始化 Intersection Observer 用于图表懒加载
        this.initChartObserver();
        
        // 清理旧缓存
        this.cleanOldCaches();
        
        // 恢复倒计时状态(从详情页返回时)
        const savedCountdown = sessionStorage.getItem('mainPageCountdown');
        const savedPaused = sessionStorage.getItem('mainPagePaused');
        const savedTimestamp = sessionStorage.getItem('mainPageTimestamp');
        
        if (savedCountdown !== null && savedTimestamp !== null) {
            const elapsed = Math.floor((Date.now() - parseInt(savedTimestamp)) / 1000);
            const restoredCountdown = Math.max(0, parseInt(savedCountdown) - elapsed);
            this.countdown = restoredCountdown > 0 ? restoredCountdown : this.autoRefreshSeconds;
            this.isReturningFromDetail = true; // 标记为从详情页返回
            logger.info(`📍 [详情页→主页] 从详情页返回主页`);
            logger.info(`🔄 [详情页→主页] 恢复倒计时: ${savedCountdown}秒 → ${this.countdown}秒 (在详情页期间经过了${elapsed}秒)`);
            
            // 如果在详情页期间倒计时已归零,立即触发一次采集
            if (restoredCountdown === 0) {
                logger.info('⏰ [详情页→主页] 倒计时在详情页期间已归零,将立即触发采集');
            }
            
            // 标记为非首次加载,防止fetchData()重置倒计时
            this.isInitialLoad = false;
        } else {
            logger.info('📍 [主页] 首次进入主页');
            // 标记为首次加载
            this.triggerSource = 'initial';
        }
        
        if (savedPaused !== null) {
            this.paused = savedPaused === 'true';
            if (this.paused) {
                logger.info('⏸️ [主页] 恢复暂停状态');
            }
        }
        
        logger.info('🚀 [主页] 开始初始化数据加载...');
        
        // 🎯 优化: 先尝试从缓存快速渲染
        this.loadFromCacheFirst();
        
        // 然后异步获取最新数据
        this.fetchData();
        this.startAutoRefresh();
    },
    beforeUnmount() {
        // 注意: 由于跳转详情页使用 window.location.href,此钩子不会被触发
        // 倒计时状态保存已移至 goToDetail() 方法中
        
        this.stopAutoRefresh();
        // 清理 Intersection Observer
        if (this.chartObserver) {
            this.chartObserver.disconnect();
        }
        // 销毁所有图表实例
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.dispose();
        });
    },
    methods: {
        // 初始化图表懒加载观察器
        initChartObserver() {
            // 如果浏览器不支持 IntersectionObserver，则跳过
            if (!('IntersectionObserver' in window)) {
                logger.warn('浏览器不支持 IntersectionObserver，图表懒加载功能已禁用');
                return;
            }
            
            // 配置观察器：当卡片进入视口时触发
            const options = {
                root: null, // 使用视口作为根元素
                rootMargin: '100px', // 提前 100px 开始加载，提升体验
                threshold: 0.1 // 当 10% 可见时触发
            };
            
            this.chartObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // 卡片进入视口
                        const cardEl = entry.target;
                        const monitorId = parseInt(cardEl.dataset.monitorId);
                        
                        // 如果图表还未渲染且不在精简模式下
                        if (!this.compactMode && !this.visibleCharts.has(monitorId)) {
                            this.visibleCharts.add(monitorId);
                            
                            // 延迟一小段时间再渲染，避免同时渲染太多图表
                            setTimeout(() => {
                                const monitor = this.monitors.find(m => m.id === monitorId);
                                if (monitor && monitor.statusHistory && monitor.statusHistory.length > 0) {
                                    this.renderChart(monitor);
                                }
                            }, 50);
                        }
                    }
                });
            }, options);
        },
        
        // 观察所有监控卡片
        observeMonitorCards() {
            if (!this.chartObserver) return;
            
            // 等待 DOM 更新后再观察
            this.$nextTick(() => {
                const cards = document.querySelectorAll('.monitor-card');
                cards.forEach(card => {
                    this.chartObserver.observe(card);
                });
            });
        },
        
        // 🎯 新增: 优先从缓存加载数据快速渲染页面
        async loadFromCacheFirst() {
            logger.info('⚡ [快速渲染] 尝试从缓存加载数据...');
            
            // 获取缓存的监控列表和历史数据
            const cachedMonitors = this.getCachedMonitors();
            
            if (cachedMonitors && cachedMonitors.length > 0) {
                this.isLoadingFromCache = true;
                logger.info(`📦 [快速渲染] 找到 ${cachedMonitors.length} 个监控项的缓存数据`);
                
                // 使用缓存数据快速渲染
                this.monitors = cachedMonitors;
                
                // 加载每个监控项的历史数据（从 localStorage）
                let cachedCount = 0;
                this.monitors.forEach(monitor => {
                    const cached = this.getHistoryCache(monitor.id);
                    if (cached && cached.data.length > 0) {
                        this.applyHistoryData(monitor, cached.data);
                        cachedCount++;
                    }
                });
                
                logger.info(`📦 [快速渲染] 成功应用 ${cachedCount}/${cachedMonitors.length} 个监控项的历史数据缓存`);
                
                // 尝试从缓存加载其他数据
                const cachedStats = this.getStaticDataCache('stats');
                if (cachedStats) {
                    this.stats = cachedStats;
                    logger.info('📦 [快速渲染] 已加载统计信息缓存');
                }
                
                const cachedConfig = this.getStaticDataCache('config');
                if (cachedConfig) {
                    this.config = cachedConfig;
                    logger.info('📦 [快速渲染] 已加载配置缓存');
                }
                
                const cachedMaintenances = this.getStaticDataCache('maintenances');
                if (cachedMaintenances) {
                    this.currentMaintenances = cachedMaintenances;
                    this.maintenanceExpanded = this.currentMaintenances.map(() => false);
                    logger.info('📦 [快速渲染] 已加载维护公告缓存');
                }
                
                const cachedIncidents = this.getStaticDataCache('incidents');
                if (cachedIncidents !== null) {
                    this.activeIncident = cachedIncidents;
                    logger.info('📦 [快速渲染] 已加载事件缓存');
                }
                
                const cachedLogConfig = this.getStaticDataCache('logConfig');
                if (cachedLogConfig) {
                    this.logConfig = cachedLogConfig;
                    logger.info('📦 [快速渲染] 已加载日志配置缓存');
                }
                
                // 设置最后更新时间
                const locale = this.language === 'zh' ? 'zh-CN' : 'en-US';
                this.lastUpdate = new Date().toLocaleString(locale, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }) + ' (缓存)';
                
                // 关闭 loading 状态，立即渲染页面
                this.loading = false;
                
                // 启用图表懒加载观察器
                if (!this.compactMode && this.chartObserver) {
                    this.$nextTick(() => {
                        this.observeMonitorCards();
                        logger.info('📊 [快速渲染] 已启用图表懒加载观察器');
                    });
                }
                
                logger.info('✅ [快速渲染] 页面已使用缓存数据渲染完成，后台将获取最新数据');
            } else {
                logger.info('ℹ️  [快速渲染] 未找到缓存数据，等待 API 加载');
            }
        },
        
        // 🎯 新增: 获取缓存的监控列表
        getCachedMonitors() {
            try {
                const cached = localStorage.getItem('monitors_list');
                if (!cached) return null;
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                
                // 检查缓存是否过期（5分钟）
                if (now - timestamp > this.historyCacheTTL) {
                    localStorage.removeItem('monitors_list');
                    logger.info('🧹 清理过期的监控列表缓存');
                    return null;
                }
                
                logger.info(`📦 使用监控列表缓存 (剩余 ${Math.floor((this.historyCacheTTL - (now - timestamp)) / 1000)}秒)`);
                return data;
            } catch (err) {
                logger.error('Failed to get monitors cache:', err);
                return null;
            }
        },
        
        // 🎯 新增: 缓存监控列表
        setCachedMonitors(monitors) {
            try {
                const cacheData = {
                    data: monitors,
                    timestamp: Date.now()
                };
                localStorage.setItem('monitors_list', JSON.stringify(cacheData));
                logger.info(`💾 已缓存监控列表 (${monitors.length} 项)`);
            } catch (err) {
                logger.error('Failed to cache monitors:', err);
            }
        },

        // 获取数据
        // forceRefresh: true = 手动刷新，强制获取新数据并更新缓存
        // forceRefresh: false = 自动刷新，比较数据差异后更新缓存
        async fetchData(forceRefresh = false) {
            if (this.paused && !forceRefresh) return;
            
            const refreshType = forceRefresh ? '手动刷新' : (this.isReturningFromDetail ? '从详情页返回' : (this.isLoadingFromCache ? '后台更新' : '自动刷新'));
            logger.info(`📊 [主页-${refreshType}] 开始获取数据...`);
            
            try {
                // 手动刷新时，先触发后端立即采集Kuma数据
                if (forceRefresh) {
                    // 手动刷新不显示loading，在后台更新（和倒计时自动刷新逻辑一致）
                    logger.info('🔴 [主页-手动刷新] 用户点击刷新按钮,触发后端立即采集Kuma数据');
                    try {
                        const startTime = Date.now();
                        await axios.post('/api/trigger-fetch?source=manual');
                        logger.info(`✅ [主页-手动刷新] 已通知后端采集数据 (耗时: ${Date.now() - startTime}ms)`);
                        // 等待1秒让后端完成采集
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        logger.info('🔄 [主页-手动刷新] 将比较数据变化后更新缓存');
                    } catch (err) {
                        logger.error('❌ [主页-手动刷新] 触发后端采集失败:', err);
                    }
                } else if (this.isInitialLoad && this.triggerSource === 'initial') {
                    // 首次加载时触发采集（仅在没有缓存的情况下显示loading）
                    if (!this.isLoadingFromCache) {
                        this.loading = true;
                    }
                    logger.info('🟢 [主页-首次加载] 触发后端立即采集Kuma数据');
                    try {
                        const startTime = Date.now();
                        await axios.post('/api/trigger-fetch?source=initial');
                        logger.info(`✅ [主页-首次加载] 已通知后端采集数据 (耗时: ${Date.now() - startTime}ms)`);
                        // 等待1秒让后端完成采集
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        // 清除标记
                        delete this.triggerSource;
                    } catch (err) {
                        logger.error('❌ [主页-首次加载] 触发后端采集失败:', err);
                    }
                }
                
                // 首次加载且无缓存时显示 loading 状态
                if (this.isInitialLoad && !this.isReturningFromDetail && !this.isLoadingFromCache) {
                    this.loading = true;
                }
                this.error = null;

                // 获取监控列表（总是需要，因为状态可能变化）
                const monitorsRes = await axios.get('/api/monitors');
                if (monitorsRes.data.success) {
                    const newMonitors = monitorsRes.data.data;
                    
                    // 🎯 如果是从缓存加载后的后台更新，检查数据是否有变化
                    if (this.isLoadingFromCache && this.monitors.length > 0) {
                        const hasChanged = this.hasMonitorsChanged(this.monitors, newMonitors);
                        if (hasChanged) {
                            logger.info('🔄 [后台更新] 监控列表数据有变化，更新页面');
                        } else {
                            logger.info('ℹ️  [后台更新] 监控列表无变化');
                        }
                    }
                    
                    this.monitors = newMonitors;
                    
                    // 缓存监控列表
                    this.setCachedMonitors(newMonitors);
                    
                    // 为每个监控项获取历史数据
                    await this.fetchAllHistory(forceRefresh);
                }

                // 获取统计信息 - 优先使用缓存（从详情页返回时）
                if (!forceRefresh && this.isReturningFromDetail) {
                    const cachedStats = this.getStaticDataCache('stats');
                    if (cachedStats) {
                        this.stats = cachedStats;
                    } else {
                        const statsRes = await axios.get('/api/stats');
                        if (statsRes.data.success) {
                            this.stats = statsRes.data.data;
                            this.setStaticDataCache('stats', this.stats);
                        }
                    }
                } else {
                    const statsRes = await axios.get('/api/stats');
                    if (statsRes.data.success) {
                        this.stats = statsRes.data.data;
                        // 手动刷新也使用缓存，比较变化后更新
                        this.setStaticDataCache('stats', this.stats);
                    }
                }

                // 获取日志配置 - 优先使用缓存
                if (!this.logConfig) {
                    const cachedLogConfig = this.getStaticDataCache('logConfig');
                    if (cachedLogConfig) {
                        this.logConfig = cachedLogConfig;
                    } else {
                        try {
                            const logConfigRes = await axios.get('/api/log-config');
                            this.logConfig = logConfigRes.data;
                            this.setStaticDataCache('logConfig', this.logConfig);
                        } catch (err) {
                            logger.warn('获取日志配置失败:', err);
                        }
                    }
                }

                // 获取配置 - 优先使用缓存
                if (!this.config) {
                    const cachedConfig = this.getStaticDataCache('config');
                    if (cachedConfig) {
                        this.config = cachedConfig;
                    } else {
                        try {
                            const configRes = await axios.get('/api/config');
                            if (configRes.data.success) {
                                this.config = configRes.data.config;
                                this.setStaticDataCache('config', this.config);
                            }
                        } catch (err) {
                            logger.warn('获取配置失败:', err);
                        }
                    }
                }

                // 获取当前维护公告 - 优先使用缓存（从详情页返回时）
                if (!forceRefresh && this.isReturningFromDetail) {
                    const cachedMaintenances = this.getStaticDataCache('maintenances');
                    if (cachedMaintenances) {
                        this.currentMaintenances = cachedMaintenances;
                        this.maintenanceExpanded = this.currentMaintenances.map(() => false);
                    } else {
                        try {
                            const maintenancesRes = await axios.get('/api/maintenances/current');
                            if (maintenancesRes.data.success) {
                                this.currentMaintenances = maintenancesRes.data.maintenances || [];
                                this.maintenanceExpanded = this.currentMaintenances.map(() => false);
                                this.setStaticDataCache('maintenances', this.currentMaintenances);
                            }
                        } catch (err) {
                            logger.warn('获取维护公告失败:', err);
                        }
                    }
                } else {
                    try {
                        const maintenancesRes = await axios.get('/api/maintenances/current');
                        if (maintenancesRes.data.success) {
                            this.currentMaintenances = maintenancesRes.data.maintenances || [];
                            this.maintenanceExpanded = this.currentMaintenances.map(() => false);
                            // 手动刷新也使用缓存，比较变化后更新
                            this.setStaticDataCache('maintenances', this.currentMaintenances);
                        }
                    } catch (err) {
                        logger.warn('获取维护公告失败:', err);
                    }
                }

                // 获取活跃事件 - 优先使用缓存（从详情页返回时）
                if (!forceRefresh && this.isReturningFromDetail) {
                    const cachedIncidents = this.getStaticDataCache('incidents');
                    if (cachedIncidents !== null) {
                        this.activeIncident = cachedIncidents;
                    } else {
                        try {
                            const incidentRes = await axios.get('/api/incidents/active');
                            if (incidentRes.data.success) {
                                this.activeIncident = incidentRes.data.incident;
                                this.setStaticDataCache('incidents', this.activeIncident);
                            }
                        } catch (err) {
                            logger.warn('获取事件失败:', err);
                        }
                    }
                } else {
                    try {
                        const incidentRes = await axios.get('/api/incidents/active');
                        if (incidentRes.data.success) {
                            this.activeIncident = incidentRes.data.incident;
                            // 手动刷新也使用缓存，比较变化后更新
                            this.setStaticDataCache('incidents', this.activeIncident);
                        }
                    } catch (err) {
                        logger.warn('获取事件失败:', err);
                    }
                }

                // 使用 24 小时制格式
                const locale = this.language === 'zh' ? 'zh-CN' : 'en-US';
                this.lastUpdate = new Date().toLocaleString(locale, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                if (this.isInitialLoad) {
                    this.isInitialLoad = false;
                    
                    // 仅在首次加载时重置倒计时
                    if (!this.isLoadingFromCache) {
                        this.countdown = this.autoRefreshSeconds;
                    }
                } else {
                    // 从详情页返回或自动刷新时,也要确保图表懒加载观察器已初始化
                    if (this.isReturningFromDetail) {
                        logger.info('🔄 [主页] 从详情页返回,检查图表懒加载观察器状态');
                    } else if (this.isLoadingFromCache) {
                        logger.info('🔄 [主页] 后台更新完成,检查图表懒加载观察器状态');
                    } else {
                        logger.info('🔄 [主页] 非首次加载,检查图表懒加载观察器状态');
                    }
                }
                
                // 清除返回标记
                if (this.isReturningFromDetail) {
                    this.isReturningFromDetail = false;
                    logger.info('✅ [主页] 从详情页返回的数据加载完成（已使用缓存优化）');
                }
                
                // 清除缓存加载标记
                if (this.isLoadingFromCache) {
                    this.isLoadingFromCache = false;
                    logger.info('✅ [主页] 后台更新完成，数据已刷新');
                }
                
                // 数据加载完成后,启用图表懒加载观察器（包括从详情页返回的情况）
                if (!this.compactMode && this.chartObserver) {
                    this.$nextTick(() => {
                        this.observeMonitorCards();
                        logger.info('📊 [主页] 已启用图表懒加载观察器');
                    });
                }
                
                // 手动刷新时重置倒计时
                if (forceRefresh) {
                    this.countdown = this.autoRefreshSeconds;
                }
                
                // 完成后总是重置loading状态
                this.loading = false;
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
                this.isInitialLoad = false;
                this.isReturningFromDetail = false;
                this.isLoadingFromCache = false;
                logger.error('Fetch error:', err);
            }
        },
        
        // 🎯 新增: 比较监控列表是否有变化
        hasMonitorsChanged(oldMonitors, newMonitors) {
            if (oldMonitors.length !== newMonitors.length) return true;
            
            // 比较每个监控项的关键字段
            for (let i = 0; i < oldMonitors.length; i++) {
                const oldM = oldMonitors[i];
                const newM = newMonitors.find(m => m.id === oldM.id);
                
                if (!newM) return true;
                if (oldM.status !== newM.status) return true;
                if (oldM.name !== newM.name) return true;
                if (oldM.enabled !== newM.enabled) return true;
            }
            
            return false;
        },

        // localStorage 缓存辅助方法
        getHistoryCache(monitorId, cacheType = 'limit_100') {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                const cached = localStorage.getItem(cacheKey);
                if (!cached) return null;
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                
                // 检查缓存是否过期
                if (now - timestamp > this.historyCacheTTL) {
                    localStorage.removeItem(cacheKey);
                    logger.info(`清理过期缓存: ${cacheKey}, 年龄: ${Math.floor((now - timestamp) / 1000)}秒`);
                    return null;
                }
                
                return { data, timestamp };
            } catch (err) {
                logger.error('Failed to get cache:', err);
                // 缓存损坏，清理它
                try {
                    const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                    localStorage.removeItem(cacheKey);
                } catch (e) {}
                return null;
            }
        },
        
        setHistoryCache(monitorId, data, cacheType = 'limit_100') {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                
                // 限制缓存数据量：只缓存最近的100条记录
                const limitedData = data.slice(-100);
                
                const cacheData = {
                    data: limitedData,
                    timestamp: Date.now(),
                    count: limitedData.length
                };
                
                const cacheString = JSON.stringify(cacheData);
                
                // 检查缓存大小，如果超过100KB，不缓存
                if (cacheString.length > 100 * 1024) {
                    logger.warn(`缓存数据过大(${Math.floor(cacheString.length / 1024)}KB)，跳过缓存: ${cacheKey}`);
                    return;
                }
                
                localStorage.setItem(cacheKey, cacheString);
            } catch (err) {
                // localStorage满了，清理旧缓存
                if (err.name === 'QuotaExceededError') {
                    logger.warn('localStorage已满，清理旧缓存...');
                    this.cleanOldCaches();
                    // 重试一次
                    try {
                        const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                        const limitedData = data.slice(-100);
                        const cacheData = {
                            data: limitedData,
                            timestamp: Date.now(),
                            count: limitedData.length
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    } catch (retryErr) {
                        logger.error('重试缓存失败:', retryErr);
                    }
                } else {
                    logger.error('Failed to set cache:', err);
                }
            }
        },
        
        // 清理旧缓存
        cleanOldCaches() {
            try {
                const now = Date.now();
                const keysToRemove = [];
                
                // 遍历所有localStorage key
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('history_cache_')) {
                        try {
                            const cached = localStorage.getItem(key);
                            if (cached) {
                                const { timestamp } = JSON.parse(cached);
                                // 清理超过TTL的缓存
                                if (now - timestamp > this.historyCacheTTL) {
                                    keysToRemove.push(key);
                                }
                            }
                        } catch (err) {
                            // 解析失败，标记删除
                            keysToRemove.push(key);
                        }
                    }
                }
                
                // 删除过期缓存
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    logger.info(`清理缓存: ${key}`);
                });
                
                if (keysToRemove.length > 0) {
                    logger.info(`已清理 ${keysToRemove.length} 个过期缓存`);
                }
            } catch (err) {
                logger.error('Failed to clean caches:', err);
            }
        },

        // 获取所有监控项的历史数据（优化：使用批量查询API）
        // forceRefresh: true = 强制刷新，忽略缓存直接获取新数据
        // forceRefresh: false = 自动刷新，优先使用缓存，然后后台更新
        async fetchAllHistory(forceRefresh = false) {
            const monitors = this.monitors;
            
            if (forceRefresh) {
                // 手动刷新：强制获取所有数据
                const allMonitorIds = monitors.map(m => m.id);
                await this.fetchAndUpdateCache(monitors, allMonitorIds, true);
            } else {
                // 自动刷新：先使用缓存，然后后台更新
                const needFetch = [];
                const cachedMonitors = [];
                monitors.forEach(monitor => {
                    const cached = this.getHistoryCache(monitor.id);
                    if (cached) {
                        // 使用缓存数据
                        this.applyHistoryData(monitor, cached.data);
                        cachedMonitors.push(monitor);
                        logger.info(`📦 使用缓存数据: 监控 ${monitor.name}`);
                    } else {
                        needFetch.push(monitor.id);
                    }
                });
                
                // 使用缓存数据后,标记数据已就绪
                // 实际的图表渲染将由懒加载观察器在 DOM 渲染完成后自动触发
                if (cachedMonitors.length > 0) {
                    logger.info(`📦 已应用 ${cachedMonitors.length} 个监控项的缓存数据,等待图表懒加载渲染`);
                }
                
                // 后台获取所有数据，比较差异后更新缓存
                const allMonitorIds = monitors.map(m => m.id);
                await this.fetchAndUpdateCache(monitors, allMonitorIds, false);
            }
        },
        
        // 应用历史数据到监控项
        applyHistoryData(monitor, historyData) {
            // 使用Vue 3的方式更新数组,确保响应式
            monitor.statusHistory = historyData.slice(-100);
            
            // 获取最后一次心跳数据
            if (historyData.length > 0) {
                const lastData = historyData[historyData.length - 1];
                
                // 更新当前状态为最新心跳的状态
                // 直接使用heartbeat的status值(0=离线, 1=在线/维护, 2=重试)
                monitor.status = lastData.status;
                monitor.responseTime = lastData.status === 1 ? lastData.responseTime : null;
            } else {
                monitor.responseTime = null;
            }
            
            // 计算平均响应时间
            const validResponses = historyData.filter(item => item.status === 1);
            if (validResponses.length > 0) {
                const sum = validResponses.reduce((acc, item) => acc + item.responseTime, 0);
                monitor.avgResponseTime = Math.round(sum / validResponses.length);
            } else {
                monitor.avgResponseTime = 0;
            }
        },
        
        // 比较两个历史数据数组是否有差异
        hasHistoryChanged(oldData, newData) {
            if (!oldData || oldData.length !== newData.length) return true;
            
            // 比较最后5条数据的关键字段
            const compareCount = Math.min(5, newData.length);
            for (let i = 1; i <= compareCount; i++) {
                const oldItem = oldData[oldData.length - i];
                const newItem = newData[newData.length - i];
                
                if (!oldItem || !newItem) return true;
                if (oldItem.status !== newItem.status) return true;
                if (oldItem.responseTime !== newItem.responseTime) return true;
                // 比较时间戳(精确到秒)
                const oldTime = new Date(oldItem.createdAt).getTime() / 1000;
                const newTime = new Date(newItem.createdAt).getTime() / 1000;
                if (Math.abs(oldTime - newTime) > 1) return true;
            }
            
            return false;
        },
        
        // 获取数据并更新缓存
        async fetchAndUpdateCache(monitors, monitorIds, forceUpdate = false) {
            if (monitorIds.length === 0) return;
            
            let updatedCount = 0;
            
            try {
                const res = await axios.post('/api/monitors/batch-history', {
                    monitorIds: monitorIds,
                    limit: 100
                });
                
                if (res.data.success) {
                    res.data.data.forEach(result => {
                        const monitor = monitors.find(m => m.id === result.monitorId);
                        if (monitor && result.heartbeats && result.heartbeats.length > 0) {
                            const newData = result.heartbeats;
                            const cached = this.getHistoryCache(monitor.id);
                            const oldData = cached ? cached.data : null;
                            
                            // 判断是否需要更新缓存和界面
                            if (forceUpdate || this.hasHistoryChanged(oldData, newData)) {
                                // 更新 localStorage 缓存
                                this.setHistoryCache(monitor.id, newData);
                                
                                // 应用数据到界面 - 使用 Vue.set 确保响应式更新
                                this.applyHistoryData(monitor, newData);
                                
                                // 强制触发Vue响应式更新
                                // 通过修改monitors数组来触发重新渲染
                                const index = this.monitors.findIndex(m => m.id === monitor.id);
                                if (index !== -1) {
                                    // 创建一个新对象以确保Vue检测到变化
                                    this.monitors.splice(index, 1, { ...monitor });
                                }
                                
                                // 只重新渲染已经可见的图表（已被懒加载渲染过的）
                                // 其他图表会在滚动到可见区域时由懒加载观察器渲染
                                if (!this.compactMode && this.visibleCharts.has(monitor.id)) {
                                    this.$nextTick(() => {
                                        this.renderChart(monitor);
                                    });
                                }
                                
                                updatedCount++;
                                
                                if (forceUpdate) {
                                    logger.info(`🔄 强制更新监控 ${monitor.name} 的数据`);
                                } else {
                                    logger.info(`🔄 检测到监控 ${monitor.name} 数据变化，已更新`);
                                }
                            }
                        } else if (monitor) {
                            monitor.statusHistory = [];
                        }
                    });
                    
                    // 打印更新统计
                    if (updatedCount > 0) {
                        logger.info(`✅ 批量更新完成: 共更新 ${updatedCount}/${monitorIds.length} 个监控项的数据并触发重新渲染`);
                    } else {
                        logger.info(`ℹ️  批量检查完成: 所有监控项数据无变化,未触发重新渲染`);
                    }
                }
            } catch (err) {
                logger.error('❌ 批量获取历史数据失败:', err);
                // 失败时使用单个请求作为降级方案
                logger.info('🔄 切换到单个请求降级方案...');
                for (const monitorId of monitorIds) {
                    try {
                        const monitor = monitors.find(m => m.id === monitorId);
                        if (!monitor) continue;
                        
                        const res = await axios.get(`/api/monitors/${monitorId}/history?limit=100`);
                        if (res.data.success && res.data.data.length > 0) {
                            const newData = res.data.data;
                            const cached = this.getHistoryCache(monitorId);
                            const oldData = cached ? cached.data : null;
                            
                            if (forceUpdate || this.hasHistoryChanged(oldData, newData)) {
                                this.setHistoryCache(monitorId, newData);
                                this.applyHistoryData(monitor, newData);
                                
                                // 强制触发Vue响应式更新
                                const index = this.monitors.findIndex(m => m.id === monitor.id);
                                if (index !== -1) {
                                    this.monitors.splice(index, 1, { ...monitor });
                                }
                                
                                // 重新渲染图表（无论图表是否已存在）
                                if (!this.compactMode) {
                                    this.$nextTick(() => {
                                        this.renderChart(monitor);
                                    });
                                }
                                
                                updatedCount++;
                                logger.info(`🔄 降级方案: 更新监控 ${monitor.name} 的数据并重新渲染图表`);
                            }
                        }
                    } catch (err2) {
                        logger.error(`❌ 降级方案失败 - 监控项 ${monitorId}:`, err2);
                    }
                }
                
                if (updatedCount > 0) {
                    logger.info(`✅ 降级方案完成: 共更新 ${updatedCount}/${monitorIds.length} 个监控项`);
                }
            }
        },

        // 获取显示的历史数据（根据选择的周期）
        getDisplayHistory(monitor) {
            if (!monitor.statusHistory) return [];
            const period = monitor.selectedPeriod || 100;
            return monitor.statusHistory.slice(-period);
        },

        // 获取平均响应时间
        getAvgResponseTime(monitor) {
            // 维护状态(responseTime为null)时返回null
            if (monitor.responseTime == null) return null;
            const data = this.getDisplayHistory(monitor);
            if (!data.length) return 0;
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            if (!validTimes.length) return 0;
            const avg = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
            return Math.round(avg);
        },

        // 获取最大响应时间
        getMaxResponseTime(monitor) {
            // 维护状态(responseTime为null)时返回null
            if (monitor.responseTime == null) return null;
            const data = this.getDisplayHistory(monitor);
            if (!data.length) return 0;
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            if (!validTimes.length) return 0;
            return Math.max(...validTimes);
        },

        // 本地化 "最近 N 次" 标签
        formatLast(period) {
            if (this.language === 'zh') {
                return `最近 ${period} 次`;
            }
            return `Last ${period}`;
        },

        // 渲染所有图表
        renderAllCharts() {
            // 精简模式下不渲染图表
            if (this.compactMode) {
                return;
            }
            
            // 使用 $nextTick 确保 DOM 更新完成后再渲染
            this.$nextTick(() => {
                this.monitors.forEach(monitor => {
                    const chartEl = document.getElementById('chart-' + monitor.id);
                    if (chartEl) {
                        this.renderChart(monitor);
                    }
                });
                
                // 极少数情况下 DOM 可能还未完全就绪，添加一个快速的安全检查（仅100ms）
                setTimeout(() => {
                    this.monitors.forEach(monitor => {
                        const chartEl = document.getElementById('chart-' + monitor.id);
                        if (chartEl && !this.charts[monitor.id]) {
                            this.renderChart(monitor);
                        }
                    });
                }, 100);
            });
        },

        // 渲染单个图表
        renderChart(monitor) {
            const chartEl = document.getElementById('chart-' + monitor.id);
            if (!chartEl) {
                logger.warn(`图表容器不存在: chart-${monitor.id}`);
                return;
            }
            if (!monitor.statusHistory) {
                logger.warn(`监控 ${monitor.id} 没有历史数据`);
                return;
            }
            if (monitor.statusHistory.length === 0) {
                logger.warn(`监控 ${monitor.id} 历史数据为空`);
                return;
            }

            // 如果图表已存在，先销毁再重建，确保配置完全刷新
            let chart = this.charts[monitor.id];
            if (chart) {
                chart.dispose();
                chart = null;
            }
            
            chart = echarts.init(chartEl);
            this.charts[monitor.id] = chart;

            // 根据选择的周期过滤数据
            const period = monitor.selectedPeriod || 50;
            const data = this.getDisplayHistory(monitor);

            // 生成两个时间数组：
            // 1. timesForAxis: 用于x轴显示（仅时:分:秒）
            // 2. timesForTooltip: 用于tooltip显示（包含年月日）
            const timesForAxis = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
            });
            
            const timesForTooltip = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleString('zh-CN', { 
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
            });

            // 构建响应时间数据（检测数据间隔，间隔过大时显示断点）
            const responseTimes = data.map((item, index) => {
                if (item.status === 1) {
                    // 正常状态，显示响应时间
                    return item.responseTime;
                }
                
                // 离线/重试状态，检查时间间隔
                if (index > 0 && index < data.length - 1) {
                    const prevTime = new Date(data[index - 1].createdAt);
                    const currentTime = new Date(item.createdAt);
                    const nextTime = new Date(data[index + 1].createdAt);
                    
                    // 计算与前后数据点的时间间隔（分钟）
                    const intervalBefore = (currentTime - prevTime) / 1000 / 60;
                    const intervalAfter = (nextTime - currentTime) / 1000 / 60;
                    
                    // 如果间隔超过 5 分钟，认为是数据缺失，显示为断点(null)
                    // 否则使用前一个有效值保持连续性
                    if (intervalBefore > 5 || intervalAfter > 5) {
                        return null;
                    }
                }
                
                // 找最近的有效值
                let nearestValue = null;
                // 先向前查找
                for (let i = index - 1; i >= 0; i--) {
                    if (data[i].status === 1) {
                        nearestValue = data[i].responseTime;
                        break;
                    }
                }
                // 如果前面没找到，向后查找
                if (nearestValue === null) {
                    for (let i = index + 1; i < data.length; i++) {
                        if (data[i].status === 1) {
                            nearestValue = data[i].responseTime;
                            break;
                        }
                    }
                }
                return nearestValue;
            });

            // 构建 markArea 数据 - 标记维护、重试和离线时段
            // 使用 getStatusBarClass 的相同逻辑判断实际状态
            const markAreas = [];
            let areaStart = null;
            let areaDisplayStatus = null;
            
            data.forEach((item, index) => {
                // 判断实际显示状态: online, maintenance, retry, down
                const displayStatus = this.getStatusBarClass(item);
                const isOnline = displayStatus === 'up';
                
                if (!isOnline) {
                    // 非在线状态 (maintenance/retry/down)
                    if (areaStart === null) {
                        // 开始新的区域
                        areaStart = index;
                        areaDisplayStatus = displayStatus;
                    } else if (areaDisplayStatus !== displayStatus) {
                        // 状态变化了,结束当前区域,开始新区域
                        markAreas.push({
                            displayStatus: areaDisplayStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaDisplayStatus = displayStatus;
                    }
                } else {
                    // 在线状态
                    if (areaStart !== null) {
                        // 结束之前的区域
                        markAreas.push({
                            displayStatus: areaDisplayStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = null;
                        areaDisplayStatus = null;
                    }
                }
            });
            
            // 如果最后还有未结束的区域
            if (areaStart !== null) {
                markAreas.push({
                    displayStatus: areaDisplayStatus,
                    start: areaStart,
                    end: data.length - 1
                });
            }
            
            // 计算Y轴范围 - 使用平均值和标准差，避免偶发大延迟导致趋势图不清晰
            const validTimes = responseTimes.filter(t => t !== null);
            let maxTime = 100;
            
            if (validTimes.length > 0) {
                // 计算平均值
                const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
                // 计算标准差
                const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
                const stdDev = Math.sqrt(variance);
                
                // 使用平均值 + 2倍标准差作为上限，这样可以包含约95%的正常数据
                // 同时排除极端异常值的影响
                maxTime = avgTime + 2 * stdDev;
                
                // 如果所有数据都很接近（标准差很小），使用最大值
                if (stdDev < avgTime * 0.2) {
                    maxTime = Math.max(...validTimes);
                }
                
                // 添加一些边距使图表更美观
                const margin = maxTime * 0.1 || 10;
                maxTime = maxTime + margin;
            }

            // 构建 markArea 配置（显示离线/维护/重试背景）
            const markAreaData = markAreas.map(area => {
                let color;
                // 根据实际显示状态选择颜色
                if (area.displayStatus === 'maintenance') {
                    color = 'rgba(59, 130, 246, 0.15)';  // 蓝色 - 维护中
                } else if (area.displayStatus === 'down') {
                    color = 'rgba(239, 68, 68, 0.3)';    // 红色 - 离线
                } else if (area.displayStatus === 'retry') {
                    color = 'rgba(245, 158, 11, 0.3)';   // 橙色 - 重试中
                } else {
                    color = 'rgba(156, 163, 175, 0.3)';  // 灰色 - 其他
                }
                
                // markArea 从 area.start 延伸到 area.end + 1，覆盖整个区域
                return [
                    { xAxis: area.start, itemStyle: { color: color } },
                    { xAxis: area.end + 1 }  // +1 延伸到下一个刻度边界
                ];
            });
            
            // 获取主题颜色
            const themeColors = this.getThemeColors();
            
            const option = {
                grid: {
                    left: '3px',
                    right: '3px',
                    bottom: '30px',
                    top: '10px',
                    containLabel: true  // 包含标签,保证Y轴显示
                },
                xAxis: {
                    type: 'category',
                    data: timesForAxis,  // x轴使用仅时间的数组
                    boundaryGap: true,  // 数据点居中
                    axisLabel: {
                        fontSize: 11,
                        color: themeColors.textColor,
                        interval: Math.floor(timesForAxis.length / 4)
                    },
                    axisLine: {
                        lineStyle: { color: themeColors.lineColor }
                    },
                    axisTick: {
                        show: false
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: Math.round(maxTime),
                    axisLabel: {
                        fontSize: 11,
                        color: themeColors.textColor
                    },
                    axisLine: {
                        show: false
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: themeColors.gridLineColor,
                            width: 1,
                            type: 'dashed'
                        }
                    }
                },
                // visualMap: 控制趋势线在不同区域的颜色
                visualMap: {
                    show: false,
                    dimension: 0,  // 基于 x 轴索引
                    pieces: data.map((item, index) => ({
                        gte: index,
                        lt: index + 1,
                        color: item.status === 1 ? '#10b981' : 'transparent'  // 正常=绿色，离线/重试=透明
                    })),
                    seriesIndex: 0  // 只应用于趋势线 series
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        label: {
                            show: false
                        }
                    },
                    formatter: (params) => {
                        const dataIndex = params[0].dataIndex;
                        const item = data[dataIndex];
                        const time = timesForTooltip[dataIndex];  // 使用完整时间（包含年月日）
                        const t = i18n[this.language];
                        const statusLabel = this.language === 'zh' ? '状态' : 'Status';
                        const responseLabel = this.language === 'zh' ? '响应' : 'Response';
                        
                        // status=1 且有响应时间: 在线
                        if (item.status === 1 && item.responseTime !== null) {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #10b981;">${t.online}</span><br/>${responseLabel}: ${item.responseTime}ms</div>`;
                        }
                        // status=1 但无响应时间: 维护中
                        else if (item.status === 1 && item.responseTime === null) {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #3b82f6;">${t.maintenance}</span></div>`;
                        }
                        // status=2: 重试中
                        else if (item.status === 2) {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #f59e0b;">${t.retry}</span></div>`;
                        }
                        // status=0: 离线
                        else {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #ef4444;">${t.offline}</span></div>`;
                        }
                    }
                },
                series: [
                    {
                        type: 'line',
                        data: responseTimes,
                        smooth: true,
                        showSymbol: false,
                        connectNulls: false,  // 不连接 null 值，显示为断点
                        lineStyle: {
                            width: 2
                            // 颜色由 visualMap 控制
                        },
                        markArea: {
                            silent: false,  // 允许 tooltip 穿透
                            data: markAreaData,
                            z: 10  // 上层，覆盖趋势线
                        },
                        z: 1  // 趋势线在底层
                    }
                ]
            };

            // 设置图表配置
            chart.setOption(option);
            
            // 添加点击事件处理：点击图表内部不跳转，只显示详细信息
            // 移除之前的点击事件监听器
            chart.off('click');
            
            // 添加新的点击事件（阻止跳转到详情页）
            chart.on('click', (params) => {
                // 点击图表内部，不做跳转，tooltip已经显示了详细信息
                // 如果需要，可以在这里添加其他交互逻辑
                logger.info('Chart point clicked:', params);
            });
        },

        // 切换图表周期
        changeChartPeriod(monitorId, period) {
            const monitor = this.monitors.find(m => m.id === monitorId);
            if (monitor) {
                monitor.selectedPeriod = period;
                this.$nextTick(() => {
                    this.renderChart(monitor);
                });
            }
        },

        // 跳转到详情页
        goToDetail(monitorId) {
            // 在跳转前保存倒计时状态
            sessionStorage.setItem('mainPageCountdown', this.countdown.toString());
            sessionStorage.setItem('mainPagePaused', this.paused.toString());
            sessionStorage.setItem('mainPageTimestamp', Date.now().toString());
            logger.info(`💾 [主页→详情页] 跳转前保存倒计时状态: ${this.countdown}秒, 暂停: ${this.paused}`);
            logger.info(`📍 [主页→详情页] 跳转到详情页,监控ID: ${monitorId}`);
            logger.info('⏱️ [主页→详情页] 主页1分钟倒计时将在详情页后台继续运行');
            
            window.location.href = `/detail.html?id=${monitorId}`;
        },

        // 获取横幅样式类
        getBannerClass() {
            if (!this.stats) return 'success';
            if (this.stats.downMonitors === 0) return 'success';
            if (this.stats.downMonitors > 3) return 'error';
            return 'warning';
        },
        
        // 获取系统状态栏样式类
        getSystemStatusClass() {
            return 'status-' + this.systemStatus;
        },

        // 获取状态图标类
        getStatusIconClass(status, responseTime) {
            // 使用与 getStatusBarClass 相同的逻辑
            if (status === 1) {
                return responseTime != null ? 'up' : 'maintenance';
            }
            if (status === 2) return 'retry';
            return 'down';
        },
        
        // 获取监控类型标签
        getMonitorTypeLabel(type) {
            const typeLabels = {
                'http': 'HTTP',
                'https': 'HTTPS',
                'tcp': 'TCP',
                'port': 'TCP Port',
                'ping': 'Ping/ICMP',
                'dns': 'DNS',
                'docker': 'Docker',
                'keyword': 'Keyword',
                'grpc': 'gRPC',
                'push': 'Push'
            };
            return typeLabels[type] || type.toUpperCase();
        },

        // 获取状态条类（支持 4 种状态）
        getStatusBarClass(item) {
            const status = typeof item === 'object' ? item.status : item;
            const responseTime = typeof item === 'object' ? item.responseTime : null;
            
            // 4 种状态判断：
            // status=1 且 responseTime 有值: 在线 (绿色)
            // status=1 且 responseTime 无值: 维护中 (蓝色)
            // status=2: 重试中 (橙色)
            // status=0: 离线 (红色)
            if (status === 1) {
                return responseTime != null ? 'up' : 'maintenance';
            }
            if (status === 2) return 'retry';
            if (status === 0) return 'down';
            return 'pending';
        },

        // 获取状态标题
        getStatusTitle(item) {
            const locale = this.language === 'zh' ? 'zh-CN' : 'en-US';
            // 使用 24 小时制格式
            const time = new Date(item.createdAt).toLocaleString(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            const t = this.t;
            
            if (item.status === 1) {
                return `${time} - ${t.normal} (${item.responseTime}ms)`;
            } else if (item.status === 2) {
                return `${time} - ${t.maintenance}`;
            } else {
                return `${time} - ${t.offline}`;
            }
        },

        // 格式化可用率
        formatUptime(uptime) {
            return (uptime * 100).toFixed(2) + '%';
        },

        // 获取圆形进度条样式
        getUptimeCircleStyle(uptime) {
            const percent = uptime * 100;
            let color = '#10b981'; // 绿色
            if (percent < 95) color = '#ef4444'; // 红色
            else if (percent < 99) color = '#f59e0b'; // 橙色
            return { '--progress-color': color };
        },

        // 获取圆形进度条dasharray
        getCircleDasharray(uptime) {
            const percent = uptime * 100;
            return `${percent} 100`;
        },

        // 获取可用率颜色 - 根据服务状态返回颜色
        getUptimeColor(monitor) {
            // 优先根据服务状态返回颜色
            if (monitor && monitor.status !== undefined) {
                // 使用与 getStatusBarClass 相同的逻辑
                if (monitor.status === 1) {
                    // status=1 需要根据 responseTime 判断是在线还是维护
                    return monitor.responseTime != null ? '#10b981' : '#3b82f6';
                }
                if (monitor.status === 2) return '#f59e0b'; // 橙色 - 重试中
                if (monitor.status === 0) return '#ef4444'; // 红色 - 离线
            }
            // 兜底:根据可用率返回颜色
            const uptime = monitor?.uptime || 0;
            const percent = uptime * 100;
            if (percent >= 99) return '#10b981'; // 绿色
            if (percent >= 95) return '#f59e0b'; // 橙色
            return '#ef4444'; // 红色
        },

        // 暂停/继续自动刷新
        togglePause() {
            this.paused = !this.paused;
            if (this.paused) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
                this.fetchData();
            }
        },

        // 开始自动刷新
        startAutoRefresh() {
            this.stopAutoRefresh();
            
            logger.info('🚀 [主页] 启动自动刷新机制: 每1分钟触发后端采集');
            
            // 每秒更新倒计时
            this.countdownInterval = setInterval(async () => {
                if (!this.paused && this.countdown > 0) {
                    this.countdown--;
                    // 每10秒打印一次倒计时状态
                    if (this.countdown % 10 === 0 && this.countdown > 0) {
                        logger.info(`⏱️ [主页倒计时] 还有 ${this.countdown} 秒将触发后端采集`);
                    }
                } else if (!this.paused && this.countdown === 0) {
                    this.countdown = this.autoRefreshSeconds;
                    logger.info(`♻️ [主页] 倒计时已重置为 ${this.autoRefreshSeconds} 秒`);

                    // 倒计时归零时触发后端采集
                    logger.info('⏰ [主页] 1分钟倒计时结束,触发后端立即采集Kuma数据...');
                    try {
                        const startTime = Date.now();
                        await axios.post('/api/trigger-fetch?source=countdown');
                        logger.info(`✅ [主页] 已通知后端采集数据 (耗时: ${Date.now() - startTime}ms)`);
                        
                        // 等待1秒让后端完成采集
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // 刷新前端数据(自动刷新模式,会比对差异)
                        logger.info('🔄 [主页] 开始刷新前端数据...');
                        await this.fetchData(false);
                        logger.info('✅ [主页] 前端数据刷新完成');
                    } catch (err) {
                        logger.error('❌ [主页] 触发后端采集失败:', err);
                        // 失败时也尝试刷新前端数据
                        await this.fetchData(false);
                    }
                }
            }, 1000);
        },

        // 停止自动刷新
        stopAutoRefresh() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
        },

        // 切换精简模式
        toggleCompactMode() {
            this.compactMode = !this.compactMode;
            
            // 保存到 localStorage
            localStorage.setItem('compactMode', this.compactMode);
            
            // 如果切换到精简模式，销毁所有图表并停止观察
            if (this.compactMode) {
                if (this.chartObserver) {
                    this.chartObserver.disconnect();
                }
                Object.keys(this.charts).forEach(id => {
                    if (this.charts[id]) {
                        this.charts[id].dispose();
                    }
                });
                this.charts = {};
                this.visibleCharts.clear();
            } else {
                // 切换回完整模式，重新启用懒加载观察
                this.$nextTick(() => {
                    if (this.chartObserver) {
                        this.observeMonitorCards();
                    }
                });
            }
        },

        // 搜索输入处理（带防抖）
        onSearchInput() {
            // 清除之前的计时器
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            
            // 设置新的计时器，300ms 后执行
            this.searchDebounceTimer = setTimeout(() => {
                // 搜索时重新观察卡片（因为 DOM 可能发生变化）
                if (!this.compactMode && this.chartObserver) {
                    // 先断开旧的观察
                    this.chartObserver.disconnect();
                    // 清空已见图表记录
                    this.visibleCharts.clear();
                    // 重新观察
                    this.$nextTick(() => {
                        this.observeMonitorCards();
                    });
                }
            }, 300);
        },

        // 清除搜索
        clearSearch() {
            this.searchQuery = '';
            this.onSearchInput();
        },

        // 应用主题
        applyTheme() {
            let isDark = false;
            
            if (this.themeMode === 'dark') {
                isDark = true;
            } else if (this.themeMode === 'light') {
                isDark = false;
            } else { // auto
                isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            
            // 同时给 html 和 body 添加/移除 dark-mode class
            document.documentElement.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('dark-mode', isDark);
            
            // 重新渲染图表以适应新主题
            if (!this.compactMode) {
                this.$nextTick(() => {
                    this.renderAllCharts();
                });
            }
        },

        // 设置主题模式
        setTheme(mode) {
            this.themeMode = mode;
            localStorage.setItem('themeMode', mode);
            this.applyTheme();
            this.showThemeMenu = false;
        },

        // 切换主题菜单
        toggleThemeMenu() {
            this.showThemeMenu = !this.showThemeMenu;
            this.showLanguageMenu = false;
        },

        // 关闭主题菜单
        closeThemeMenu() {
            this.showThemeMenu = false;
        },

        // 设置语言
        setLanguage(lang) {
            this.language = lang;
            localStorage.setItem('language', lang);
            this.showLanguageMenu = false;
            
            // 重新渲染图表以更新图表中的文本
            if (!this.compactMode) {
                this.$nextTick(() => {
                    this.renderAllCharts();
                });
            }
        },

        // 切换语言菜单
        toggleLanguageMenu() {
            this.showLanguageMenu = !this.showLanguageMenu;
            this.showThemeMenu = false;
        },

        // 关闭语言菜单
        closeLanguageMenu() {
            this.showLanguageMenu = false;
        },

        // 切换所有分组展开/收起（预留功能）
        toggleAllGroups() {
            // TODO: 实现分组展开/收起功能
        },

        // 显示 Tooltip
        showTooltip(event, item) {
            const rect = event.target.getBoundingClientRect();
            this.tooltip.text = this.getStatusTitle(item);
            this.tooltip.x = rect.left + rect.width / 2;
            this.tooltip.y = rect.top - 10;
            this.tooltip.show = true;
        },

        // 隐藏 Tooltip
        hideTooltip() {
            this.tooltip.show = false;
        },

        // 获取主题颜色
        getThemeColors() {
            const isDark = document.body.classList.contains('dark-mode');
            return {
                textColor: isDark ? '#a0a0a0' : '#6b7280',
                lineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                gridLineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb'
            };
        },

        // 格式化日期
        formatDate(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const locale = this.language === 'zh' ? 'zh-CN' : 'en-US';
            return date.toLocaleString(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        },

        // 格式化日期范围
        formatDateRange(startDate, endDate) {
            if (!startDate) return '';
            const locale = this.language === 'zh' ? 'zh-CN' : 'en-US';
            const start = new Date(startDate);
            const startStr = start.toLocaleString(locale, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            if (!endDate) return startStr + ' 开始';
            
            const end = new Date(endDate);
            const endStr = end.toLocaleString(locale, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            
            return `${startStr} ~ ${endStr}`;
        },

        // 切换维护通知展开/收起
        toggleMaintenance(index) {
            // 使用 Vue.set 确保响应性
            this.$set(this.maintenanceExpanded, index, !this.maintenanceExpanded[index]);
        },

        // 简单的 Markdown 渲染（支持基本格式）
        renderMarkdown(text) {
            if (!text) return '';
            
            // 转义 HTML
            let html = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            
            // 转换 Markdown 语法
            html = html
                // 标题
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                // 粗体
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/__(.*?)__/g, '<strong>$1</strong>')
                // 斜体
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/_(.*?)_/g, '<em>$1</em>')
                // 行内代码
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // 链接
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
                // 换行
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
            
            return '<p>' + html + '</p>';
        },

        // 从 sessionStorage 获取静态数据缓存
        getStaticDataCache(key) {
            try {
                const cacheKey = `static_${key}`;
                const cached = sessionStorage.getItem(cacheKey);
                if (!cached) return null;
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                
                // 检查缓存是否过期（5分钟）
                if (now - timestamp > this.staticDataCacheTTL) {
                    sessionStorage.removeItem(cacheKey);
                    logger.info(`🧹 清理过期静态缓存: ${key}`);
                    return null;
                }
                
                logger.info(`📦 使用静态数据缓存: ${key} (剩余 ${Math.floor((this.staticDataCacheTTL - (now - timestamp)) / 1000)}秒)`);
                return data;
            } catch (err) {
                logger.error('Failed to get static cache:', err);
                return null;
            }
        },
        
        // 设置 sessionStorage 静态数据缓存
        setStaticDataCache(key, data) {
            try {
                const cacheKey = `static_${key}`;
                const cacheData = {
                    data: data,
                    timestamp: Date.now()
                };
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
                logger.info(`💾 已缓存静态数据: ${key}`);
            } catch (err) {
                logger.error('Failed to set static cache:', err);
            }
        }
    }
});

// 自定义指令：点击外部关闭
app.directive('click-outside', {
    mounted(el, binding) {
        el.clickOutsideEvent = function(event) {
            if (!(el === event.target || el.contains(event.target))) {
                binding.value();
            }
        };
        document.addEventListener('click', el.clickOutsideEvent);
    },
    unmounted(el) {
        document.removeEventListener('click', el.clickOutsideEvent);
    }
});

app.mount('#app');
