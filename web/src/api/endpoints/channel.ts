import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { apiClient, API_BASE_URL } from '../client';
import { logger } from '@/lib/logger';
import { formatCount, formatMoney, formatTime } from '@/lib/utils';
import { StatsChannel, type StatsMetricsFormatted } from './stats';
import type { ProxyMode } from './proxy-pool';
/**
 * 渠道类型枚举
 */
export enum ChannelType {
    OpenAIChat = 0,
    OpenAIResponse = 1,
    Anthropic = 2,
    Gemini = 3,
    Volcengine = 4,
    OpenAIEmbedding = 5,
}

/**
 * 自动分组类型枚举
 */
export enum AutoGroupType {
    None = 0,   // 不自动分组
    Fuzzy = 1,  // 模糊匹配
    Exact = 2,  // 准确匹配
    Regex = 3,  // 正则匹配
}

export type ChannelWSMode = 'inherit' | 'off' | 'passthrough' | 'transform';

export type BaseUrl = {
    url: string;
    delay: number;
};

export type CustomHeader = {
    header_key: string;
    header_value: string;
};

export type ChannelKey = {
    id: number;
    channel_id: number;
    enabled: boolean;
    channel_key: string;
    status_code: number;
    last_use_time_stamp: number;
    total_cost: number;
    remark: string;
};

export type ManagedChannelSource = {
    site_id: number;
    site_account_id: number;
    site_user_group_id?: number | null;
    group_key: string;
};

/**
 * 渠道完整数据（与后端 model.Channel 对齐；数组字段在前端保证为 []）
 */
export type Channel = {
    id: number;
    name: string;
    type: ChannelType;
    enabled: boolean;
    base_urls: BaseUrl[];
    keys: ChannelKey[];
    model: string;
    custom_model: string;
    proxy_mode: Exclude<ProxyMode, 'inherit'>;
    proxy_config_id?: number | null;
    auto_sync: boolean;
    auto_group: AutoGroupType;
    custom_header: CustomHeader[];
    ws_mode: ChannelWSMode;
    param_override?: string | null;
    match_regex?: string | null;
    model_filter_mode: string;
    managed: boolean;
    managed_source?: ManagedChannelSource | null;
    stats: StatsChannel;
};

// Internal type: backend may return null for slice fields; normalize to [] in select()
type ChannelServer = Omit<Channel, 'base_urls' | 'custom_header' | 'keys'> & {
    base_urls: BaseUrl[] | null;
    custom_header: CustomHeader[] | null;
    keys: ChannelKey[] | null;
    model_filter_mode?: string;
};

/**
 * 创建渠道请求：必填字段 + 可选字段
 */
export type CreateChannelRequest = {
    name: string;
    type: ChannelType;
    enabled?: boolean;
    base_urls: BaseUrl[];
    keys: Array<Pick<ChannelKey, 'enabled' | 'channel_key' | 'remark'>>;
    model: string;
    custom_model?: string;
    proxy_mode?: Exclude<ProxyMode, 'inherit'>;
    proxy_config_id?: number | null;
    auto_sync?: boolean;
    auto_group?: AutoGroupType;
    custom_header?: CustomHeader[];
    ws_mode?: ChannelWSMode;
    param_override?: string | null;
    match_regex?: string | null;
};

/**
 * 更新渠道请求：id + 可选字段 + keys diff
 */
export type UpdateChannelRequest = {
    id: number;
    name?: string;
    type?: ChannelType;
    enabled?: boolean;
    base_urls?: BaseUrl[];
    model?: string;
    custom_model?: string;
    proxy_mode?: Exclude<ProxyMode, 'inherit'>;
    proxy_config_id?: number | null;
    auto_sync?: boolean;
    auto_group?: AutoGroupType;
    custom_header?: CustomHeader[];
    ws_mode?: ChannelWSMode;
    param_override?: string | null;
    match_regex?: string | null;
    model_filter_mode?: string;
    // keys diff
    keys_to_add?: Array<Pick<ChannelKey, 'enabled' | 'channel_key' | 'remark'>>;
    keys_to_update?: Array<{ id: number; enabled?: boolean; channel_key?: string; remark?: string }>;
    keys_to_delete?: number[];
};

export type FetchModelRequest = {
    type: ChannelType;
    base_urls: BaseUrl[];
    keys: Array<Pick<ChannelKey, 'enabled' | 'channel_key'>>;
    proxy_mode?: Exclude<ProxyMode, 'inherit'>;
    proxy_config_id?: number | null;
    match_regex?: string | null;
    custom_header?: CustomHeader[];
};

