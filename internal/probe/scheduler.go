package probe

import (
	"context"
	"fmt"
	"net/http"
	"sync"
)

// ScheduleInput 调度输入：按 Channel 编排探测任务
type ScheduleInput struct {
	ChannelID   int               `json:"channel_id"`
	BaseURL     string            `json:"base_url"`
	APIKey      string            `json:"api_key"`
	ModelNames  []string          `json:"model_names"`
	Prompt      string            `json:"prompt"`
	Timeout     int               `json:"timeout"`
	Concurrency int               `json:"concurrency"`
	DelayMs     int               `json:"delay_ms"`
	Headers     map[string]string `json:"headers"`
	HTTPClient  *http.Client      `json:"-"` // 通道代理 HTTP 客户端，nil 时直连
}

// ChannelSchedule 多 Channel 并发编排器
type ChannelSchedule struct {
	sem chan struct{}
}

// NewChannelSchedule 创建调度器，perChannelConcurrency 控制每个 Channel 内部并发
func NewChannelSchedule(perChannelConcurrency int) *ChannelSchedule {
	if perChannelConcurrency <= 0 {
		perChannelConcurrency = 3
	}
	return &ChannelSchedule{
		sem: make(chan struct{}, perChannelConcurrency),
	}
}

// RunBatch 并发执行多个 Channel 的探测任务，通过 onResult 回调实时返回结果
func (s *ChannelSchedule) RunBatch(ctx context.Context, inputs []ScheduleInput, onResult func(channelID int, r ProbeResult)) ([]ChannelScheduleResult, error) {
	results := make([]ChannelScheduleResult, len(inputs))
	var wg sync.WaitGroup

	for i, input := range inputs {
		wg.Add(1)
		go func(idx int, in ScheduleInput) {
			defer wg.Done()

			probeInput := ProbeInput{
				BaseURL:     in.BaseURL,
				APIKey:      in.APIKey,
				ModelNames:  in.ModelNames,
				Prompt:      in.Prompt,
				Timeout:     in.Timeout,
				Concurrency: 1, // 由外层 ChannelSchedule 控制并发
				DelayMs:     in.DelayMs,
				Headers:     in.Headers,
				HTTPClient:  in.HTTPClient,
			}

			probeResults, err := ProbeModelsFull(ctx, probeInput, func(r ProbeResult) {
				if onResult != nil {
					onResult(in.ChannelID, r)
				}
			})

			results[idx] = ChannelScheduleResult{
				ChannelID: in.ChannelID,
				Results:   probeResults,
				Error:     err,
			}
		}(i, input)
	}

	wg.Wait()
	return results, nil
}

// ChannelScheduleResult 单个 Channel 的探测结果
type ChannelScheduleResult struct {
	ChannelID int           `json:"channel_id"`
	Results   []ProbeResult `json:"results"`
	Error     error         `json:"error,omitempty"`
}

// RunSingleChannel 对单个 Channel 执行探测
func RunSingleChannel(ctx context.Context, input ScheduleInput, onResult func(channelID int, r ProbeResult)) (*ChannelScheduleResult, error) {
	if input.ChannelID == 0 {
		return nil, fmt.Errorf("channel_id is required")
	}

	schedule := NewChannelSchedule(input.Concurrency)
	results, err := schedule.RunBatch(ctx, []ScheduleInput{input}, onResult)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("no results")
	}
	return &results[0], nil
}
