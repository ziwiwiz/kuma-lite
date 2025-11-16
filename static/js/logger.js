// 前端日志工具
// 根据后端配置的日志级别控制前端日志输出

class FrontendLogger {
    constructor() {
        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4
        };
        // 默认使用WARN级别，避免在初始化完成前输出过多日志
        this.currentLevel = this.levels.WARN;
        this.initialized = false;
    }

    // 初始化日志系统，从后端获取配置
    async init() {
        try {
            const response = await fetch('/api/log-config');
            const config = await response.json();
            this.setLevel(config.logLevel || 'INFO');
            this.initialized = true;
            // 只在DEBUG或INFO级别时输出初始化消息
            if (this.currentLevel <= this.levels.INFO) {
                console.info('[INFO] 前端日志系统初始化完成，级别:', config.logLevel);
            }
        } catch (error) {
            console.error('[ERROR] 获取日志配置失败:', error);
            this.currentLevel = this.levels.INFO;
        }
    }

    // 设置日志级别
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (this.levels.hasOwnProperty(upperLevel)) {
            this.currentLevel = this.levels[upperLevel];
        }
    }

    // 判断是否应该输出该级别的日志
    shouldLog(level) {
        return this.currentLevel <= level;
    }

    // DEBUG级别日志
    debug(...args) {
        if (this.shouldLog(this.levels.DEBUG)) {
            console.log('[DEBUG]', ...args);
        }
    }

    // INFO级别日志
    info(...args) {
        if (this.shouldLog(this.levels.INFO)) {
            console.info('[INFO]', ...args);
        }
    }

    // WARN级别日志
    warn(...args) {
        if (this.shouldLog(this.levels.WARN)) {
            console.warn('[WARN]', ...args);
        }
    }

    // ERROR级别日志
    error(...args) {
        if (this.shouldLog(this.levels.ERROR)) {
            console.error('[ERROR]', ...args);
        }
    }

    // FATAL级别日志
    fatal(...args) {
        if (this.shouldLog(this.levels.FATAL)) {
            console.error('[FATAL]', ...args);
        }
    }
}

// 创建全局日志实例
const logger = new FrontendLogger();

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => logger.init());
} else {
    logger.init();
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}