/**
 * 获取渠道列表 Hook
 * 
 * @example
 * const { data: channels, isLoading, error } = useChannelList();
 * 
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 * 
 * channels?.forEach(channel => console.log(channel.raw.name));
 */
export function useChannelList() {
    return useQuery({
        queryKey: ['channels', 'list'],
        queryFn: async () => {
            return apiClient.get<ChannelServer[]>('/api/v1/channel/list');
        },
        select: (data) => data.map((item) => ({
            raw: ({
                ...item,
                managed: item.managed ?? false,
                managed_source: item.managed_source ?? null,
                base_urls: item.base_urls ?? [],
                custom_header: item.custom_header ?? [],
                ws_mode: item.ws_mode ?? 'inherit',
                keys: item.keys ?? [],
                proxy_mode: item.proxy_mode ?? 'direct',
                proxy_config_id: item.proxy_config_id ?? null,
            }) satisfies Channel,
            formatted: {
                input_token: formatCount(item.stats.input_token),
                output_token: formatCount(item.stats.output_token),
                total_token: formatCount(item.stats.input_token + item.stats.output_token),
                input_cost: formatMoney(item.stats.input_cost),
                output_cost: formatMoney(item.stats.output_cost),
                total_cost: formatMoney(item.stats.input_cost + item.stats.output_cost),
                request_success: formatCount(item.stats.request_success),
                request_failed: formatCount(item.stats.request_failed),
                request_count: formatCount(item.stats.request_success + item.stats.request_failed),
                wait_time: formatTime(item.stats.wait_time),
            }
        })) as Array<{ raw: Channel; formatted: StatsMetricsFormatted }>,
        refetchInterval: 30000,
    });
}

/**
 * 创建渠道 Hook
 * 
 * @example
 * const createChannel = useCreateChannel();
 * 
 * createChannel.mutate({
 *   name: 'OpenAI',
 *   type: ChannelType.OpenAIChat,
 *   base_urls: [{ url: 'https://api.openai.com', delay: 0 }],
 *   keys: [{ enabled: true, channel_key: 'sk-xxx' }],
 *   model: 'gpt-4',
 * });
 */
export function useCreateChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateChannelRequest) => {
            return apiClient.post<ChannelServer>('/api/v1/channel/create', data);
        },
        onSuccess: (data) => {
            logger.log('渠道创建成功:', data);
            queryClient.invalidateQueries({ queryKey: ['channels', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['models', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['models', 'channel'] });
            queryClient.invalidateQueries({ queryKey: ['proxy-pool'] });
        },
        onError: (error) => {
            logger.error('渠道创建失败:', error);
        },
    });
}

/**
 * 更新渠道 Hook
 * 
 * @example
 * const updateChannel = useUpdateChannel();
 * 
 * updateChannel.mutate({
 *   id: 1,
 *   name: 'OpenAI Updated',
 *   type: ChannelType.OpenAIChat,
 *   enabled: true,
 *   base_urls: [{ url: 'https://api.openai.com', delay: 0 }],
 *   keys_to_add: [{ enabled: true, channel_key: 'sk-xxx' }],
 *   model: 'gpt-4-turbo',
 *   proxy: false,
 * });
 */
export function useUpdateChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateChannelRequest) => {
            return apiClient.post<ChannelServer>('/api/v1/channel/update', data);
        },
        onSuccess: (data) => {
            logger.log('渠道更新成功:', data);
            queryClient.invalidateQueries({ queryKey: ['channels', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['models', 'channel'] });
            queryClient.invalidateQueries({ queryKey: ['proxy-pool'] });
        },
        onError: (error) => {
            logger.error('渠道更新失败:', error);
        },
    });
}

/**
 * 删除渠道 Hook
 * 
 * @example
 * const deleteChannel = useDeleteChannel();
 * 
 * deleteChannel.mutate(1); // 删除 ID 为 1 的渠道
 */
export function useDeleteChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            return apiClient.delete<null>(`/api/v1/channel/delete/${id}`);
        },
        onSuccess: () => {
            logger.log('渠道删除成功');
            queryClient.invalidateQueries({ queryKey: ['channels', 'list'] });
            queryClient.invalidateQueries({ queryKey: ['models', 'channel'] });
            queryClient.invalidateQueries({ queryKey: ['proxy-pool'] });
        },
        onError: (error) => {
            logger.error('渠道删除失败:', error);
        },
    });
}

