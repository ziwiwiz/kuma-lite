const { createApp } = Vue;

// 多语言文本
const i18n = {
    zh: {
        // 状态
        allServices: '全部服务',
        online: '在线',
        offline: '离线',
        down: '离线',
        someServicesDown: '部分服务异常',
        maintenance: '维护中',
        retry: '重试中',
        normal: '正常',
        
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
        online: 'Online',
        offline: 'Offline',
        down: 'Down',
        someServicesDown: 'Some Services Down',
        maintenance: 'Maintenance',
        retry: 'Retry',
        normal: 'Normal',
        
        // Statistics
        uptime: 'Uptime',
        avgResponse: 'Avg Response',
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
            refreshInterval: null,
            countdownInterval: null,
            historyCache: {}, // 前端历史数据缓存 { monitorId: { data: [], timestamp: 0 } }
            historyCacheTTL: 30000, // 前端缓存30秒(与后端一致)
            tooltip: {
                show: false,
                text: '',
                x: 0,
                y: 0
            }
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
        
        this.fetchData();
        this.startAutoRefresh();
    },
    beforeUnmount() {
        this.stopAutoRefresh();
    },
    methods: {
        // 获取数据
        async fetchData() {
            if (this.paused) return;
            
            try {
                // 只在首次加载时显示 loading 状态
                if (this.isInitialLoad) {
                    this.loading = true;
                }
                this.error = null;

                // 获取监控列表
                const monitorsRes = await axios.get('/api/monitors');
                if (monitorsRes.data.success) {
                    this.monitors = monitorsRes.data.data;
                    
                    // 为每个监控项获取历史数据
                    await this.fetchAllHistory();
                }

                // 获取统计信息
                const statsRes = await axios.get('/api/stats');
                if (statsRes.data.success) {
                    this.stats = statsRes.data.data;
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
                    this.loading = false;
                    this.isInitialLoad = false;
                }
                this.countdown = 60;
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
                this.isInitialLoad = false;
                console.error('Fetch error:', err);
            }
        },

        // 获取所有监控项的历史数据
        async fetchAllHistory() {
            // 并发获取所有监控项的历史数据，限制并发数避免性能问题
            const batchSize = 5; // 每批最多5个并发请求
            const monitors = this.monitors;
            
            for (let i = 0; i < monitors.length; i += batchSize) {
                const batch = monitors.slice(i, i + batchSize);
                const promises = batch.map(async (monitor) => {
                    try {
                        // 检查前端缓存
                        const cached = this.historyCache[monitor.id];
                        const now = Date.now();
                        if (cached && (now - cached.timestamp) < this.historyCacheTTL) {
                            // 使用缓存数据
                            monitor.statusHistory = cached.data.slice(-100);
                            // 计算平均响应时间
                            const validResponses = cached.data.filter(item => item.status === 1);
                            if (validResponses.length > 0) {
                                const sum = validResponses.reduce((acc, item) => acc + item.responseTime, 0);
                                monitor.avgResponseTime = Math.round(sum / validResponses.length);
                            }
                            
                            // 缓存命中,立即渲染图表(非精简模式)
                            if (!this.compactMode && !this.isInitialLoad) {
                                this.$nextTick(() => {
                                    this.renderChart(monitor);
                                });
                            }
                            return;
                        }
                        
                        // 缓存未命中,请求后端(主页只获取最近100条)
                        const res = await axios.get(`/api/monitors/${monitor.id}/history?limit=100`);
                        if (res.data.success && res.data.data.length > 0) {
                            // 更新前端缓存
                            this.historyCache[monitor.id] = {
                                data: res.data.data,
                                timestamp: now
                            };
                            
                            monitor.statusHistory = res.data.data.slice(-100); // 最近100条
                            // 计算平均响应时间
                            const validResponses = res.data.data.filter(item => item.status === 1);
                            if (validResponses.length > 0) {
                                const sum = validResponses.reduce((acc, item) => acc + item.responseTime, 0);
                                monitor.avgResponseTime = Math.round(sum / validResponses.length);
                            }
                            
                            // 请求完成后立即渲染图表(非精简模式)
                            if (!this.compactMode && !this.isInitialLoad) {
                                this.$nextTick(() => {
                                    this.renderChart(monitor);
                                });
                            }
                        } else {
                            monitor.statusHistory = [];
                        }
                    } catch (err) {
                        console.error(`Failed to fetch history for monitor ${monitor.id}:`, err);
                        monitor.statusHistory = [];
                    }
                });
                
                await Promise.all(promises);
            }
            
            // 首次加载时统一渲染所有图表
            if (this.isInitialLoad) {
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.renderAllCharts();
                    }, 300);
                });
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
            const data = this.getDisplayHistory(monitor);
            if (!data.length) return 0;
            const validTimes = data.filter(d => d.status === 1).map(d => d.responseTime);
            if (!validTimes.length) return 0;
            const avg = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
            return Math.round(avg);
        },

        // 获取最大响应时间
        getMaxResponseTime(monitor) {
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
            
            this.monitors.forEach(monitor => {
                const chartEl = document.getElementById('chart-' + monitor.id);
                if (chartEl) {
                    this.renderChart(monitor);
                }
            });
            
            // 如果有容器未找到，500ms 后重试一次
            setTimeout(() => {
                this.monitors.forEach(monitor => {
                    const chartEl = document.getElementById('chart-' + monitor.id);
                    if (chartEl && !this.charts[monitor.id]) {
                        this.renderChart(monitor);
                    }
                });
            }, 500);
        },

        // 渲染单个图表
        renderChart(monitor) {
            const chartEl = document.getElementById('chart-' + monitor.id);
            if (!chartEl) {
                console.warn(`图表容器不存在: chart-${monitor.id}`);
                return;
            }
            if (!monitor.statusHistory) {
                console.warn(`监控 ${monitor.id} 没有历史数据`);
                return;
            }
            if (monitor.statusHistory.length === 0) {
                console.warn(`监控 ${monitor.id} 历史数据为空`);
                return;
            }

            // 如果图表已存在，直接更新而不是销毁重建
            let chart = this.charts[monitor.id];
            if (!chart) {
                chart = echarts.init(chartEl);
                this.charts[monitor.id] = chart;
            }

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

            // 构建连续的响应时间数据（保持数据连续性）
            let lastValidValue = null;
            let firstValidValue = null;
            
            // 先找第一个有效值
            for (let i = 0; i < data.length; i++) {
                if (data[i].status === 1) {
                    firstValidValue = data[i].responseTime;
                    break;
                }
            }
            
            lastValidValue = firstValidValue;
            const responseTimes = data.map(item => {
                if (item.status === 1) {
                    lastValidValue = item.responseTime;
                    return item.responseTime;
                }
                // 离线/重试：使用前一个有效值
                return lastValidValue;
            });

            // 构建 markArea 数据 - 标记维护和离线时段
            const markAreas = [];
            let areaStart = null;
            let areaStatus = null;
            
            data.forEach((item, index) => {
                if (item.status !== 1) {
                    // 离线或维护状态
                    if (areaStart === null) {
                        // 开始新的区域
                        areaStart = index;
                        areaStatus = item.status;
                    } else if (areaStatus !== item.status) {
                        // 状态变化了,结束当前区域,开始新区域
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaStatus = item.status;
                    }
                } else {
                    // 正常状态
                    if (areaStart !== null) {
                        // 结束之前的区域
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = null;
                        areaStatus = null;
                    }
                }
            });
            
            // 如果最后还有未结束的区域
            if (areaStart !== null) {
                markAreas.push({
                    status: areaStatus,
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

            // 构建 markArea 配置（显示离线/重试背景）
            const markAreaData = markAreas.map(area => {
                const color = area.status === 2
                    ? 'rgba(245, 158, 11, 0.3)'  // 橙色 - 重试中
                    : 'rgba(239, 68, 68, 0.3)';   // 红色 - 离线
                
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
                    left: '50px',
                    right: '20px',
                    bottom: '30px',
                    top: '20px'
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
                        
                        if (item.status === 1) {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #10b981;">${t.normal}</span><br/>${responseLabel}: ${item.responseTime}ms</div>`;
                        } else if (item.status === 2) {
                            return `<div style="text-align: left;">${time}<br/>${statusLabel}: <span style="color: #f59e0b;">${t.retry}</span></div>`;
                        } else {
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

            // 使用 notMerge: false 进行增量更新，提升性能
            chart.setOption(option, { notMerge: false, lazyUpdate: true });
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
            window.location.href = `/detail.html?id=${monitorId}`;
        },

        // 获取横幅样式类
        getBannerClass() {
            if (!this.stats) return 'success';
            if (this.stats.downMonitors === 0) return 'success';
            if (this.stats.downMonitors > 3) return 'error';
            return 'warning';
        },

        // 获取状态图标类
        getStatusIconClass(status) {
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },

        // 获取状态条类
        getStatusBarClass(item) {
            const status = typeof item === 'object' ? item.status : item;
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
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
                return `${time} - ${t.retry}`;
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

        // 获取可用率颜色
        getUptimeColor(uptime) {
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
            
            // 每60秒刷新数据
            this.refreshInterval = setInterval(() => {
                if (!this.paused) {
                    this.fetchData();
                }
            }, 60000);
            
            // 每秒更新倒计时
            this.countdownInterval = setInterval(() => {
                if (!this.paused && this.countdown > 0) {
                    this.countdown--;
                } else if (!this.paused && this.countdown === 0) {
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

        // 切换精简模式
        toggleCompactMode() {
            this.compactMode = !this.compactMode;
            
            // 保存到 localStorage
            localStorage.setItem('compactMode', this.compactMode);
            
            // 如果切换到精简模式，销毁所有图表
            if (this.compactMode) {
                Object.keys(this.charts).forEach(id => {
                    if (this.charts[id]) {
                        this.charts[id].dispose();
                    }
                });
                this.charts = {};
            } else {
                // 切换回完整模式，重新渲染图表
                this.$nextTick(() => {
                    this.renderAllCharts();
                });
            }
        },

        // 搜索输入处理
        onSearchInput() {
            // 搜索时重新渲染图表
            if (!this.compactMode) {
                this.$nextTick(() => {
                    this.renderAllCharts();
                });
            }
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
