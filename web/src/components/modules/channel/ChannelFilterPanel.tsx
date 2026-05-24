'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';
import {
    useBatchChannelFilter,
    useUpdateChannel,
    useBatchUpdateChannelFilter,
    type BatchFilterResult,
} from '@/api/endpoints/channel';
import { useChannelList } from '@/api/endpoints/channel';
import { useQueryClient } from '@tanstack/react-query';

type FilterMode = 'none' | 'allow-list' | 'deny-list';

type ChannelFilterPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channelIds: number[];
    title?: string;
};

type AccountGroup = {
    accountId: number;
    accountName: string;
    channels: { id: number; name: string; filter: BatchFilterResult }[];
};

function ChannelFilterPanelImpl({
    open,
    onOpenChange,
    channelIds,
    title,
}: ChannelFilterPanelProps) {
    const queryClient = useQueryClient();
    const updateChannel = useUpdateChannel();
    const batchUpdateFilter = useBatchUpdateChannelFilter();

    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [newModelName, setNewModelName] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const { data: batchFilter } = useBatchChannelFilter(
        open ? channelIds : []
    );
    const { data: channels } = useChannelList();

    const channelMap = useMemo(() => {
        if (!channels) return new Map();
        return new Map(channels.map((ch) => [ch.raw.id, ch.raw]));
    }, [channels]);

    const filterDataMap = useMemo(() => {
        if (!batchFilter) return new Map<number, BatchFilterResult>();
        return new Map(batchFilter.map((f) => [f.channel_id, f]));
    }, [batchFilter]);

    const accountGroups = useMemo<AccountGroup[]>(() => {
        if (!batchFilter) return [];
        const groupMap = new Map<number, AccountGroup>();

        for (const filter of batchFilter) {
            const ch = channelMap.get(filter.channel_id);
            if (!ch) continue;
            const accountId = ch.managed_source?.site_account_id ?? 0;
            const accountName = ch.managed_source ? `账号 #${accountId}` : '独立渠道';
            if (!groupMap.has(accountId)) {
                groupMap.set(accountId, { accountId, accountName, channels: [] });
            }
            groupMap.get(accountId)!.channels.push({
                id: filter.channel_id,
                name: ch.name || `#${filter.channel_id}`,
                filter,
            });
        }
        return Array.from(groupMap.values());
    }, [batchFilter, channelMap]);

    const currentAccount = open
        ? (accountGroups.find((g) => g.accountId === selectedAccountId) ?? accountGroups[0])
        : undefined;
    const activeAccountId = currentAccount?.accountId ?? null;
    const activeChannelId = currentAccount?.channels.some((c) => c.id === selectedChannelId)
        ? selectedChannelId
        : currentAccount?.channels[0]?.id ?? null;

    useEffect(() => {
        if (open && activeChannelId && searchRef.current) {
            const timer = setTimeout(() => searchRef.current?.focus(), 120);
            return () => clearTimeout(timer);
        }
    }, [open, activeChannelId]);

    const selectedChannel = activeChannelId ? channelMap.get(activeChannelId) : null;

    const availableModels = useMemo(() => {
        if (!selectedChannel) return [];
        const modelStr = [selectedChannel.model, selectedChannel.custom_model].filter(Boolean).join(',');
        return [...new Set(modelStr.split(',').map((m) => m.trim()).filter(Boolean))].sort();
    }, [selectedChannel]);

    const selectedFilterData = activeChannelId ? filterDataMap.get(activeChannelId) : null;
    const currentMode: FilterMode = (selectedFilterData?.model_filter_mode as FilterMode) || 'none';

    const currentFilteredModels = useMemo(() => {
        if (!selectedFilterData) return new Set<string>();
        if (currentMode === 'allow-list') {
            return new Set((selectedFilterData.allowed_models ?? []).map((m) => m.model_name));
        }
        if (currentMode === 'deny-list') {
            return new Set((selectedFilterData.disabled_models ?? []).map((m) => m.model_name));
        }
        return new Set<string>();
    }, [selectedFilterData, currentMode]);

    const filteredModels = useMemo(() => {
        if (!search.trim()) return availableModels;
        const q = search.trim().toLowerCase();
        return availableModels.filter((m) => m.toLowerCase().includes(q));
    }, [availableModels, search]);

    const handleModeChange = useCallback(async (newMode: FilterMode) => {
        if (!activeChannelId) return;
        try {
            await updateChannel.mutateAsync({ id: activeChannelId, model_filter_mode: newMode });
            queryClient.invalidateQueries({ queryKey: ['channels', 'batch-filter'] });
            toast.success(
                newMode === 'none' ? '已关闭过滤' :
                newMode === 'allow-list' ? '已切换为白名单模式' :
                '已切换为黑名单模式'
            );
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : '更新失败');
        }
    }, [activeChannelId, updateChannel, queryClient]);

    const handleToggleModel = useCallback(async (modelName: string) => {
        if (!activeChannelId || currentMode === 'none') return;
        const isCurrentlyFiltered = currentFilteredModels.has(modelName);
        try {
            await batchUpdateFilter.mutateAsync({
                channel_id: activeChannelId,
                action: isCurrentlyFiltered ? 'delete' : 'add',
                models: [modelName],
                mode: currentMode,
            });
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : '操作失败');
        }
    }, [activeChannelId, currentMode, currentFilteredModels, batchUpdateFilter]);

    const handleAddCustomModel = useCallback(async () => {
        if (!activeChannelId || currentMode === 'none' || !newModelName.trim()) return;
        const name = newModelName.trim();
        try {
            await batchUpdateFilter.mutateAsync({
                channel_id: activeChannelId,
                action: 'add',
                models: [name],
                mode: currentMode,
            });
            setNewModelName('');
            toast.success(`已添加「${name}」`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : '添加失败');
        }
    }, [activeChannelId, currentMode, newModelName, batchUpdateFilter]);

    const handleSelectAll = useCallback(async () => {
        if (!activeChannelId || currentMode === 'none') return;
        const toAdd = filteredModels.filter((m) => !currentFilteredModels.has(m));
        if (toAdd.length === 0) return;
        try {
            await batchUpdateFilter.mutateAsync({
                channel_id: activeChannelId,
                action: 'add',
                models: toAdd,
                mode: currentMode,
            });
            toast.success(`已选择 ${toAdd.length} 个模型`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : '操作失败');
        }
    }, [activeChannelId, currentMode, filteredModels, currentFilteredModels, batchUpdateFilter]);

    const handleDeselectAll = useCallback(async () => {
        if (!activeChannelId || currentMode === 'none') return;
        const toRemove = filteredModels.filter((m) => currentFilteredModels.has(m));
        if (toRemove.length === 0) return;
        try {
            await batchUpdateFilter.mutateAsync({
                channel_id: activeChannelId,
                action: 'delete',
                models: toRemove,
                mode: currentMode,
            });
            toast.success(`已取消 ${toRemove.length} 个模型`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : '操作失败');
        }
    }, [activeChannelId, currentMode, filteredModels, currentFilteredModels, batchUpdateFilter]);

    const modeLabelWithDesc = (mode: FilterMode) => {
        switch (mode) {
            case 'none': return '不过滤（所有模型可用）';
            case 'allow-list': return '白名单（仅允许选中模型）';
            case 'deny-list': return '黑名单（禁用选中模型）';
        }
    };

    const getChannelFilterBadge = (ch: AccountGroup['channels'][0]) => {
        const mode = (ch.filter.model_filter_mode as FilterMode) || 'none';
        const count = mode === 'allow-list'
            ? (ch.filter.allowed_models ?? []).length
            : mode === 'deny-list'
            ? (ch.filter.disabled_models ?? []).length
            : 0;
        return { mode, count };
    };

    const modeBadge = currentMode === 'allow-list'
        ? `已选 ${currentFilteredModels.size} 个模型可用`
        : currentMode === 'deny-list'
        ? `已选 ${currentFilteredModels.size} 个模型被禁`
        : '';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl sm:max-w-7xl w-[95vw] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Filter className="h-5 w-5 text-muted-foreground" />
                        {title || '模型过滤'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-6 py-4 gap-3">
                    {/* Account Tabs */}
                    {accountGroups.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto shrink-0">
                            {accountGroups.map((group) => {
                                const isActive = activeAccountId === group.accountId;
                                return (
                                    <button
                                        key={group.accountId}
                                        type="button"
                                        className={cn(
                                            'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-transparent text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                                        )}
                                        onClick={() => {
                                            setSelectedAccountId(group.accountId);
                                            setSelectedChannelId(null);
                                            setSearch('');
                                        }}
                                    >
                                        {group.accountName}
                                        {group.channels.length > 1 && (
                                            <span className="ml-1 opacity-60">{group.channels.length}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Channel sub-tabs (only if account has multiple channels) */}
                    {currentAccount && currentAccount.channels.length > 1 && (
                        <div className="flex gap-1 overflow-x-auto shrink-0">
                            {currentAccount.channels.map((ch) => {
                                const isSelected = activeChannelId === ch.id;
                                const { mode } = getChannelFilterBadge(ch);
                                return (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        className={cn(
                                            'px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer',
                                            isSelected
                                                ? 'bg-muted font-medium text-foreground'
                                                : 'text-muted-foreground hover:bg-muted/50'
                                        )}
                                        onClick={() => {
                                            setSelectedChannelId(ch.id);
                                            setSearch('');
                                        }}
                                    >
                                        <span className="truncate max-w-[200px]">{ch.name}</span>
                                        {mode !== 'none' && (
                                            <span className={cn(
                                                'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                                                mode === 'allow-list' ? 'bg-green-500' : 'bg-red-500'
                                            )} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Filter Config */}
                    {activeChannelId ? (
                        <>
                            {/* Mode Selector — compact pill buttons like metapi */}
                            <div className="flex gap-1.5 flex-wrap shrink-0">
                                {(['none', 'deny-list', 'allow-list'] as FilterMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={cn(
                                            'px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                                            currentMode === mode
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-transparent text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                                        )}
                                        onClick={() => handleModeChange(mode)}
                                    >
                                        {modeLabelWithDesc(mode)}
                                    </button>
                                ))}
                            </div>

                            {currentMode !== 'none' && (
                                <>
                                    {/* Summary badge + toolbar — like metapi */}
                                    <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
                                        <span className="text-xs text-muted-foreground px-2.5 py-1 rounded bg-primary/5 border border-primary/15">
                                            {modeBadge} · 总计 {availableModels.length} 个模型
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                className="text-xs text-primary hover:underline cursor-pointer px-1 py-0.5"
                                                onClick={handleSelectAll}
                                            >
                                                全选{search.trim() ? '搜索结果' : ''}
                                            </button>
                                            <span className="text-muted-foreground text-xs">/</span>
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer px-1 py-0.5"
                                                onClick={handleDeselectAll}
                                            >
                                                取消{search.trim() ? '搜索结果' : '全选'}
                                            </button>
                                            {currentFilteredModels.size > 0 && (
                                                <>
                                                    <span className="text-muted-foreground text-xs">/</span>
                                                    <button
                                                        type="button"
                                                        className="text-xs text-destructive hover:underline cursor-pointer px-1 py-0.5"
                                                        onClick={async () => {
                                                            if (!activeChannelId) return;
                                                            const allModels = Array.from(currentFilteredModels);
                                                            if (allModels.length === 0) return;
                                                            try {
                                                                await batchUpdateFilter.mutateAsync({
                                                                    channel_id: activeChannelId,
                                                                    action: 'delete',
                                                                    models: allModels,
                                                                    mode: currentMode,
                                                                });
                                                                toast.success(`已清空 ${allModels.length} 个模型`);
                                                            } catch (err: unknown) {
                                                                toast.error(err instanceof Error ? err.message : '清空失败');
                                                            }
                                                        }}
                                                    >
                                                        清空所有
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search bar */}
                                    <div className="relative shrink-0">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            ref={searchRef}
                                            placeholder={`搜索模型名称... (共 ${availableModels.length} 个)`}
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="h-9 pl-8 text-xs"
                                        />
                                        {search && (
                                            <button
                                                type="button"
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                                onClick={() => setSearch('')}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Model List — bordered card like metapi */}
                                    <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-lg bg-card min-h-[120px]">
                                        {filteredModels.length === 0 ? (
                                            <div className="p-6 text-center text-muted-foreground text-xs">
                                                {search ? `没有匹配「${search}」的模型` : '该渠道暂无模型'}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {filteredModels.map((modelName, i) => {
                                                    const isChecked = currentFilteredModels.has(modelName);
                                                    return (
                                                        <label
                                                            key={modelName}
                                                            className={cn(
                                                                'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all duration-150',
                                                                i < filteredModels.length - 1 && 'border-b border-border',
                                                                isChecked
                                                                    ? currentMode === 'allow-list'
                                                                        ? 'bg-green-500/5 hover:bg-green-500/8'
                                                                        : 'bg-red-500/5 hover:bg-red-500/8'
                                                                    : 'hover:bg-primary/5'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleModel(modelName)}
                                                                className="h-3.5 w-3.5 rounded border-muted-foreground/30 flex-shrink-0"
                                                            />
                                                            <span className="font-mono text-xs flex-1 select-none break-all text-foreground">
                                                                {modelName}
                                                            </span>
                                                            {isChecked && (
                                                                <span className={cn(
                                                                    'text-[10px] px-1.5 py-0.5 rounded flex-shrink-0',
                                                                    currentMode === 'allow-list'
                                                                        ? 'bg-green-500/10 text-green-700'
                                                                        : 'bg-red-500/10 text-red-700'
                                                                )}>
                                                                    {currentMode === 'allow-list' ? '允许' : '禁用'}
                                                                </span>
                                                            )}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add custom model */}
                                    <div className="flex gap-2 shrink-0">
                                        <Input
                                            placeholder="手动输入模型名称..."
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAddCustomModel();
                                            }}
                                            className="h-9 text-xs"
                                        />
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="h-9 px-4 text-xs"
                                            onClick={handleAddCustomModel}
                                            disabled={!newModelName.trim()}
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                            添加
                                        </Button>
                                    </div>
                                </>
                            )}

                            {currentMode === 'none' && (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center px-4">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                            <Filter className="h-5 w-5" />
                                        </div>
                                        <p className="text-sm font-medium">不过滤模式</p>
                                        <p className="text-xs mt-1 text-muted-foreground/70">
                                            所有模型均可使用，选择黑名单或白名单以管理可用模型
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center px-4">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                    <Filter className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-medium">选择渠道</p>
                                <p className="text-xs mt-1 text-muted-foreground/70">
                                    在上方选择一个账号以配置过滤规则
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export const ChannelFilterPanel = memo(ChannelFilterPanelImpl);