/**
 * 启用/禁用渠道 Hook
 * 
 * @example
 * const enableChannel = useEnableChannel();
 * 
 * enableChannel.mutate({ id: 1, enabled: true }); // 启用 ID 为 1 的渠道
 * enableChannel.mutate({ id: 1, enabled: false }); // 禁用 ID 为 1 的渠道
 */
export function useEnableChannel() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { id: number; enabled: boolean }) => {
            return apiClient.post<null>('/api/v1/channel/enable', data);
        },
        onSuccess: () => {
            logger.log('渠道状态更新成功');
            queryClient.invalidateQueries({ queryKey: ['channels', 'list'] });
        },
        onError: (error) => {
            logger.error('渠道状态更新失败:', error);
        },
    });
}

/**
 * 获取渠道模型列表 Hook
 * 
 * @example
 * const fetchModel = useFetchModel();
 * 
 * fetchModel.mutate({
 *   type: ChannelType.OpenAIChat,
 *   base_urls: [{ url: 'https://api.openai.com', delay: 0 }],
 *   keys: [{ enabled: true, channel_key: 'sk-xxx' }],
 *   proxy: false,
 * });
 * 
 * // 在 onSuccess 中获取模型列表
 * fetchModel.data // ['gpt-4', 'gpt-3.5-turbo', ...]
 */
export function useFetchModel() {
    return useMutation({
        mutationFn: async (data: FetchModelRequest) => {
            return apiClient.post<string[]>('/api/v1/channel/fetch-model', data);
        },
        onSuccess: (data) => {
            logger.log('模型列表获取成功:', data);
        },
        onError: (error) => {
            logger.error('模型列表获取失败:', error);
        },
    });
}

/**
 * 获取渠道最后同步时间 Hook
 * 
 * @example
 * const lastSyncTime = useLastSyncTime();
 * 
 * if (lastSyncTime) {
 *   console.log('最后同步时间:', new Date(lastSyncTime).toLocaleString());
 * }
 */
export function useLastSyncTime() {
    return useQuery({
        queryKey: ['channels', 'last-sync-time'],
        queryFn: async () => {
            return apiClient.get<string>('/api/v1/channel/last-sync-time');
        },
        refetchInterval: 30000,
    });
}
/**
 * 同步渠道 Hook
 * 
 * @example
 * const syncChannel = useSyncChannel();
 * 
 * syncChannel.mutate();
 */
export function useSyncChannel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            return apiClient.post<null>('/api/v1/channel/sync');
        },
        onSuccess: () => {
            logger.log('渠道同步成功');
            queryClient.invalidateQueries({ queryKey: ['channels', 'last-sync-time'] });
        },
        onError: (error) => {
            logger.error('渠道同步失败:', error);
        },
    });
}

// ─── Channel Filter (disabled / allowed models) ────────────────────────────

export type FilteredModel = {
    id: number;
    channel_id: number;
    model_name: string;
};

export type BatchFilterResult = {
    channel_id: number;
    model_filter_mode: string;
    disabled_models: FilteredModel[];
    allowed_models: FilteredModel[];
};

/**
 * 批量获取渠道过滤配置 Hook
 */
export function useBatchChannelFilter(channelIds: number[]) {
    return useQuery({
        queryKey: ['channels', 'batch-filter', channelIds],
        queryFn: async () => {
            return apiClient.post<BatchFilterResult[]>('/api/v1/channel/filter/batch', {
                channel_ids: channelIds,
            });
        },
        enabled: channelIds.length > 0,
    });
}

/**
 * 批量更新渠道过滤模型 Hook
 */
export function useBatchUpdateChannelFilter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { channel_id: number; action: 'add' | 'delete' | 'replace'; models: string[]; mode: string }) => {
            return apiClient.post<null>('/api/v1/channel/filter/batch-update', data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['channels', 'batch-filter'] });
            queryClient.invalidateQueries({ queryKey: ['channels', 'list'] });
        },
    });
}

/**
 * 获取渠道禁用模型列表 Hook
 */
export function useDisabledModels(channelId: number) {
    return useQuery({
        queryKey: ['channels', 'disabled-models', channelId],
        queryFn: async () => {
            return apiClient.get<FilteredModel[]>(`/api/v1/channel/filter/disabled/list/${channelId}`);
        },
        enabled: channelId > 0,
    });
}

/**
 * 添加渠道禁用模型 Hook
 */
