package fetcher

import (
	"encoding/json"
	"fmt"
	"io"
	"kuma-lite/backend/config"
	"kuma-lite/backend/models"
	"log"
	"net/http"
	"time"
)

type KumaStatusPage struct {
	PublicGroupList []PublicGroup `json:"publicGroupList"`
}

type KumaHeartBeatResponse struct {
	HeartbeatList map[string][]KumaHeartBeat `json:"heartbeatList"`
	UptimeList    map[string]float64         `json:"uptimeList"`
}

type PublicGroup struct {
	Name        string        `json:"name"`
	MonitorList []KumaMonitor `json:"monitorList"`
}

type KumaMonitor struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	URL     string `json:"url"`
	SendUrl int    `json:"sendUrl"`
}

type KumaHeartBeat struct {
	Status int     `json:"status"`
	Time   string  `json:"time"`
	Msg    string  `json:"msg"`
	Ping   float64 `json:"ping"`
}

func FetchKumaData() (*KumaStatusPage, *KumaHeartBeatResponse, error) {
	cfg := config.AppConfig
	statusPage, err := fetchStatusPage(cfg.KumaAPIURL, cfg.KumaStatusSlug)
	if err != nil {
		return nil, nil, err
	}
	heartbeatData, err := fetchHeartbeatData(cfg.KumaAPIURL, cfg.KumaStatusSlug)
	if err != nil {
		log.Printf("获取心跳数据失败: %v", err)
		return statusPage, nil, nil
	}
	return statusPage, heartbeatData, nil
}

func fetchStatusPage(apiURL, slug string) (*KumaStatusPage, error) {
	url := fmt.Sprintf("%s/api/status-page/%s", apiURL, slug)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP 状态码: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}
	var statusPage KumaStatusPage
	if err := json.Unmarshal(body, &statusPage); err != nil {
		return nil, fmt.Errorf("解析 JSON 失败: %w", err)
	}
	return &statusPage, nil
}

func fetchHeartbeatData(apiURL, slug string) (*KumaHeartBeatResponse, error) {
	url := fmt.Sprintf("%s/api/status-page/heartbeat/%s", apiURL, slug)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("请求心跳数据失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("心跳数据 HTTP 状态码: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取心跳响应失败: %w", err)
	}
	var heartbeatData KumaHeartBeatResponse
	if err := json.Unmarshal(body, &heartbeatData); err != nil {
		return nil, fmt.Errorf("解析心跳 JSON 失败: %w", err)
	}
	return &heartbeatData, nil
}

func ParseMonitors(statusPage *KumaStatusPage, heartbeatData *KumaHeartBeatResponse) []models.Monitor {
	var monitors []models.Monitor
	for groupIndex, group := range statusPage.PublicGroupList {
		for _, kumaMonitor := range group.MonitorList {
			monitor := models.Monitor{
				ID:           kumaMonitor.ID,
				Name:         kumaMonitor.Name,
				Type:         kumaMonitor.Type,
				URL:          kumaMonitor.URL,
				Group:        group.Name, // 保存 Kuma 分组名称
				GroupOrder:   groupIndex, // 保存分组在原始列表中的顺序
				Status:       0,
				Uptime:       0,
				ResponseTime: 0,
			}
			if heartbeatData != nil {
				monitorIDStr := fmt.Sprintf("%d", kumaMonitor.ID)
				// UptimeList key format is "monitorID_period", e.g., "1_24" for 24-hour uptime
				uptimeKey := fmt.Sprintf("%s_24", monitorIDStr)
				if uptime, ok := heartbeatData.UptimeList[uptimeKey]; ok {
					monitor.Uptime = uptime
				}
				if heartbeats, ok := heartbeatData.HeartbeatList[monitorIDStr]; ok && len(heartbeats) > 0 {
					latestHeartBeat := heartbeats[len(heartbeats)-1]
					monitor.Status = latestHeartBeat.Status
					monitor.ResponseTime = int(latestHeartBeat.Ping)
				}
			}
			monitors = append(monitors, monitor)
		}
	}
	return monitors
}

func ParseHeartBeats(monitorID int, heartbeatData *KumaHeartBeatResponse) []models.HeartBeat {
	var heartbeats []models.HeartBeat
	if heartbeatData == nil {
		return heartbeats
	}
	monitorIDStr := fmt.Sprintf("%d", monitorID)
	kumaHeartbeats, ok := heartbeatData.HeartbeatList[monitorIDStr]
	if !ok {
		return heartbeats
	}
	for _, kumaHB := range kumaHeartbeats {
		hb := models.HeartBeat{
			MonitorID:    monitorID,
			Status:       kumaHB.Status,
			ResponseTime: int(kumaHB.Ping),
			Message:      kumaHB.Msg,
		}
		timeFormats := []string{
			"2006-01-02 15:04:05.999",
			"2006-01-02 15:04:05",
			time.RFC3339,
		}
		parsed := false
		for _, format := range timeFormats {
			if t, err := time.Parse(format, kumaHB.Time); err == nil {
				hb.CreatedAt = t
				parsed = true
				break
			}
		}
		if !parsed {
			hb.CreatedAt = time.Now()
		}
		heartbeats = append(heartbeats, hb)
	}
	return heartbeats
}
