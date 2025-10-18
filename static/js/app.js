appconst { createApp } = Vue;

const app = createApp({
    data() {
        return {
            monitors: [],
            stats: null,
            loading: true,
            error: null,
            selectedMonitor: null,
            lastUpdate: '',
            chart: null,
            searchQuery: '',
            statusFilter: 'all',
            sortBy: 'name'
        };
    },
    computed: {
        filteredMonitors() {
            let result = this.monitors;
            
            // 搜索过滤
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                result = result.filter(m => 
                    m.name.toLowerCase().includes(query) ||
                    m.type.toLowerCase().includes(query) ||
                    m.url.toLowerCase().includes(query)
                );
            }
            
            // 状态过滤
            if (this.statusFilter !== 'all') {
                const statusMap = { 'up': 1, 'down': 0, 'maintenance': 2 };
                result = result.filter(m => m.status === statusMap[this.statusFilter]);
            }
            
            // 排序
            result = [...result].sort((a, b) => {
                switch(this.sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'uptime':
                        return b.uptime - a.uptime;
                    case 'response':
                        return a.responseTime - b.responseTime;
                    case 'status':
                        return b.status - a.status;
                    default:
                        return 0;
                }
            });
            
            return result;
        }
    },
    mounted() {
        this.fetchData();
        // 每分钟刷新一次数据
        setInterval(() => {
            this.fetchData();
        }, 60000);
    },
    methods: {
        async fetchData() {
            try {
                this.loading = true;
                this.error = null;

                // 获取监控列表
                const monitorsRes = await axios.get('/api/monitors');
                if (monitorsRes.data.success) {
                    this.monitors = monitorsRes.data.data;
                }

                // 获取统计信息
                const statsRes = await axios.get('/api/stats');
                if (statsRes.data.success) {
                    this.stats = statsRes.data.data;
                }

                this.lastUpdate = new Date().toLocaleString('zh-CN');
                this.loading = false;
            } catch (err) {
                this.error = '获取数据失败: ' + (err.message || '未知错误');
                this.loading = false;
            }
        },
        async viewDetails(monitor) {
            this.selectedMonitor = monitor;

            // 等待 DOM 更新
            await this.$nextTick();

            // 获取历史数据
            try {
                const res = await axios.get(`/api/monitors/${monitor.id}/history?hours=24`);
                if (res.data.success) {
                    this.renderChart(res.data.data);
                }
            } catch (err) {
                console.error('获取历史数据失败:', err);
            }
        },
        closeDetails() {
            this.selectedMonitor = null;
            if (this.chart) {
                this.chart.dispose();
                this.chart = null;
            }
        },
        renderChart(data) {
            const chartDom = document.getElementById('historyChart');
            if (!chartDom) return;

            if (this.chart) {
                this.chart.dispose();
            }

            this.chart = echarts.init(chartDom);

            // 格式化时间
            const times = data.map(item => new Date(item.createdAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }));

            // 分离正常响应和丢包数据
            const normalData = [];
            const packetLossData = [];
            
            data.forEach((item, index) => {
                if (item.status === 1) {
                    // 正常响应
                    normalData.push([index, item.responseTime]);
                    packetLossData.push([index, null]);
                } else {
                    // 丢包/超时
                    normalData.push([index, null]);
                    packetLossData.push([index, 0]);
                }
            });

            const option = {
                title: {
                    text: '响应时间趋势 (24小时)',
                    left: 'center',
                    textStyle: {
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    formatter: function(params) {
                        const dataIndex = params[0].dataIndex;
                        const item = data[dataIndex];
                        const time = times[dataIndex];
                        
                        if (item.status === 1) {
                            return `${time}<br/>✓ 正常<br/>响应时间: ${item.responseTime}ms`;
                        } else {
                            return `${time}<br/>✗ 丢包/超时<br/>响应时间: 0ms`;
                        }
                    }
                },
                legend: {
                    data: ['正常响应', '丢包/超时'],
                    top: 30,
                    left: 'center'
                },
                xAxis: {
                    type: 'category',
                    data: times,
                    axisLabel: {
                        rotate: 45,
                        fontSize: 10,
                        interval: Math.floor(times.length / 8)
                    },
                    boundaryGap: false
                },
                yAxis: {
                    type: 'value',
                    name: '响应时间 (ms)',
                    nameTextStyle: {
                        fontSize: 12
                    }
                },
                series: [
                    {
                        name: '正常响应',
                        type: 'line',
                        data: normalData,
                        smooth: false,
                        symbolSize: 4,
                        itemStyle: {
                            color: '#f59e0b'
                        },
                        lineStyle: {
                            width: 1.5,
                            color: '#f59e0b'
                        },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                                { offset: 1, color: 'rgba(245, 158, 11, 0.05)' }
                            ])
                        }
                    },
                    {
                        name: '丢包/超时',
                        type: 'line',
                        data: packetLossData,
                        smooth: false,
                        symbol: 'pin',
                        symbolSize: 8,
                        itemStyle: {
                            color: '#9333ea',
                            borderWidth: 0
                        },
                        lineStyle: {
                            width: 2,
                            color: '#9333ea',
                            type: 'solid'
                        }
                    }
                ],
                grid: {
                    left: '60px',
                    right: '30px',
                    bottom: '80px',
                    top: '80px'
                }
            };

            this.chart.setOption(option);
        },
        formatTime(time) {
            return new Date(time).toLocaleString('zh-CN');
        },
        getStatusClass(status) {
            if (status === 1) return 'status-up';
            if (status === 2) return 'status-maintenance';
            return 'status-down';
        },
        getStatusText(status) {
            if (status === 1) return '✓ 正常运行';
            if (status === 2) return '⚠ 重试中';
            return '✗ 异常';
        }
    }
});

// 注册组件
app.component('monitor-card', MonitorCard);

// 挂载应用
app.mount('#app');
