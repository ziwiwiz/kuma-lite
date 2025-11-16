package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"
)

// LogLevel 日志级别
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
	FATAL
)

var levelNames = map[LogLevel]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
}

var levelColors = map[LogLevel]string{
	DEBUG: "\033[36m", // 青色
	INFO:  "\033[32m", // 绿色
	WARN:  "\033[33m", // 黄色
	ERROR: "\033[31m", // 红色
	FATAL: "\033[35m", // 紫色
}

const colorReset = "\033[0m"

// Logger 日志记录器
type Logger struct {
	level       LogLevel
	logger      *log.Logger
	enableColor bool
}

var defaultLogger *Logger

// Init 初始化日志系统
func Init(level string, enableColor bool) {
	logLevel := parseLogLevel(level)
	defaultLogger = &Logger{
		level:       logLevel,
		logger:      log.New(os.Stdout, "", 0),
		enableColor: enableColor,
	}

	Info("日志系统初始化完成 - 级别: %s", levelNames[logLevel])
}

// parseLogLevel 解析日志级别字符串
func parseLogLevel(level string) LogLevel {
	switch strings.ToUpper(level) {
	case "DEBUG":
		return DEBUG
	case "INFO":
		return INFO
	case "WARN", "WARNING":
		return WARN
	case "ERROR":
		return ERROR
	case "FATAL":
		return FATAL
	default:
		return INFO
	}
}

// SetOutput 设置输出目标
func SetOutput(w io.Writer) {
	if defaultLogger != nil {
		defaultLogger.logger.SetOutput(w)
	}
}

// SetLevel 设置日志级别
func SetLevel(level string) {
	if defaultLogger != nil {
		defaultLogger.level = parseLogLevel(level)
	}
}

// logMessage 内部日志方法
func (l *Logger) logMessage(level LogLevel, format string, args ...interface{}) {
	if l.level > level {
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	levelStr := levelNames[level]
	message := fmt.Sprintf(format, args...)

	var output string
	if l.enableColor {
		color := levelColors[level]
		output = fmt.Sprintf("%s[%s]%s %s - %s", color, levelStr, colorReset, timestamp, message)
	} else {
		output = fmt.Sprintf("[%s] %s - %s", levelStr, timestamp, message)
	}

	l.logger.Println(output)

	// FATAL 级别直接退出
	if level == FATAL {
		os.Exit(1)
	}
}

// Debug 调试日志
func Debug(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.logMessage(DEBUG, format, args...)
	}
}

// Info 信息日志
func Info(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.logMessage(INFO, format, args...)
	}
}

// Warn 警告日志
func Warn(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.logMessage(WARN, format, args...)
	}
}

// Error 错误日志
func Error(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.logMessage(ERROR, format, args...)
	}
}

// Fatal 致命错误日志（会退出程序）
func Fatal(format string, args ...interface{}) {
	if defaultLogger != nil {
		defaultLogger.logMessage(FATAL, format, args...)
	}
}

// 兼容标准库 log 的方法
func Println(args ...interface{}) {
	Info("%s", fmt.Sprint(args...))
}

func Printf(format string, args ...interface{}) {
	Info(format, args...)
}
