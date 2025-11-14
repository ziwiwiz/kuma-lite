const { createApp } = Vue;

// 多语言文本 - 详情页
const i18nDetail = {
    zh: {
        // 页面标题
        monitorDetail: '监控详情',
        loading: '加载监控数据中...',
        
        // 周期选择
        recent: '最近',
        
        // 统计标签
        totalChecks: '总检测',
        onlineChecks: '在线',
        onlineRate: '在线率',
        currentResponse: '当前',
        avgResponse: '平均',
        maxResponse: '最大',
        
        // 图表
        responseTime: '响应时间',
        
        // 状态
        online: '在线',
        retry: '重试中',
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
        recent: 'Recent',
        
        // Statistics labels
        totalChecks: 'Total',
        onlineChecks: 'Online',
        onlineRate: 'Uptime',
        currentResponse: 'Current',
        avgResponse: 'Average',
        maxResponse: 'Maximum',
        
        // Chart
        responseTime: 'Response Time',
        
        // Status
        online: 'Online',
        retry: 'Retry',
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
                { value: '1w', hours: 168 }
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
            const option = this.periodOptions.find(opt => opt.value === this.selectedPeriod);
            if (!option) return this.t.recent;
            
            if (option.value === 'recent') {
                return this.t.recent;
            }
            return option.value; // 对于 3h, 6h 等直接返回
        },
        avgResponseTime() {
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            const validData = this.displayHistory.filter(item => item.status === 1);
            if (validData.length === 0) return 0;
            const sum = validData.reduce((acc, item) => acc + item.responseTime, 0);
            return Math.round(sum / validData.length);
        },
        currentResponseTime() {
            if (!this.historyData || this.historyData.length === 0) return '-';
            const latest = this.historyData[this.historyData.length - 1];
            if (latest.status === 1) {
                return latest.responseTime;
            } else if (latest.status === 2) {
                return this.t.retry;
            } else {
                return this.t.offline;
            }
        },
        maxResponseTime() {
            if (!this.displayHistory || this.displayHistory.length === 0) return 0;
            const validData = this.displayHistory.filter(item => item.status === 1);
            if (validData.length === 0) return 0;
            return Math.max(...validData.map(item => item.responseTime));
        },
        totalChecks() {
            return this.displayHistory.length;
        },
        onlineChecks() {
            return this.displayHistory.filter(item => item.status === 1).length;
        },
        offlineChecks() {
            return this.displayHistory.filter(item => item.status !== 1).length;
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
        
        // 从 URL 获取监控 ID
        const urlParams = new URLSearchParams(window.location.search);
        this.monitorId = urlParams.get('id');
        
        if (!this.monitorId) {
            this.error = this.t.noMonitorId;
            this.loading = false;
            return;
        }

        this.fetchData(true);  // 初次加载，传入 true
        
        // 启动自动刷新
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
        // localStorage 缓存辅助方法
        getHistoryCache(monitorId, cacheType) {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                const cached = localStorage.getItem(cacheKey);
                if (!cached) {
                    console.log(`🔍 缓存miss: ${cacheKey}`);
                    return null;
                }
                
                const { data, timestamp } = JSON.parse(cached);
                const now = Date.now();
                
                // 检查缓存是否过期
                if (now - timestamp > this.historyCacheTTL) {
                    console.log(`⏰ 缓存过期: ${cacheKey}`);
                    localStorage.removeItem(cacheKey);
                    return null;
                }
                
                const age = Math.round((now - timestamp) / 1000);
                console.log(`💾 缓存hit: ${cacheKey}, 记录数: ${data.length}, 年龄: ${age}秒`);
                return { data, timestamp };
            } catch (err) {
                console.error('Failed to get cache:', err);
                return null;
            }
        },
        
        setHistoryCache(monitorId, cacheType, data) {
            try {
                const cacheKey = `history_cache_${monitorId}_${cacheType}`;
                const cacheData = {
                    data: data,
                    timestamp: Date.now()
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                console.log(`💾 保存缓存: ${cacheKey}, 记录数: ${data.length}`);
            } catch (err) {
                console.error('Failed to set cache:', err);
            }
        },
        
        async fetchData(isInitial = false, forceReload = false) {
            if (this.paused && !isInitial && !forceReload) return;
            
            try {
                if (isInitial) {
                    this.loading = true;
                }
                this.error = null;

                // 获取监控基本信息
                const monitorRes = await axios.get(`/api/monitors/${this.monitorId}`);
                if (monitorRes.data.success) {
                    this.monitor = monitorRes.data.data;
                }

                // 根据当前选择的周期决定请求方式
                let historyRes;
                const cacheType = this.selectedPeriod === 'recent' ? 'limit_100' : this.selectedPeriod;
                
                // 尝试从缓存读取（初次加载或切换周期时，但不是强制重新加载）
                if (!forceReload) {
                    const cached = this.getHistoryCache(this.monitorId, cacheType);
                    if (cached) {
                        console.log(`✅ 使用缓存数据: ${cacheType}, 记录数: ${cached.data.length}`);
                        this.historyData = cached.data;
                        if (isInitial) {
                            this.loading = false;
                        }
                        this.$nextTick(() => {
                            this.renderChart();
                        });
                        return; // 使用缓存，直接返回
                    }
                }
                
                console.log(`🌐 从服务器获取数据: ${cacheType}`);
                
                if (this.selectedPeriod === 'recent') {
                    // "最近"模式: 获取最近100条,使用 limit 参数
                    const url = `/api/monitors/${this.monitorId}/history?limit=100`;
                    console.log(`📡 请求API: ${url}`);
                    historyRes = await axios.get(url);
                    if (historyRes.data.success) {
                        this.historyData = historyRes.data.data;
                        // 保存到缓存
                        this.setHistoryCache(this.monitorId, 'limit_100', this.historyData);
                        console.log(`✅ 获取最近100条数据: ${this.historyData.length} 条记录`);
                    }
                } else {
                    // 其他时间周期模式(3h/6h/24h/1w): 使用 hours 参数
                    const selectedOption = this.periodOptions.find(opt => opt.value === this.selectedPeriod);
                    const hours = selectedOption ? selectedOption.hours : 24;
                    
                    // 获取指定时间范围的数据（完整替换，不做增量更新）
                    const url = `/api/monitors/${this.monitorId}/history?hours=${hours}`;
                    console.log(`📡 请求API: ${url}`);
                    historyRes = await axios.get(url);
                    if (historyRes.data.success) {
                        this.historyData = historyRes.data.data;
                        // 保存到缓存
                        this.setHistoryCache(this.monitorId, this.selectedPeriod, this.historyData);
                        console.log(`✅ 获取${this.selectedPeriod}数据: ${this.historyData.length} 条记录, hours=${hours}`);
                        
                        // 调试：显示时间范围
                        if (this.historyData.length > 0) {
                            const firstTime = new Date(this.historyData[0].createdAt).toLocaleString();
                            const lastTime = new Date(this.historyData[this.historyData.length - 1].createdAt).toLocaleString();
                            console.log(`📅 时间范围: ${firstTime} 到 ${lastTime}`);
                        }
                    }
                }

                this.lastUpdate = new Date().toLocaleString('zh-CN');
                this.loading = false;
                this.countdown = 60;

                // 更新图表（直接重新渲染确保所有配置正确应用）
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
            console.log('🎨 开始渲染图表...');
            const chartEl = document.getElementById('main-chart');
            if (!chartEl) {
                console.warn('图表容器不存在');
                return;
            }
            if (!this.historyData || this.historyData.length === 0) {
                console.warn('没有历史数据');
                return;
            }
            console.log(`📊 渲染数据: ${this.historyData.length} 条记录`);

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
                    console.log(`⚠️ 检测到数据断点: ${data[i - 1].createdAt} 到 ${data[i].createdAt}, 间隔 ${Math.round(intervalMinutes)} 分钟`);
                    gapIndices.push(i - 1);  // 记录gap前的索引
                }
            }
            
            // 构建响应时间数据：不插入额外的null，直接使用原数据
            const responseTimes = data.map((item, index) => {
                // 如果是gap前后的点，强制设为null以断开线条
                if (gapIndices.includes(index) || gapIndices.includes(index - 1)) {
                    return null;
                }
                // 正常在线状态显示响应时间
                if (item.status === 1) {
                    return item.responseTime;
                }
                // 离线/重试状态用null（不显示线条）
                return null;
            });
            
            // 使用原始数据，不插入额外的元素
            const finalTimesForAxis = timesForAxis;
            const finalTimesForTooltip = timesForTooltip;
            const finalData = data;

            // 构建 markArea 数据 - 标记维护和离线时段
            const markAreas = [];
            let areaStart = null;
            let areaStatus = null;
            
            finalData.forEach((item, index) => {
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
                    end: finalData.length - 1
                });
            }
            
            // 添加数据gap区域标记（使用特殊status=99标识）
            gapIndices.forEach(gapIndex => {
                markAreas.push({
                    status: 99,  // 特殊状态表示数据gap
                    start: gapIndex,
                    end: gapIndex + 1
                });
            });
            
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

            // 构建 markArea 配置（显示离线/重试/gap背景）
            // 使用时间轴时，需要基于时间戳而不是索引
            const markAreaData = markAreas.map(area => {
                let color, label;
                
                if (area.status === 99) {
                    // 数据gap - 使用灰色，添加文字标注
                    color = 'rgba(156, 163, 175, 0.4)';  // 灰色，稍微深一点
                    label = {
                        show: true,
                        position: 'inside',
                        formatter: '数据缺失',
                        color: '#374151',
                        fontSize: 14,
                        fontWeight: 'bold'
                    };
                } else if (area.status === 2) {
                    color = 'rgba(245, 158, 11, 0.3)';  // 橙色 - 重试中
                    label = undefined;
                } else {
                    color = 'rgba(239, 68, 68, 0.3)';   // 红色 - 离线
                    label = undefined;
                }
                
                // 获取起始和结束时间戳
                const startTime = new Date(finalData[area.start].createdAt).getTime();
                const endTime = area.end < finalData.length - 1 
                    ? new Date(finalData[area.end + 1].createdAt).getTime()
                    : new Date(finalData[area.end].createdAt).getTime();
                
                // markArea 使用时间戳
                const areaConfig = [
                    { xAxis: startTime, itemStyle: { color: color } },
                    { xAxis: endTime }
                ];
                
                // 如果有label，添加到第一个点
                if (label) {
                    areaConfig[0].label = label;
                }
                
                return areaConfig;
            });
            
            // 获取主题颜色
            const themeColors = this.getThemeColors();
            
            // 构建时间轴数据：将数据转换为 [时间戳, 响应时间] 格式
            const seriesData = data.map((item, index) => {
                const timestamp = new Date(item.createdAt).getTime();
                let value = null;
                
                // 如果是gap前后的点，设为null以断开线条
                if (gapIndices.includes(index) || gapIndices.includes(index - 1)) {
                    value = null;
                } else if (item.status === 1) {
                    value = item.responseTime;
                }
                
                return [timestamp, value];
            });
            
            const option = {
                grid: {
                    left: '50px',
                    right: '30px',
                    bottom: window.innerWidth < 768 ? '60px' : '45px',  // 移动端需要更多底部空间
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
                        
                        const dataIndex = params[0].dataIndex;
                        const item = finalData[dataIndex];
                        
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
                        
                        if (item.status === 1) {
                            return `<div style="text-align: left;">${time}<br/>${this.t.status}: <span style="color: #10b981;">${this.t.normal}</span><br/>${this.t.response}: ${item.responseTime}${this.t.ms}</div>`;
                        } else if (item.status === 2) {
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
                        z: 1  // 趋势线在底层
                    }
                ]
            };

            chart.setOption(option);
        },
        getStatusIconClass(status) {
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },
        getStatusBarClass(item) {
            const status = typeof item === 'object' ? item.status : item;
            if (status === 1) return 'up';
            if (status === 2) return 'maintenance';
            return 'down';
        },
        getStatusTitle(item) {
            const time = new Date(item.createdAt).toLocaleString('zh-CN');
            if (item.status === 1) {
                return `${time} - 在线 (${item.responseTime}ms)`;
            } else if (data.value === 2) {
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

            // 构建 markArea 数据
            const markAreas = [];
            let areaStart = null;
            let areaStatus = null;
            
            data.forEach((item, index) => {
                if (item.status !== 1) {
                    if (areaStart === null) {
                        areaStart = index;
                        areaStatus = item.status;
                    } else if (areaStatus !== item.status) {
                        markAreas.push({
                            status: areaStatus,
                            start: areaStart,
                            end: index - 1
                        });
                        areaStart = index;
                        areaStatus = item.status;
                    }
                } else {
                    if (areaStart !== null) {
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
            
            if (areaStart !== null) {
                markAreas.push({
                    status: areaStatus,
                    start: areaStart,
                    end: data.length - 1
                });
            }

            const markAreaData = markAreas.map(area => {
                const color = area.status === 2 
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(239, 68, 68, 0.3)';
                
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
                    pieces: data.map((item, index) => ({
                        gte: index,
                        lt: index + 1,
                        color: item.status === 1 ? '#10b981' : 'transparent'
                    }))
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
            
            // 每60秒刷新数据
            this.refreshInterval = setInterval(() => {
                if (!this.paused) {
                    this.fetchData(false);
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
            console.log('Detail page - Loading theme:', savedTheme);
            this.applyTheme(savedTheme);
            
            // 监听系统主题变化（当设置为 auto 时）
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const currentTheme = localStorage.getItem('themeMode') || 'auto';
                if (currentTheme === 'auto') {
                    console.log('System theme changed, dark mode:', e.matches);
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
                    console.log('Theme changed from another tab:', e.newValue);
                    this.applyTheme(e.newValue || 'auto');
                }
            });
        },

        // 应用主题
        applyTheme(theme) {
            console.log('Applying theme:', theme);
            const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            
            if (theme === 'auto') {
                console.log('Auto mode - System prefers dark:', window.matchMedia('(prefers-color-scheme: dark)').matches);
            } else {
                console.log('Manual mode - Dark mode:', theme === 'dark');
            }
            
            // 同时给 html 和 body 添加/移除 dark-mode class
            document.documentElement.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('dark-mode', isDark);
            console.log('Body has dark-mode class:', document.body.classList.contains('dark-mode'));
            
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
