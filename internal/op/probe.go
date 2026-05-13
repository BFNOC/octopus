package op

import (
	"context"
	"time"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/utils/log"
)

// ProbeResultList 查询指定 Channel 的探测结果
func ProbeResultList(channelID int, ctx context.Context) ([]model.ModelProbeResult, error) {
	var results []model.ModelProbeResult
	if err := db.GetDB().WithContext(ctx).
		Where("channel_id = ?", channelID).
		Order("probed_at DESC").
		Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// ProbeResultListAll 查询所有探测结果
func ProbeResultListAll(ctx context.Context) ([]model.ModelProbeResult, error) {
	var results []model.ModelProbeResult
	if err := db.GetDB().WithContext(ctx).
		Order("probed_at DESC").
		Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// ProbeResultBatchInsert 批量插入探测结果
func ProbeResultBatchInsert(ctx context.Context, results []model.ModelProbeResult) error {
	if len(results) == 0 {
		return nil
	}
	now := time.Now()
	for i := range results {
		results[i].ProbedAt = now
	}
	if err := db.GetDB().WithContext(ctx).CreateInBatches(results, 100).Error; err != nil {
		log.Warnf("failed to batch insert probe results: %v", err)
		return err
	}
	return nil
}

// ProbeResultDeleteByChannel 删除指定 Channel 的探测结果
func ProbeResultDeleteByChannel(channelID int, ctx context.Context) error {
	if err := db.GetDB().WithContext(ctx).
		Where("channel_id = ?", channelID).
		Delete(&model.ModelProbeResult{}).Error; err != nil {
		return err
	}
	return nil
}

// ProbeResultDeleteAll 删除所有探测结果
func ProbeResultDeleteAll(ctx context.Context) error {
	if err := db.GetDB().WithContext(ctx).
		Where("1 = 1").
		Delete(&model.ModelProbeResult{}).Error; err != nil {
		return err
	}
	return nil
}

// ProbeResultGetLatest 获取指定 Channel 的最新探测结果
func ProbeResultGetLatest(channelID int, ctx context.Context) ([]model.ModelProbeResult, error) {
	var results []model.ModelProbeResult
	if err := db.GetDB().WithContext(ctx).
		Where("channel_id = ?", channelID).
		Order("probed_at DESC").
		Limit(100).
		Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}
