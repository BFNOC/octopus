import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Activity,
    Check,
    ChevronDown,
    ChevronUp,
    Loader2,
    Search,
    Square,
    XCircle,
    AlertTriangle,
    Ban,
} from 'lucide-react';
import { useProbeChannelSSE, type ProbeResult } from '@/api/endpoints/channel';
import type { Channel } from '@/api/endpoints/channel';
import { apiClient } from '@/api/client';
import { resolveProbePrompt, pickRandomProbePrompt } from './probePrompts';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type SortMode = 'latency' | 'name' | 'status';
type RowStatus = 'pending' | 'probing' | 'supported' | 'unsupported' | 'inconclusive' | 'skipped';

type ModelRow = {
    name: string;
    status: RowStatus;
    ttftMs: number;
    httpStatus: number;
    error: string;
    responseText: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const splitModels = (models: string) =>
    models.split(',').map((s) => s.trim()).filter(Boolean);

function latencyColor(ms: number): string {
    if (ms < 1500) return 'bg-emerald-500';
    if (ms < 3000) return 'bg-lime-500';
    if (ms < 5000) return 'bg-yellow-500';
    if (ms < 10000) return 'bg-orange-500';
    return 'bg-red-500';
}

function latencyTextColor(ms: number): string {
    if (ms < 1500) return 'text-emerald-600 dark:text-emerald-400';
    if (ms < 3000) return 'text-lime-600 dark:text-lime-400';
    if (ms < 5000) return 'text-yellow-600 dark:text-yellow-400';
    if (ms < 10000) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
}

function statusIcon(status: RowStatus) {
    switch (status) {
        case 'supported':
            return <Check className="size-3.5 text-emerald-500" />;
        case 'unsupported':
            return <XCircle className="size-3.5 text-red-500" />;
        case 'inconclusive':
            return <AlertTriangle className="size-3.5 text-amber-500" />;
        case 'skipped':
            return <Ban className="size-3.5 text-muted-foreground" />;
        case 'probing':
            return <Loader2 className="size-3.5 text-primary animate-spin" />;
        default:
            return <div className="size-3.5 rounded-full border-2 border-muted-foreground/30" />;
    }
}

function sortRows(rows: ModelRow[], mode: SortMode): ModelRow[] {
    const statusOrder: Record<string, number> = {
        supported: 0, unsupported: 1, inconclusive: 2, skipped: 3, probing: 4, pending: 5,
    };
    const copy = [...rows];
    copy.sort((a, b) => {
        const aActive = a.status === 'pending' || a.status === 'probing';
        const bActive = b.status === 'pending' || b.status === 'probing';
        if (aActive !== bActive) return aActive ? 1 : -1;
        if (aActive && bActive) return 0;
        switch (mode) {
            case 'latency':
                return a.ttftMs - b.ttftMs;
            case 'name':
                return a.name.localeCompare(b.name);
            case 'status':
                return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
            default:
                return 0;
        }
    });
    return copy;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className={cn('rounded-lg border px-3 py-2 text-center', color)}>
            <div className="text-lg font-bold tabular-nums">{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
    );
}

function LatencyBar({ ttftMs, maxLatency, status }: { ttftMs: number; maxLatency: number; status: RowStatus }) {
    const width = maxLatency > 0 ? Math.min((ttftMs / maxLatency) * 100, 100) : 0;
    const isProbing = status === 'probing';
    const isPending = status === 'pending';

    return (
        <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden">
            {isProbing ? (
                <div className="h-full w-full bg-primary/20 animate-pulse" />
            ) : isPending ? null : (
                <div
                    className={cn('h-full rounded-full transition-all duration-500', latencyColor(ttftMs))}
                    style={{ width: `${width}%` }}
                />
            )}
        </div>
    );
}

function ModelResultRow({
    row,
    maxLatency,
    expanded,
    onToggle,
}: {
    row: ModelRow;
    maxLatency: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    const isActive = row.status === 'pending' || row.status === 'probing';
    return (
        <div
            className={cn(
                'rounded-lg border transition-colors',
                isActive ? 'border-border/40 bg-background/30' : 'border-border/60 bg-background/50',
                !isActive && 'cursor-pointer hover:bg-accent/30'
            )}
            onClick={!isActive ? onToggle : undefined}
        >
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="shrink-0">{statusIcon(row.status)}</div>
                <span className="truncate text-sm font-mono min-w-0 flex-1" title={row.name}>
                    {row.name}
                </span>
                <div className="w-24 shrink-0">
                    <LatencyBar ttftMs={row.ttftMs} maxLatency={maxLatency} status={row.status} />
                </div>
                <span className={cn('text-xs font-mono tabular-nums w-16 text-right shrink-0', latencyTextColor(row.ttftMs))}>
                    {row.status === 'probing' ? '...' : row.status === 'pending' ? '--' : `${row.ttftMs}ms`}
                </span>
                {!isActive && (
                    <div className="shrink-0 text-muted-foreground">
                        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </div>
                )}
            </div>
            {expanded && !isActive && (
                <div className="border-t border-border/40 px-3 py-2 text-xs space-y-1">
                    <div className="flex gap-3 text-muted-foreground">
                        <span>HTTP {row.httpStatus}</span>
                        <span className={cn(
                            row.status === 'supported' ? 'text-emerald-500' :
                            row.status === 'unsupported' ? 'text-red-500' :
                            row.status === 'inconclusive' ? 'text-amber-500' : 'text-muted-foreground'
                        )}>
                            {row.status}
                        </span>
                        {row.ttftMs > 0 && <span>{row.ttftMs}ms</span>}
                    </div>
                    {(row.responseText || row.error) && (
                        <pre className="max-h-28 overflow-y-auto rounded bg-muted/30 p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                            {row.responseText || row.error}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

type ProbeModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    channel?: Channel;
    channelIds?: number[];
    title?: string;
};

export function ProbeModal({ open, onOpenChange, channel, channelIds, title }: ProbeModalProps) {
    // 多 channel 模式：直接 fetch channel 列表
    const [fetchedChannels, setFetchedChannels] = useState<Channel[]>([]);
    useEffect(() => {
        if (!open || channel || !channelIds || channelIds.length === 0) return;
        let cancelled = false;
        apiClient.get<Channel[]>('/api/v1/channel/list').then((data) => {
            if (cancelled) return;
            setFetchedChannels(data.filter((c) => channelIds.includes(c.id)));
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [open, channel, channelIds]);

    const resolvedChannels = useMemo(() => {
        if (channel) return [channel];
        if (channelIds && fetchedChannels.length > 0) {
            return fetchedChannels.filter((c) => channelIds.includes(c.id));
        }
        return [];
    }, [channel, channelIds, fetchedChannels]);

    const allModels = useMemo(() => {
        const set = new Set<string>();
        for (const ch of resolvedChannels) {
            for (const m of splitModels(ch.model)) set.add(m);
            for (const m of splitModels(ch.custom_model)) set.add(m);
        }
        return Array.from(set).sort();
    }, [resolvedChannels]);

    // Settings state
    const [prompt, setPrompt] = useState('');
    const placeholderPrompt = useMemo(() => (open ? pickRandomProbePrompt() : ''), [open]);
    const [concurrency, setConcurrency] = useState(3);
    const [timeoutMs, setTimeoutMs] = useState(30000);
    const [delayMs, setDelayMs] = useState(2000);
    const [showSettings, setShowSettings] = useState(true);

    // Model selection
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
    const [modelSearch, setModelSearch] = useState('');
    const [manualModels, setManualModels] = useState('');

    // Results state
    const [modelRows, setModelRows] = useState<ModelRow[]>([]);
    const [sortMode, setSortMode] = useState<SortMode>('latency');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [isMultiProbing, setIsMultiProbing] = useState(false);
    const multiAbortRef = useRef<AbortController | null>(null);

    const { probe, results, isProbing: isSSEProbing, error, abort, reset } = useProbeChannelSSE();
    const isProbing = isSSEProbing || isMultiProbing;
    const resultsRef = useRef(results);
    resultsRef.current = results;

    const getMergedModels = useCallback(() => {
        const manual = manualModels.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        const all = new Set([...selectedModels, ...manual]);
        return Array.from(all).sort();
    }, [selectedModels, manualModels]);

    // Open: reset / Close: abort
    useEffect(() => {
        if (open) {
            setSelectedModels(new Set(allModels));
            setPrompt('');
            setConcurrency(3);
            setTimeoutMs(30000);
            setDelayMs(2000);
            setShowSettings(true);
            setModelSearch('');
            setManualModels('');
            setModelRows([]);
            setSortMode('latency');
            setExpandedRow(null);
            reset();
        } else {
            multiAbortRef.current?.abort();
        }
    }, [open, allModels, reset]);

    // Build model rows when probing starts
    useEffect(() => {
        if (!isProbing) return;
        setModelRows((prev) => {
            if (prev.length > 0) return prev;
            const names = getMergedModels();
            return names.map((name) => ({
                name,
                status: 'pending' as RowStatus,
                ttftMs: 0,
                httpStatus: 0,
                error: '',
                responseText: '',
            }));
        });
    }, [isProbing, getMergedModels]);

    // Update rows as results stream in
    useEffect(() => {
        if (results.length === 0) return;
        setModelRows((prev) => {
            const next = [...prev];
            for (const r of results) {
                const idx = next.findIndex((row) => row.name === r.model_name);
                if (idx >= 0) {
                    next[idx] = {
                        ...next[idx],
                        status: r.status as RowStatus,
                        ttftMs: r.ttft_ms,
                        httpStatus: r.http_status,
                        error: r.error || '',
                        responseText: r.response_text || '',
                    };
                }
            }
            return next;
        });
    }, [results]);

    // Mark remaining as inconclusive when probing ends
    useEffect(() => {
        if (isProbing) return;
        setModelRows((prev) => {
            if (prev.length === 0) return prev;
            let changed = false;
            const next = prev.map((row) => {
                if (row.status === 'pending' || row.status === 'probing') {
                    changed = true;
                    return { ...row, status: 'inconclusive' as RowStatus, error: 'Stream ended unexpectedly' };
                }
                return row;
            });
            return changed ? next : prev;
        });
    }, [isProbing]);

    const filteredModels = useMemo(() => {
        if (!modelSearch) return allModels;
        const q = modelSearch.toLowerCase();
        return allModels.filter((m) => m.toLowerCase().includes(q));
    }, [allModels, modelSearch]);

    const toggleModel = (name: string) => {
        setSelectedModels((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedModels((prev) => {
            const allSelected = filteredModels.every((m) => prev.has(m));
            if (allSelected) {
                const next = new Set(prev);
                for (const m of filteredModels) next.delete(m);
                return next;
            }
            const next = new Set(prev);
            for (const m of filteredModels) next.add(m);
            return next;
        });
    };

    const handleStart = async () => {
        const names = getMergedModels();
        if (names.length === 0) return;
        setModelRows([]);
        setExpandedRow(null);

        // 单 channel 模式或 channel 数据未加载：使用 SSE hook
        if (resolvedChannels.length <= 1) {
            const chId = resolvedChannels[0]?.id || channelIds?.[0];
            if (!chId) return;
            probe(chId, {
                model_names: names,
                prompt: resolveProbePrompt(prompt),
                timeout: Math.round(timeoutMs / 1000),
                concurrency,
                delay_ms: delayMs,
            });
            return;
        }

        // 多 channel 模式：按 channel 分组模型，逐个探测
        // 每个模型可能存在于多个 channel，按 channel 分组确保全部覆盖
        const grouped = new Map<number, string[]>();
        for (const name of names) {
            for (const ch of resolvedChannels) {
                const chModels = new Set([...splitModels(ch.model), ...splitModels(ch.custom_model)]);
                if (chModels.has(name)) {
                    if (!grouped.has(ch.id)) grouped.set(ch.id, []);
                    grouped.get(ch.id)!.push(name);
                }
            }
        }

        // 初始化所有行为 pending
        setModelRows(names.map((n) => ({
            name: n,
            status: 'pending' as RowStatus,
            ttftMs: 0, httpStatus: 0, error: '', responseText: '',
        })));

        const controller = new AbortController();
        multiAbortRef.current = controller;
        setIsMultiProbing(true);
        try {
            const token = (() => {
                try {
                    const raw = localStorage.getItem('auth-storage');
                    return raw ? JSON.parse(raw)?.state?.token : null;
                } catch { return null; }
            })();
            for (const [chId, modelNames] of grouped) {
              if (controller.signal.aborted) break;
              const resp = await fetch(`/api/v1/channel/${chId}/probe`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'text/event-stream',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                      model_names: modelNames,
                      prompt: resolveProbePrompt(prompt),
                      timeout: Math.round(timeoutMs / 1000),
                      concurrency,
                      delay_ms: delayMs,
                  }),
                  signal: controller.signal,
              });
              if (!resp.ok) continue;
              const reader = resp.body?.getReader();
              if (!reader) continue;
              const decoder = new TextDecoder();
              let buffer = '';
              while (true) {
                  if (controller.signal.aborted) break;
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';
                  for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed.startsWith('data: ')) continue;
                      const data = trimmed.slice(6);
                      if (data === '[DONE]') continue;
                      try {
                          const r = JSON.parse(data) as ProbeResult;
                          setModelRows((prev) =>
                              prev.map((row) =>
                                  row.name === r.model_name
                                      ? { ...row, status: r.status as RowStatus, ttftMs: r.ttft_ms, httpStatus: r.http_status, error: r.error || '', responseText: r.response_text || '' }
                                      : row
                              )
                          );
                      } catch { /* skip */ }
                  }
              }
            }
        } finally {
            setIsMultiProbing(false);
            multiAbortRef.current = null;
        }
    };

    const handleStop = () => {
        abort(); // 单 channel SSE hook
        multiAbortRef.current?.abort(); // 多 channel fetch
    };

    const sortedRows = sortRows(modelRows, sortMode);
    const maxLatency = Math.max(...modelRows.filter((r) => r.ttftMs > 0).map((r) => r.ttftMs), 1);

    const supported = modelRows.filter((r) => r.status === 'supported').length;
    const unsupported = modelRows.filter((r) => r.status === 'unsupported').length;
    const inconclusive = modelRows.filter((r) => r.status === 'inconclusive').length;
    const skipped = modelRows.filter((r) => r.status === 'skipped').length;
    const ttftValues = modelRows.filter((r) => r.ttftMs > 0).map((r) => r.ttftMs);
    const avgTtft = ttftValues.length > 0 ? Math.round(ttftValues.reduce((a, b) => a + b, 0) / ttftValues.length) : 0;
    const minTtft = ttftValues.length > 0 ? Math.min(...ttftValues) : 0;
    const maxTtft = ttftValues.length > 0 ? Math.max(...ttftValues) : 0;
    const hasResults = modelRows.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {title || (channel ? `探活 — ${channel.name}` : `探活 — ${resolvedChannels.length} 个渠道`)}
                    </DialogTitle>
                </DialogHeader>

                {/* Action bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    {isProbing ? (
                        <Button size="sm" variant="destructive" onClick={handleStop}>
                            <Square className="size-3.5" />
                            停止 ({results.length}/{modelRows.length})
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleStart} disabled={getMergedModels().length === 0}>
                            <Activity className="size-3.5" />
                            {hasResults ? '重新探测' : '开始探测'}
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)}>
                        {showSettings ? '收起设置' : '展开设置'}
                    </Button>
                    {hasResults && (
                        <div className="flex items-center gap-1 ml-auto">
                            {(['latency', 'name', 'status'] as SortMode[]).map((m) => (
                                <Button
                                    key={m}
                                    size="sm"
                                    variant={sortMode === m ? 'default' : 'ghost'}
                                    className="h-7 px-2 text-xs"
                                    onClick={() => setSortMode(m)}
                                >
                                    {{ latency: '延迟', name: '名称', status: '状态' }[m]}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Settings panel */}
                {showSettings && (
                    <div className="space-y-3 rounded-lg border border-border/50 p-3">
                        {/* Param grid */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">提示词</label>
                                <Input
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={placeholderPrompt}
                                    disabled={isProbing}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">并发数 (1-10)</label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={concurrency}
                                    onChange={(e) => setConcurrency(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                                    disabled={isProbing}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">超时 ms (1000-60000)</label>
                                <Input
                                    type="number"
                                    min={1000}
                                    max={60000}
                                    step={1000}
                                    value={timeoutMs}
                                    onChange={(e) => setTimeoutMs(Math.min(60000, Math.max(1000, Number(e.target.value) || 30000)))}
                                    disabled={isProbing}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">批次间隔 ms (0-10000)</label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={10000}
                                    step={100}
                                    value={delayMs}
                                    onChange={(e) => setDelayMs(Math.min(10000, Math.max(0, Number(e.target.value) || 0)))}
                                    disabled={isProbing}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>

                        {/* Model selection */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground">
                                    已选 {selectedModels.size} / {allModels.length} 个模型
                                </span>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={toggleAll} disabled={isProbing}>
                                    {filteredModels.every((m) => selectedModels.has(m)) ? '取消全选' : '全选'}
                                </Button>
                            </div>
                            <div className="relative mb-1.5">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                <Input
                                    value={modelSearch}
                                    onChange={(e) => setModelSearch(e.target.value)}
                                    placeholder={`搜索模型... (共 ${allModels.length} 个)`}
                                    className="h-7 text-xs pl-7"
                                    disabled={isProbing}
                                />
                            </div>
                            <div className="max-h-[180px] overflow-y-auto space-y-0.5 rounded border p-1.5">
                                {filteredModels.length === 0 && (
                                    <div className="text-xs text-muted-foreground text-center py-2">无匹配模型</div>
                                )}
                                {filteredModels.map((name) => (
                                    <label
                                        key={name}
                                        className={cn(
                                            'flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 text-sm hover:bg-accent/50',
                                            selectedModels.has(name) && 'bg-accent/30'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedModels.has(name)}
                                            onChange={() => toggleModel(name)}
                                            disabled={isProbing}
                                            className="size-3.5 rounded border-input"
                                        />
                                        <span className="font-mono text-xs truncate">{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Manual model input */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">手动添加模型（逗号或换行分隔）</label>
                            <textarea
                                value={manualModels}
                                onChange={(e) => setManualModels(e.target.value)}
                                placeholder="model-a, model-b"
                                disabled={isProbing}
                                rows={2}
                                className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs font-mono resize-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                            />
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
                )}

                {/* Stat cards */}
                {hasResults && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        <StatCard label="支持" value={supported} color="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" />
                        <StatCard label="不支持" value={unsupported} color="border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400" />
                        <StatCard label="不确定" value={inconclusive} color="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400" />
                        <StatCard label="跳过" value={skipped} color="border-muted bg-muted/30 text-muted-foreground" />
                        {ttftValues.length > 0 && (
                            <>
                                <StatCard label="平均 TTFT" value={`${avgTtft}ms`} color="border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-400" />
                                <StatCard label="最快" value={`${minTtft}ms`} color="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" />
                                <StatCard label="最慢" value={`${maxTtft}ms`} color="border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-400" />
                            </>
                        )}
                    </div>
                )}

                {/* Results list */}
                <div className="flex-1 min-h-0 overflow-y-auto max-h-[420px] space-y-1">
                    {sortedRows.map((row) => (
                        <ModelResultRow
                            key={row.name}
                            row={row}
                            maxLatency={maxLatency}
                            expanded={expandedRow === row.name}
                            onToggle={() => setExpandedRow(expandedRow === row.name ? null : row.name)}
                        />
                    ))}
                </div>

                {!hasResults && !isProbing && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        {'选择模型后点击"开始探测"'}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
