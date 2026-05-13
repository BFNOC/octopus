package op

import (
	"context"
	"fmt"
	"time"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
)

// GroupSnapshotSave 创建或更新分组路由决策快照
func GroupSnapshotSave(snap *model.GroupDecisionSnapshot, ctx context.Context) error {
	snap.RefreshedAt = time.Now()
	existing := model.GroupDecisionSnapshot{}
	err := db.GetDB().WithContext(ctx).
		Where("group_id = ? AND request_model = ? AND api_key_id = ?", snap.GroupID, snap.RequestModel, snap.APIKeyID).
		First(&existing).Error
	if err != nil {
		// 不存在则创建
		return db.GetDB().WithContext(ctx).Create(snap).Error
	}
	// 存在则更新
	return db.GetDB().WithContext(ctx).Model(&existing).Updates(map[string]interface{}{
		"snapshot":     snap.Snapshot,
		"refreshed_at": snap.RefreshedAt,
	}).Error
}

// GroupSnapshotGet 获取分组路由决策快照
func GroupSnapshotGet(groupID int, requestModel string, apiKeyID int, ctx context.Context) (*model.GroupDecisionSnapshot, error) {
	var snap model.GroupDecisionSnapshot
	err := db.GetDB().WithContext(ctx).
		Where("group_id = ? AND request_model = ? AND api_key_id = ?", groupID, requestModel, apiKeyID).
		First(&snap).Error
	if err != nil {
		return nil, fmt.Errorf("snapshot not found")
	}
	return &snap, nil
}

// GroupSnapshotList 获取分组下所有快照
func GroupSnapshotList(groupID int, ctx context.Context) ([]model.GroupDecisionSnapshot, error) {
	var snaps []model.GroupDecisionSnapshot
	if err := db.GetDB().WithContext(ctx).
		Where("group_id = ?", groupID).
		Order("refreshed_at DESC").
		Find(&snaps).Error; err != nil {
		return nil, err
	}
	return snaps, nil
}

// GroupSnapshotClear 清除指定分组的快照
func GroupSnapshotClear(groupID int, ctx context.Context) error {
	return db.GetDB().WithContext(ctx).
		Where("group_id = ?", groupID).
		Delete(&model.GroupDecisionSnapshot{}).Error
}

// GroupSnapshotClearAll 清除所有快照
func GroupSnapshotClearAll(ctx context.Context) error {
	return db.GetDB().WithContext(ctx).
		Where("1 = 1").
		Delete(&model.GroupDecisionSnapshot{}).Error
}