export function useAddDisabledModel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { channel_id: number; model_name: string }) => {
            return apiClient.post<FilteredModel>('/api/v1/channel/filter/disabled/add', data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['channels', 'disabled-models', variables.channel_id] });
        },
    });
}

/**
 * 删除渠道禁用模型 Hook
 */
export function useDeleteDisabledModel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { channel_id: number; model_name: string }) => {
            return apiClient.post<null>('/api/v1/channel/filter/disabled/delete', data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['channels', 'disabled-models', variables.channel_id] });
        },
    });
}

/**
 * 获取渠道允许模型列表 Hook
 */
export function useAllowedModels(channelId: number) {
    return useQuery({
        queryKey: ['channels', 'allowed-models', channelId],
        queryFn: async () => {
            return apiClient.get<FilteredModel[]>(`/api/v1/channel/filter/allowed/list/${channelId}`);
        },
        enabled: channelId > 0,
    });
}

/**
 * 添加渠道允许模型 Hook
 */
export function useAddAllowedModel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { channel_id: number; model_name: string }) => {
            return apiClient.post<FilteredModel>('/api/v1/channel/filter/allowed/add', data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['channels', 'allowed-models', variables.channel_id] });
        },
    });
}

/**
 * 删除渠道允许模型 Hook
 */
export function useDeleteAllowedModel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { channel_id: number; model_name: string }) => {
            return apiClient.post<null>('/api/v1/channel/filter/allowed/delete', data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['channels', 'allowed-models', variables.channel_id] });
        },
    });
}

// ─── Channel Probe ─────────────────────────────────────────────────────────

export type ProbeResult = {
    model_name: string;
    status: string;
    ttft_ms: number;
    http_status: number;
    error?: string;
    response_text?: string;
};

/**
 * 探活渠道 Hook（普通 JSON 返回）
 */
export function useProbeChannel() {
    return useMutation({
        mutationFn: async (channelId: number) => {
            return apiClient.post<ProbeResult[]>(`/api/v1/channel/${channelId}/probe`);
        },
    });
}

export type ProbeRequest = {
    model_names?: string[];
    prompt?: string;
    timeout?: number;
    concurrency?: number;
    delay_ms?: number;
    headers?: Record<string, string>;
};

/**
 * SSE 流式探活 Hook
 *
 * 返回 { probe, results, isProbing, error, reset }
 * - probe(channelId, request) 启动探活
 * - results 随流式返回实时更新
 */
export function useProbeChannelSSE() {
    const [results, setResults] = useState<ProbeResult[]>([]);
    const [isProbing, setIsProbing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const probe = useCallback(async (channelId: number, req?: ProbeRequest) => {
        setIsProbing(true);
        setResults([]);
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const token = typeof window !== 'undefined'
                ? (() => {
                    try {
                        const raw = localStorage.getItem('auth-storage');
                        return raw ? JSON.parse(raw)?.state?.token : null;
                    } catch { return null; }
                })()
                : null;

            const resp = await fetch(`${API_BASE_URL}/api/v1/channel/${channelId}/probe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: req ? JSON.stringify(req) : undefined,
                signal: controller.signal,
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(text || `HTTP ${resp.status}`);
            }

            const reader = resp.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
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
                        const result = JSON.parse(data) as ProbeResult;
                        setResults(prev => [...prev, result]);
                    } catch {
                        // skip malformed lines
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsProbing(false);
            abortRef.current = null;
        }
    }, []);

    const abort = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const reset = useCallback(() => {
        setResults([]);
        setError(null);
    }, []);

    return { probe, results, isProbing, error, abort, reset };
}

// ─── Channel Health ────────────────────────────────────────────────────────

export type ChannelHealthSignal = {
    channel_id: number;
    status_code: number;
    error_text?: string;
    failure_kind: number;
    timestamp: string;
    count: number;
};

export type ChannelHealthView = {
    channel_id: number;
    channel_name: string;
    enabled: boolean;
    state: string;
    signal?: ChannelHealthSignal;
};

export type ChannelHealthSummary = {
    total: number;
    active: number;
    penalized: number;
    recovering: number;
    quarantined: number;
    channels: ChannelHealthView[];
};

/**
 * 获取渠道健康状态汇总 Hook
 */
export function useChannelHealth() {
    return useQuery({
        queryKey: ['channels', 'health'],
        queryFn: async () => {
            return apiClient.get<ChannelHealthSummary>('/api/v1/health/channels');
        },
        refetchInterval: 15000,
    });
}
