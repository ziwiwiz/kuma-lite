const { createApp } = Vue;

// 多语言文本 - 详情页
const i18nDetail = {
    zh: {
        // 页面标题
        monitorDetail: '监控详情',
        loading: '加载监控数据中...',
        
        // 周期选择
        recent: '最近 100 次',
        '3h': '最近 3 小时',
        '6h': '最近 6 小时',
        '24h': '最近 24 小时',
        '7d': '最近 7 天',
        '30d': '最近 30 天',
        '90d': '最近 90 天',
        
        // 统计标签
        totalChecks: '总检测',
        onlineChecks: '在线',
        onlineRate: '在线率',
        currentResponse: '当前',
        avgResponse: '平均',
        minResponse: '最小',
        maxResponse: '最大',
        
        // 图表
        responseTime: '响应时间',
        
        // 状态
        online: '在线',
        retry: '重试中',
        maintenance: '维护中',
        offline: '离线',
        normal: '正常',
        
        // Tooltip
        status: '状态',
        response: '响应',
        
        // 错误
        noMonitorId: '未指定监控 ID',
        
        // 单位
        ms: 'ms'
    },
    en: {
        // Page title
        monitorDetail: 'Monitor Detail',
        loading: 'Loading monitor data...',
        
        // Period selection
        recent: 'Recent 100',
        '3h': 'Last 3 Hours',
        '6h': 'Last 6 Hours',
        '24h': 'Last 24 Hours',
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
        
        // Statistics labels
        totalChecks: 'Total',
        onlineChecks: 'Online',
        onlineRate: 'Uptime',
        currentResponse: 'Current',
        avgResponse: 'Average',
        minResponse: 'Minimum',
        maxResponse: 'Maximum',
        
        // Chart
        responseTime: 'Response Time',
        
        // Status
        online: 'Online',
        retry: 'Retry',
        maintenance: 'Maintenance',
        offline: 'Offline',
        normal: 'Normal',
        
        // Tooltip
        status: 'Status',
        response: 'Response',
        
        // Error
        noMonitorId: 'No monitor ID specified',
        
        // Unit
        ms: 'ms'
    }
};

