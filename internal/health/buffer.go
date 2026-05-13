package health

import (
	"sync"
	"time"
)

// ChannelHealthSignal 单通道健康信号
type ChannelHealthSignal struct {
	ChannelID   int         `json:"channel_id"`
	StatusCode  int         `json:"status_code"`
	ErrorText   string      `json:"error_text,omitempty"`
	FailureKind FailureKind `json:"failure_kind"`
	Timestamp   time.Time   `json:"timestamp"`
	Count       int         `json:"count"` // 连续同类型失败计数
}

// SignalBuffer 线程安全的通道健康信号缓冲区
type SignalBuffer struct {
	mu      sync.RWMutex
	signals map[int]*ChannelHealthSignal // key: channelID
}

// NewSignalBuffer 创建新的信号缓冲区
func NewSignalBuffer() *SignalBuffer {
	return &SignalBuffer{
		signals: make(map[int]*ChannelHealthSignal),
	}
}

// globalBuffer 全局信号缓冲区
var globalBuffer = NewSignalBuffer()

// Record 记录通道健康信号
func (b *SignalBuffer) Record(channelID int, statusCode int, errorText string, kind FailureKind) {
	b.mu.Lock()
	defer b.mu.Unlock()

	existing, ok := b.signals[channelID]
	now := time.Now()

	if ok && existing.FailureKind == kind && existing.StatusCode == statusCode {
		// 同类型连续失败，递增计数
		existing.Count++
		existing.Timestamp = now
		existing.ErrorText = errorText
	} else {
		// 新类型信号，重置计数
		b.signals[channelID] = &ChannelHealthSignal{
			ChannelID:   channelID,
			StatusCode:  statusCode,
			ErrorText:   errorText,
			FailureKind: kind,
			Timestamp:   now,
			Count:       1,
		}
	}
}

// RecordSuccess 记录通道成功，清除失败信号
func (b *SignalBuffer) RecordSuccess(channelID int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.signals, channelID)
}

// GetChannelSignal 获取通道当前健康信号
func (b *SignalBuffer) GetChannelSignal(channelID int) *ChannelHealthSignal {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if sig, ok := b.signals[channelID]; ok {
		copy := *sig
		return &copy
	}
	return nil
}

// GetAllSignals 获取所有通道的健康信号
func (b *SignalBuffer) GetAllSignals() map[int]*ChannelHealthSignal {
	b.mu.RLock()
	defer b.mu.RUnlock()
	result := make(map[int]*ChannelHealthSignal, len(b.signals))
	for k, v := range b.signals {
		copy := *v
		result[k] = &copy
	}
	return result
}

// Record 记录到全局缓冲区
func Record(channelID int, statusCode int, errorText string, kind FailureKind) {
	globalBuffer.Record(channelID, statusCode, errorText, kind)
}

// RecordSuccess 记录成功到全局缓冲区
func RecordSuccess(channelID int) {
	globalBuffer.RecordSuccess(channelID)
}

// GetChannelSignal 从全局缓冲区获取通道信号
func GetChannelSignal(channelID int) *ChannelHealthSignal {
	return globalBuffer.GetChannelSignal(channelID)
}

// GetAllSignals 从全局缓冲区获取所有信号
func GetAllSignals() map[int]*ChannelHealthSignal {
	return globalBuffer.GetAllSignals()
}