const app = createApp({
    data() {
        return {
            monitorId: null,
            monitor: null,
            historyData: [],
            loading: true,
            error: null,
            language: 'zh', // 语言设置
            selectedPeriod: 'recent',
            showPeriodDropdown: false,
            periodOptions: [
                { value: 'recent', hours: null },
                { value: '3h', hours: 3 },
                { value: '6h', hours: 6 },
                { value: '24h', hours: 24 },
                { value: '7d', hours: 168 },
                { value: '30d', hours: 720 },
                { value: '90d', hours: 2160 }
            ],
            chart: null,
            tooltip: {
                show: false,
                text: '',
                x: 0,
                y: 0
            },
            // 自动刷新相关
            refreshInterval: null,
            countdownInterval: null,
            countdown: 60,
            paused: false,
            lastUpdate: '',
            historyCacheTTL: 300000 // 前端缓存5分钟(300秒)，与主页一致
        };
    },
    computed: {
        displayHistory() {
            if (!this.historyData || this.historyData.length === 0) return [];
            
            // 直接返回 historyData，不再做前端过滤
            // 因为后端已经按照选择的周期返回了正确的数据
            // - "最近100条" (recent): 返回最近100条
            // - "3h/6h/24h/1w": 返回对应时间范围内的所有数据
            return this.historyData;
        },
        
        // 翻译文本
        t() {
            return i18nDetail[this.language] || i18nDetail.zh;
        },
        
        // 获取周期标签
        selectedPeriodLabel() {
            // 从翻译对象中获取对应的标签
            return this.t[this.selectedPeriod] || this.selectedPeriod;
        },
        avgResponseTime() {
            // 如果当前监控处于维护状态,返回 null
            if (this.monitor && this.monitor.responseTime == null) return null;
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            // 只计算真正在线的记录 (status=1 且 responseTime 有值)
            const validData = this.displayHistory.filter(item => 
                item.status === 1 && item.responseTime != null
            );
            if (validData.length === 0) return 0;
            const sum = validData.reduce((acc, item) => acc + item.responseTime, 0);
            return Math.round(sum / validData.length);
        },
        currentResponseTime() {
            if (!this.historyData || this.historyData.length === 0) return '-';
            const latest = this.historyData[this.historyData.length - 1];
            const displayStatus = this.getStatusBarClass(latest);
            
            if (displayStatus === 'up') {
                return latest.responseTime;
            } else if (displayStatus === 'maintenance') {
                return this.t.maintenance;
            } else if (displayStatus === 'retry') {
                return this.t.retry;
            } else {
                return this.t.offline;
            }
        },
        maxResponseTime() {
            // 如果当前监控处于维护状态,返回 null
            if (this.monitor && this.monitor.responseTime == null) return null;
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            // 只计算真正在线的记录
            const validData = this.displayHistory.filter(item => 
                item.status === 1 && item.responseTime != null
            );
            if (validData.length === 0) return 0;
            return Math.max(...validData.map(item => item.responseTime));
        },
        minResponseTime() {
            // 如果当前监控处于维护状态,返回 null
            if (this.monitor && this.monitor.responseTime == null) return null;
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            // 只计算真正在线的记录
            const validData = this.displayHistory.filter(item => 
                item.status === 1 && item.responseTime != null
            );
            if (validData.length === 0) return 0;
            return Math.min(...validData.map(item => item.responseTime));
        },
        totalChecks() {
            return this.displayHistory.length;
        },
        onlineChecks() {
            // 在线 + 维护中都算作"可用"
            return this.displayHistory.filter(item => {
                const displayStatus = this.getStatusBarClass(item);
                return displayStatus === 'up' || displayStatus === 'maintenance';
            }).length;
        },
        offlineChecks() {
            // 重试中 + 离线算作"不可用"
            return this.displayHistory.filter(item => {
                const displayStatus = this.getStatusBarClass(item);
                return displayStatus === 'retry' || displayStatus === 'down';
            }).length;
        },
        onlineRate() {
            if (this.totalChecks === 0) return '0.00%';
            return ((this.onlineChecks / this.totalChecks) * 100).toFixed(2) + '%';
        }
    },
    mounted() {
        // 初始化主题
        this.initTheme();
        
        // 从 localStorage 恢复语言设置
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage) {
            this.language = savedLanguage;
        }
        
        // 详情页不清理缓存,避免影响主页的缓存
        // this.cleanOldCaches();
        
        // 从 URL 获取监控 ID
        const urlParams = new URLSearchParams(window.location.search);
        this.monitorId = urlParams.get('id');
        
        if (!this.monitorId) {
            this.error = this.t.noMonitorId;
            this.loading = false;
            return;
        }

        logger.info('📍 [详情页] 进入详情页, 监控ID:', this.monitorId);
        logger.info('⏱️ [详情页] 主页1分钟倒计时将在后台继续运行');
        
        // 读取主页倒计时状态(用于了解主页状态,但不影响详情页)
        const savedCountdown = sessionStorage.getItem('mainPageCountdown');
        if (savedCountdown) {
            logger.info(`📊 [详情页] 主页倒计时状态: ${savedCountdown}秒`);
        }

        this.fetchData(true);  // 初次加载，传入 true
        
        // 启动详情页自己的刷新机制(60秒)
        this.startAutoRefresh();
        
        // 窗口大小变化时重新渲染图表
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.period-dropdown')) {
                this.showPeriodDropdown = false;
            }
        });
    },
    beforeUnmount() {
        this.stopAutoRefresh();
        if (this.chart) {
            this.chart.dispose();
        }
    },
    methods: {
        // localStorage 缓存辅助方法(详情页已不使用缓存,保留这些函数以兼容旧代码)
        getHistoryCache(monitorId, cacheType) {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                const cached = localStorage.getItem(cacheKey);
                if (!cached) {
                    logger.info(`🔍 缓存miss: ${cacheKey}`);
                    return null;
                }
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                
                // 检查缓存是否过期
                if (now - timestamp > this.historyCacheTTL) {
                    const age = Math.round((now - timestamp) / 1000);
                    logger.info(`⏰ 缓存过期: ${cacheKey}, 年龄: ${age}秒`);
                    localStorage.removeItem(cacheKey);
                    return null;
                }
                
                const age = Math.round((now - timestamp) / 1000);
                logger.info(`💾 缓存hit: ${cacheKey}, 记录数: ${data.length}, 年龄: ${age}秒`);
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
        
        setHistoryCache(monitorId, cacheType, data) {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                
                // 根据缓存类型限制数据量
                let limitedData = data;
                if (cacheType === 'limit_100') {
                    limitedData = data.slice(-100);
                } else if (cacheType === 'limit_50') {
                    limitedData = data.slice(-50);
                } else if (cacheType === '24h') {
                    // 24小时数据只缓存最近200条，避免过大
                    limitedData = data.slice(-200);
                } else if (cacheType === '1w') {
                    // 1周数据只缓存最近300条
                    limitedData = data.slice(-300);
                } else {
                    // 其他时间段限制在500条以内
                    limitedData = data.slice(-500);
                }
                
                const cacheData = {
                    data: limitedData,
                    timestamp: Date.now(),
                    count: limitedData.length,
                    originalCount: data.length
                };
                
                const cacheString = JSON.stringify(cacheData);
                
                // 检查缓存大小，如果超过200KB，减少数据量
                if (cacheString.length > 200 * 1024) {
                    logger.warn(`缓存数据过大(${Math.floor(cacheString.length / 1024)}KB)，减少到100条`);
                    limitedData = data.slice(-100);
                    const reducedCacheData = {
                        data: limitedData,
                        timestamp: Date.now(),
                        count: limitedData.length,
                        originalCount: data.length
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(reducedCacheData));
                    logger.info(`💾 保存缓存(已压缩): ${cacheKey}, 记录数: ${limitedData.length}/${data.length}`);
                } else {
                    localStorage.setItem(cacheKey, cacheString);
                    logger.info(`💾 保存缓存: ${cacheKey}, 记录数: ${limitedData.length}/${data.length}`);
                }
            } catch (err) {
                // localStorage满了(详情页不应该到这里,因为不创建缓存)
                if (err.name === 'QuotaExceededError') {
                    logger.warn('localStorage已满(异常:详情页不应该写缓存)');
                    // 详情页不清理缓存,避免影响主页
                    // this.cleanOldCaches();
                    // 重试一次，使用更少的数据
                    try {
                        const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                        const minimalData = data.slice(-50); // 只保留最近50条
                        const cacheData = {
                            data: minimalData,
                            timestamp: Date.now(),
                            count: minimalData.length,
                            originalCount: data.length
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                        logger.info(`💾 保存缓存(最小化): ${cacheKey}, 记录数: ${minimalData.length}/${data.length}`);
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
                });
                
                if (keysToRemove.length > 0) {
                    logger.info(`🧹 已清理 ${keysToRemove.length} 个过期缓存`);
                }
            } catch (err) {
                logger.error('Failed to clean caches:', err);
            }
        },
        
        async fetchData(isInitial = false, forceReload = false) {
            if (this.paused && !isInitial && !forceReload) return;
            
            const loadType = isInitial ? '首次加载' : (forceReload ? '强制刷新' : '自动刷新');
            logger.info(`📊 [详情页-${loadType}] 开始获取监控数据, ID: ${this.monitorId}, 周期: ${this.selectedPeriod}`);
            
            try {
                if (isInitial) {
                    this.loading = true;
                }
                this.error = null;

                // 获取监控基本信息
                const monitorRes = await axios.get(`/api/monitors/${this.monitorId}`);
                if (monitorRes.data.success) {
                    this.monitor = monitorRes.data.data;
                    logger.info(`✅ [详情页-${loadType}] 已获取监控基本信息: ${this.monitor.name}`);
                }

                // 详情页缓存策略:
                // 1. "最近100次"模式: 优先使用主页的localStorage缓存
                // 2. 时间段查询模式: 直接从服务器获取,不使用缓存
                let historyRes;
                
                if (this.selectedPeriod === 'recent') {
                    // "最近100次"模式: 先尝试读取主页缓存
                    const cached = this.getHistoryCache(this.monitorId, 'limit_100');
                    if (cached && !forceReload) {
                        this.historyData = cached.data;
                        const age = Math.round((Date.now() - cached.timestamp) / 1000);
                        logger.info(`💾 使用主页缓存: ${this.historyData.length} 条记录, 年龄: ${age}秒`);
                    } else {
                        // 缓存不存在或强制刷新,从服务器获取
                        const url = `/api/monitors/${this.monitorId}/history?limit=100`;
                        logger.info(`📡 请求API: ${url}`);
                        historyRes = await axios.get(url);
                        if (historyRes.data.success) {
                            this.historyData = historyRes.data.data;
                            logger.info(`✅ 获取最近100条数据: ${this.historyData.length} 条记录`);
                            // 不在详情页创建缓存,避免污染主页缓存逻辑
                        }
                    }
                } else {
                    // 时间段查询模式: 直接从服务器获取,不使用缓存
                    const selectedOption = this.periodOptions.find(opt => opt.value === this.selectedPeriod);
                    const hours = selectedOption ? selectedOption.hours : 24;
                    
                    const url = `/api/monitors/${this.monitorId}/history?hours=${hours}`;
                    logger.info(`📡 请求API (时间段查询,不使用缓存): ${url}`);
                    historyRes = await axios.get(url);
                    if (historyRes.data.success) {
                        this.historyData = historyRes.data.data;
                        logger.info(`✅ 获取${this.selectedPeriod}数据: ${this.historyData.length} 条记录, hours=${hours}`);
                        
                        // 调试：显示时间范围
                        if (this.historyData.length > 0) {
                            const firstTime = new Date(this.historyData[0].createdAt).toLocaleString();
                            const lastTime = new Date(this.historyData[this.historyData.length - 1].createdAt).toLocaleString();
                            logger.info(`📅 时间范围: ${firstTime} 到 ${lastTime}`);
                        }
                    }
                }

                this.lastUpdate = new Date().toLocaleString('zh-CN');
                this.loading = false;
                this.countdown = 60;

                // 使用 $nextTick 确保 DOM 更新完成后再渲染图表
                this.$nextTick(() => {
                    this.renderChart();
                });
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
            }
        },
        changePeriod(periodValue) {
            const oldPeriod = this.selectedPeriod;
            this.selectedPeriod = periodValue;
            this.showPeriodDropdown = false;
            
            // 检查是否切换了周期
            if (oldPeriod !== periodValue) {
                // 切换周期时，检查新周期的缓存
                // isInitial=false, forceReload=false，这样会先检查缓存
                this.fetchData(false, false);
            }
        },
        togglePeriodDropdown() {
            this.showPeriodDropdown = !this.showPeriodDropdown;
        },
        renderChart() {
            logger.info('🎨 开始渲染图表...');
            const chartEl = document.getElementById('main-chart');
            if (!chartEl) {
                logger.warn('图表容器不存在');
                return;
            }
            if (!this.historyData || this.historyData.length === 0) {
                logger.warn('没有历史数据');
                return;
            }
            logger.info(`📊 渲染数据: ${this.historyData.length} 条记录`);

            // 销毁旧图表
            if (this.chart) {
                this.chart.dispose();
            }

            const chart = echarts.init(chartEl);
            this.chart = chart;

            const data = this.displayHistory;

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

            // 构建响应时间数据
            // 首先标记需要断开的位置（时间间隔过大的地方）
            const gapIndices = [];  // 记录gap发生在哪些索引之间
            for (let i = 1; i < data.length; i++) {
                const prevTime = new Date(data[i - 1].createdAt);
                const currentTime = new Date(data[i].createdAt);
                const intervalMinutes = (currentTime - prevTime) / 1000 / 60;
                
                // 如果间隔超过10分钟，记录为gap
                if (intervalMinutes > 10) {
                    logger.info(`⚠️ 检测到数据断点: ${data[i - 1].createdAt} 到 ${data[i].createdAt}, 间隔 ${Math.round(intervalMinutes)} 分钟`);
                    gapIndices.push(i - 1);  // 记录gap前的索引
                }
            }
            
            // 构建响应时间数据（已弃用，保留用于兼容性）
            const responseTimes = data.map((item, index) => {
                if (gapIndices.includes(index) || gapIndices.includes(index - 1)) {
                    return null;
                }
                const displayStatus = this.getStatusBarClass(item);
                if (displayStatus === 'up') {
                    return item.responseTime;
                }
                if (index > 0) {
                    const prevDisplayStatus = this.getStatusBarClass(data[index - 1]);
                    if (prevDisplayStatus === 'up') {
                        return data[index - 1].responseTime;
                    }
                }
                return null;
            });
            
            // 使用原始数据，不插入额外的元素
            const finalTimesForAxis = timesForAxis;
            const finalTimesForTooltip = timesForTooltip;
            const finalData = data;

            // 构建 markArea 数据 - 标记维护、重试和离线时段
            // 使用 getStatusBarClass 的相同逻辑判断实际状态
            const markAreas = [];
            let areaStart = null;
            let areaDisplayStatus = null;
            
            finalData.forEach((item, index) => {
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
                            end: index  // 延伸到当前点（状态变化点）
                        });
                        areaStart = index;
                        areaDisplayStatus = displayStatus;
                    }
                } else {
                    // 在线状态
                    if (areaStart !== null) {
                        // 结束之前的区域，延伸到当前正常状态点
                        markAreas.push({
                            displayStatus: areaDisplayStatus,
                            start: areaStart,
                            end: index  // 延伸到当前点（正常状态点）
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
                    end: finalData.length - 1
                });
            }
            
            // 数据gap不需要添加到markAreas，让它保持空白即可
            // gapIndices 已经在 responseTimes 中设置为 null，会自动显示为断点
            
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

            // 构建 markArea 配置（显示离线/维护/重试背景，数据gap保持空白）
            // 使用时间轴时，需要基于时间戳而不是索引
            const markAreaData = markAreas.map(area => {
                // 根据实际显示状态选择背景色
                let color;
                if (area.displayStatus === 'maintenance') {
                    color = 'rgba(59, 130, 246, 0.15)';  // 蓝色 - 维护中
                } else if (area.displayStatus === 'down') {
                    color = 'rgba(239, 68, 68, 0.3)';    // 红色 - 离线
                } else if (area.displayStatus === 'retry') {
                    color = 'rgba(245, 158, 11, 0.3)';   // 橙色 - 重试中
                } else {
                    color = 'rgba(156, 163, 175, 0.3)';  // 灰色 - 其他
                }
                
                // 获取起始和结束时间戳
                // 起始时间：异常状态开始点的时间戳
                const startTime = new Date(finalData[area.start].createdAt).getTime();
                
                // 结束时间：area.end 现在指向状态变化点（可能是正常点或另一个异常点）
                // 我们需要延伸到这个点的时间戳
                let endTime;
                if (area.end < finalData.length) {
                    // 延伸到状态变化点的时间戳
                    endTime = new Date(finalData[area.end].createdAt).getTime();
                } else {
                    // 如果 area.end 超出范围（最后一个点），延伸一个监控间隔
                    if (finalData.length >= 2) {
                        const interval = new Date(finalData[finalData.length - 1].createdAt).getTime() - 
                                        new Date(finalData[finalData.length - 2].createdAt).getTime();
                        endTime = new Date(finalData[area.start].createdAt).getTime() + interval;
                    } else {
                        // 如果只有一个点，延伸60秒
                        endTime = new Date(finalData[area.start].createdAt).getTime() + 60000;
                    }
                }
                
                // markArea 使用时间戳
                return [
                    { xAxis: startTime, itemStyle: { color: color } },
                    { xAxis: endTime }
                ];
            });
            
            // 获取主题颜色
            const themeColors = this.getThemeColors();
            const isDark = document.body.classList.contains('dark-mode');
            
            // 构建时间轴数据：将数据转换为 [时间戳, 响应时间] 格式
            // 策略：异常区域的第一个点用于平滑过渡，第二个点开始插入null断开连接
            const seriesData = [];
            
            data.forEach((item, index) => {
                const timestamp = new Date(item.createdAt).getTime();
                let value = null;
                
                const displayStatus = this.getStatusBarClass(item);
                const isOnline = displayStatus === 'up';
                const prevDisplayStatus = index > 0 ? this.getStatusBarClass(data[index - 1]) : null;
                const isPrevOnline = prevDisplayStatus === 'up';
                
                // 如果是gap前后的点，设为null以断开线条
                if (gapIndices.includes(index) || gapIndices.includes(index - 1)) {
                    value = null;
                } else if (isOnline) {
                    // 在线状态点：检查是否在某个异常 markArea 区域内
                    let isInsideMarkArea = false;
                    for (const area of markAreas) {
                        // 如果这个正常点的索引在某个异常区域范围内，不显示
                        if (index > area.start && index < area.end) {
                            isInsideMarkArea = true;
                            break;
                        }
                    }
                    
                    if (!isInsideMarkArea) {
                        // 不在异常区域内，显示响应时间
                        value = item.responseTime;
                    }
                    // 在异常区域内的正常点，保持 null，不显示
                } else if (index > 0 && isPrevOnline) {
                    // 从在线切换到非在线的第一个点，使用前一个正常点的响应时间，形成过渡
                    value = data[index - 1].responseTime;
                }
                // 其他非在线状态点保持 null
                
                seriesData.push([timestamp, value]);
                
                // 关键：如果当前点是非在线状态的第一个点（用于过渡），在其后立即插入一个null点来断开
                if (value !== null && !isOnline && index > 0 && isPrevOnline) {
                    // 插入一个时间稍微靠后的null点，断开与后续正常点的连接
                    // 使用当前时间戳加1毫秒，确保在时间轴上的位置正确
                    seriesData.push([timestamp + 1, null]);
                }
            });
            
            // 计算最小显示范围：确保至少显示50个数据点
            // 计算数据点的平均时间间隔
            let minZoomSpan = 5 * 60 * 1000; // 默认5分钟
            if (data.length >= 2) {
                const totalTimeSpan = new Date(data[data.length - 1].createdAt).getTime() - 
                                     new Date(data[0].createdAt).getTime();
                const avgInterval = totalTimeSpan / (data.length - 1);
                // 至少显示50个数据点的时间范围
                const minSpanFor50Points = avgInterval * 50;
                // 取较大值，确保至少5分钟或50个数据点
                minZoomSpan = Math.max(5 * 60 * 1000, minSpanFor50Points);
            }
            
            const option = {
                grid: {
                    left: '50px',
                    right: '30px',
                    bottom: window.innerWidth < 768 ? '100px' : '85px',  // 增加底部空间以容纳缩放滑块
                    top: '20px'
                },
                xAxis: {
                    type: 'time',  // 使用时间轴，会按真实时间间隔分布数据点
                    axisLabel: {
                        fontSize: window.innerWidth < 768 ? 10 : 12,
                        color: themeColors.textColor,
                        formatter: function(value) {
                            const date = new Date(value);
                            // 根据时间范围决定显示格式
                            const dataTimeSpan = data[data.length - 1] ? 
                                new Date(data[data.length - 1].createdAt).getTime() - new Date(data[0].createdAt).getTime() : 0;
                            
                            if (dataTimeSpan > 2 * 24 * 3600 * 1000) {
                                // 超过2天，显示月-日 时:分
                                return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                            } else {
                                // 2天内，只显示时:分
                                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                            }
                        }
                    },
                    axisLine: {
                        lineStyle: { color: themeColors.lineColor }
                    },
                    axisTick: {
                        show: false
                    },
                    splitLine: {
                        show: false
                    }
                },
                yAxis: {
                    type: 'value',
                    min: 0,
                    max: Math.round(maxTime),
                    axisLabel: {
                        fontSize: 12,
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
                // 数据缩放组件配置
                dataZoom: [
                    {
                        type: 'inside',  // 内置型数据区域缩放组件（支持鼠标滚轮缩放、触摸板缩放）
                        start: 0,        // 默认显示全部数据
                        end: 100,
                        zoomOnMouseWheel: true,     // 开启鼠标滚轮缩放
                        moveOnMouseMove: true,      // 开启鼠标拖拽平移
                        moveOnMouseWheel: false,    // 关闭鼠标滚轮平移（避免与缩放冲突）
                        preventDefaultMouseMove: true,
                        minValueSpan: minZoomSpan,  // 动态计算：至少5分钟或50个数据点
                        maxValueSpan: null  // 最大显示范围：不限制（显示全部）
                    },
                    {
                        type: 'slider',  // 滑动条型数据区域缩放组件
                        start: 0,
                        end: 100,
                        height: 20,
                        bottom: window.innerWidth < 768 ? 10 : 10,
                        showDetail: false,  // 不显示手柄详细信息
                        handleSize: 0,  // 隐藏手柄
                        handleStyle: {
                            opacity: 0  // 完全透明
                        },
                        textStyle: {
                            color: themeColors.textColor,
                            fontSize: 10
                        },
                        borderColor: themeColors.lineColor,
                        fillerColor: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        showDetail: true,
                        showDataShadow: true,
                        dataBackground: {
                            lineStyle: {
                                color: isDark ? 'rgba(76, 175, 80, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                            },
                            areaStyle: {
                                color: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                            }
                        },
                        selectedDataBackground: {
                            lineStyle: {
                                color: isDark ? 'rgba(76, 175, 80, 0.5)' : 'rgba(16, 185, 129, 0.5)'
                            },
                            areaStyle: {
                                color: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                            }
                        }
                    }
                ],
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        label: {
                            show: false
                        }
                    },
                    formatter: (params) => {
                        if (!params || params.length === 0) return '';
                        
                        // 获取当前点的时间戳（x轴值）
                        const timestamp = params[0].value[0];
                        
                        // 通过时间戳在 finalData 中查找对应的数据项
                        const item = finalData.find(d => new Date(d.createdAt).getTime() === timestamp);
                        
                        if (!item) return '';
                        
                        // 格式化时间
                        const date = new Date(item.createdAt);
                        const time = date.toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                        
                        const displayStatus = this.getStatusBarClass(item);
                        
                        if (displayStatus === 'up') {
                            return `<div style="text-align: left;">${time}<br/>${this.t.status}: <span style="color: #10b981;">${this.t.online}</span><br/>${this.t.response}: ${item.responseTime}${this.t.ms}</div>`;
                        } else if (displayStatus === 'maintenance') {
                            return `<div style="text-align: left;">${time}<br/>${this.t.status}: <span style="color: #3b82f6;">${this.t.maintenance}</span></div>`;
                        } else if (displayStatus === 'retry') {
                            return `<div style="text-align: left;">${time}<br/>${this.t.status}: <span style="color: #f59e0b;">${this.t.retry}</span></div>`;
                        } else {
                            return `<div style="text-align: left;">${time}<br/>${this.t.status}: <span style="color: #ef4444;">${this.t.offline}</span></div>`;
                        }
                    }
                },
                series: [
                    {
                        type: 'line',
                        data: seriesData,  // 使用 [timestamp, value] 格式的数据
                        smooth: true,
                        showSymbol: false,
                        connectNulls: false,  // 不连接 null 值，显示为断点
                        lineStyle: {
                            width: 2,
                            color: '#10b981'  // 绿色线条
                        },
                        // 添加 markArea 来显示重试中和离线的背景色
                        markArea: {
                            silent: false,  // 允许 tooltip 穿透
                            data: markAreaData,
                            z: 10  // 上层，覆盖趋势线
                        },
                        z: 1  // 趋势线在底层
                    }
                ]
            };

            chart.setOption(option);
        },
        getStatusIconClass(status, responseTime = null) {
            // 支持 4 种状态
            if (status === 1) {
                return responseTime != null ? 'up' : 'maintenance';
            }
            if (status === 2) return 'retry';
            return 'down';
        },
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
            return 'down';
        },
        getStatusTitle(item) {
            const time = new Date(item.createdAt).toLocaleString('zh-CN');
            const displayStatus = this.getStatusBarClass(item);
            
            if (displayStatus === 'up') {
                return `${time} - 在线 (${item.responseTime}ms)`;
            } else if (displayStatus === 'maintenance') {
                return `${time} - 维护中`;
            } else if (displayStatus === 'retry') {
                return `${time} - 重试中`;
            } else {
                return `${time} - 离线`;
            }
        },
        formatUptime(uptime) {
            return (uptime * 100).toFixed(2) + '%';
        },
        getUptimeColor(uptime) {
            const percent = uptime * 100;
            if (percent >= 99) return '#10b981';
            if (percent >= 95) return '#f59e0b';
            return '#ef4444';
        },
        getCircleDasharray(uptime) {
            const percent = uptime * 100;
            return `${percent} 100`;
        },
        goBack() {
            logger.info('📍 [详情页→主页] 用户点击返回按钮,返回主页');
            logger.info('⏱️ [详情页→主页] 主页将恢复之前的倒计时状态');
            window.location.href = '/';
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

        // 优化的图表更新方法 - 只更新数据，不重建图表
        updateChart() {
            if (!this.chart) {
                // 如果图表不存在，创建新图表
                this.renderChart();
                return;
            }

            const data = this.displayHistory;
            if (!data || data.length === 0) {
                return;
            }

            // 准备新数据
            const times = data.map(item => {
                const date = new Date(item.createdAt);
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit'
                });
            });

            // 构建响应时间数据（检测数据间隔，间隔过大时显示断点）
            const responseTimes = data.map((item, index) => {
                const displayStatus = this.getStatusBarClass(item);
                if (displayStatus === 'up') {
                    // 在线状态，显示响应时间
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
                
                // 找最近的有效值（在线状态）
                let nearestValue = null;
                // 先向前查找
                for (let i = index - 1; i >= 0; i--) {
                    const status = this.getStatusBarClass(data[i]);
                    if (status === 'up' && data[i].responseTime != null) {
                        nearestValue = data[i].responseTime;
                        break;
                    }
                }
                // 如果前面没找到，向后查找
                if (nearestValue === null) {
                    for (let i = index + 1; i < data.length; i++) {
                        const status = this.getStatusBarClass(data[i]);
                        if (status === 'up' && data[i].responseTime != null) {
                            nearestValue = data[i].responseTime;
                            break;
                        }
                    }
                }
                return nearestValue;
            });

            // 构建 markArea 数据 - 使用 getStatusBarClass 判断实际状态
            const markAreas = [];
            let areaStart = null;
            let areaDisplayStatus = null;
            
            data.forEach((item, index) => {
                const displayStatus = this.getStatusBarClass(item);
                const isOnline = displayStatus === 'up';
                
                if (!isOnline) {
                    if (areaStart === null) {
                        areaStart = index;
                        areaDisplayStatus = displayStatus;
                    } else if (areaDisplayStatus !== displayStatus) {
                        markAreas.push({
                            displayStatus: areaDisplayStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaDisplayStatus = displayStatus;
                    }
                } else {
                    if (areaStart !== null) {
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
            
            if (areaStart !== null) {
                markAreas.push({
                    displayStatus: areaDisplayStatus,
                    start: areaStart,
                    end: data.length - 1
                });
            }

            const markAreaData = markAreas.map(area => {
                let color;
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
                    { 
                        xAxis: area.start,
                        itemStyle: { 
                            color: color
                        }
                    },
                    { 
                        xAxis: area.end + 1  // +1 延伸到下一个刻度边界
                    }
                ];
            });

            // 计算Y轴范围
            const validTimes = responseTimes.filter(t => t !== null);
            let maxTime = 100;
            
            if (validTimes.length > 0) {
                const avgTime = validTimes.reduce((sum, t) => sum + t, 0) / validTimes.length;
                const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / validTimes.length;
                const stdDev = Math.sqrt(variance);
                
                maxTime = avgTime + 2 * stdDev;
                
                if (stdDev < avgTime * 0.2) {
                    maxTime = Math.max(...validTimes);
                }
                
                const margin = maxTime * 0.1 || 10;
                maxTime = maxTime + margin;
            }

            // 使用 setOption 更新数据（合并更新，保留其他配置）
            this.chart.setOption({
                grid: {
                    bottom: window.innerWidth < 768 ? '60px' : '45px'  // 移动端需要更多底部空间
                },
                xAxis: {
                    data: times,
                    axisLabel: {
                        fontSize: window.innerWidth < 768 ? 10 : 12,
                        rotate: window.innerWidth < 768 ? 45 : 0,
                        interval: Math.floor(times.length / 4)
                    }
                },
                yAxis: {
                    max: Math.round(maxTime)
                },
                visualMap: {
                    pieces: data.map((item, index) => {
                        const displayStatus = this.getStatusBarClass(item);
                        return {
                            gte: index,
                            lt: index + 1,
                            color: displayStatus === 'up' ? '#10b981' : 'transparent'
                        };
                    })
                },
                series: [{
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
                }]
            });  // 默认 notMerge: false，合并更新
        },

        // 开始自动刷新
        startAutoRefresh() {
            this.stopAutoRefresh();
            
            logger.info('🚀 [详情页] 启动自动刷新机制: 每60秒刷新一次');
            
            // 每60秒刷新数据
            this.refreshInterval = setInterval(() => {
                if (!this.paused) {
                    logger.info('⏰ [详情页] 60秒定时器触发,刷新详情页数据');
                    this.fetchData(false);
                }
            }, 60000);
            
            // 每秒更新倒计时
            this.countdownInterval = setInterval(() => {
                if (!this.paused && this.countdown > 0) {
                    this.countdown--;
                } else if (!this.paused && this.countdown === 0) {
                    logger.info('⏰ [详情页] 倒计时归零,刷新详情页数据');
                    this.fetchData(false);
                    this.countdown = 60;
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

        // 切换暂停/继续
        togglePause() {
            this.paused = !this.paused;
            if (!this.paused) {
                this.countdown = 60;
                this.fetchData(false);
            }
        },

        // 初始化主题
        initTheme() {
            const savedTheme = localStorage.getItem('themeMode') || 'auto';
            logger.info('Detail page - Loading theme:', savedTheme);
            this.applyTheme(savedTheme);
            
            // 监听系统主题变化（当设置为 auto 时）
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const currentTheme = localStorage.getItem('themeMode') || 'auto';
                if (currentTheme === 'auto') {
                    logger.info('System theme changed, dark mode:', e.matches);
                    document.documentElement.classList.toggle('dark-mode', e.matches);
                    document.body.classList.toggle('dark-mode', e.matches);
                    // 重新渲染图表
                    if (this.chart && this.historyData.length > 0) {
                        this.renderChart();
                    }
                }
            });
            
            // 监听 localStorage 变化（从其他页面切换主题）
            window.addEventListener('storage', (e) => {
                if (e.key === 'themeMode') {
                    logger.info('Theme changed from another tab:', e.newValue);
                    this.applyTheme(e.newValue || 'auto');
                }
            });
        },

        // 应用主题
        applyTheme(theme) {
            logger.info('Applying theme:', theme);
            const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            
            if (theme === 'auto') {
                logger.info('Auto mode - System prefers dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
            } else {
                logger.info('Manual mode - Dark mode:', theme === 'dark');
            }
            
            // 同时给 html 和 body 添加/移除 dark-mode class
            document.documentElement.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('dark-mode', isDark);
            logger.info('Body has dark-mode class:', document.body.classList.contains('dark-mode'));
            
            // 如果图表已存在，重新渲染以应用新主题
            if (this.chart && this.historyData.length > 0) {
                this.renderChart();
            }
        },

        // 获取主题颜色
        getThemeColors() {
            const isDark = document.body.classList.contains('dark-mode');
            return {
                textColor: isDark ? '#a0a0a0' : '#6b7280',
                lineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
                gridLineColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb'
            };
        }
    }
});

app.mount('#app');
