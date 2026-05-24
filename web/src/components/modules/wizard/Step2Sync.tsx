'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSyncSiteAccount, useSiteList, SiteCredentialType } from '@/api/endpoints/site';
import { useCreateSiteChannelKey, useSiteChannelList, type SiteChannelAccount, type SiteChannelCard, type SiteChannelModel } from '@/api/endpoints/site-channel';
import type { ApiError } from '@/api/types';
import { useWizardStore } from './store';

type SiteKeyIssue = {
    message: string;
    groupKey: string;
};

const SITE_KEY_REQUIRED_CODES = new Set([
    'site.sync.missing_group_key',
    'site.sub2api.api_key_required',
    'site.sub2api.model_api_key_required',
]);

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    return fallback;
}

function getApiError(error: unknown): ApiError | null {
    if (!error || typeof error !== 'object') return null;
    const candidate = error as Partial<ApiError>;
    if (typeof candidate.code === 'number' || typeof candidate.message === 'string' || typeof candidate.errorCode === 'string') {
        return candidate as ApiError;
    }
    return null;
}

function getSiteKeyIssue(error: unknown, credentialType: SiteCredentialType | null): SiteKeyIssue | null {
    if (credentialType === SiteCredentialType.APIKey) return null;

    const apiError = getApiError(error);
    const code = apiError?.errorCode ?? '';
    const message = getErrorMessage(error, '同步失败');
    const lowered = message.toLowerCase();
    const requiresSiteKey =
        SITE_KEY_REQUIRED_CODES.has(code) ||
        lowered.includes('create a key') ||
        lowered.includes('requires a key') ||
        lowered.includes('api key is required');

    if (!requiresSiteKey) return null;

    const groupKeyParam = apiError?.params?.groupKey;
    return {
        message,
        groupKey: typeof groupKeyParam === 'string' && groupKeyParam.trim()
            ? groupKeyParam.trim()
            : 'default',
    };
}

function findWizardAccount(cards: SiteChannelCard[], siteId: number | null, accountId: number | null): SiteChannelAccount | null {
    const card = cards.find((c) => c.site_id === siteId);
    return card?.accounts.find((a) => a.account_id === accountId) ?? null;
}

function extractAccountModels(account: SiteChannelAccount | null) {
    return account?.groups.flatMap((g) => g.models) ?? [];
}

export function Step2Sync() {
    const { siteId, accountId, credentialType, setStep } = useWizardStore();
    const { mutateAsync: syncAccountAsync } = useSyncSiteAccount();
    const { data: sites } = useSiteList();
    const { refetch: refetchChannels } = useSiteChannelList();
    const { mutateAsync: createSiteKeyAsync, isPending: isCreatingSiteKey } = useCreateSiteChannelKey(siteId ?? 0, accountId ?? 0);

    const [syncing, setSyncing] = useState(true);
    const [syncingMessage, setSyncingMessage] = useState('正在同步模型...');
    const [syncError, setSyncError] = useState<string | null>(null);
    const [siteKeyIssue, setSiteKeyIssue] = useState<SiteKeyIssue | null>(null);
    const [models, setModels] = useState<SiteChannelModel[]>([]);

    const refreshSyncedModels = useCallback(async () => {
        const result = await refetchChannels();
        if (result.isError) {
            throw result.error;
        }
        const cards = result.data ?? [];
        const account = findWizardAccount(cards, siteId, accountId);
        const allModels = extractAccountModels(account);
        setModels(allModels);
        return allModels;
    }, [accountId, refetchChannels, siteId]);

    const runSync = useCallback(async () => {
        if (!accountId) return;

        setSyncing(true);
        setSyncingMessage('正在同步模型...');
        setSyncError(null);
        setSiteKeyIssue(null);

        try {
            await syncAccountAsync(accountId);
            await refreshSyncedModels();
        } catch (err: unknown) {
            const issue = getSiteKeyIssue(err, credentialType);
            if (issue) {
                setSiteKeyIssue(issue);
                setModels([]);
            } else {
                setSyncError(getErrorMessage(err, '同步失败'));
            }
        } finally {
            setSyncing(false);
        }
    }, [accountId, credentialType, refreshSyncedModels, syncAccountAsync]);

    async function handleCreateSiteKeyAndRetry() {
        if (!siteKeyIssue || !siteId || !accountId) return;

        setSyncing(true);
        setSyncingMessage('正在创建网站 API Key 并同步...');
        setSyncError(null);
        setSiteKeyIssue(null);

        try {
            try {
                await createSiteKeyAsync({
                    group_key: siteKeyIssue.groupKey,
                    name: 'quick-start-default',
                });
            } catch (err: unknown) {
                setSyncError(getErrorMessage(err, '创建网站 API Key 失败'));
                return;
            }

            try {
                await syncAccountAsync(accountId);
                await refreshSyncedModels();
                toast.success('已创建网站 API Key 并完成同步');
            } catch (err: unknown) {
                const message = getErrorMessage(err, '重新同步模型失败');
                setSyncError(`网站 API Key 已创建，但重新同步模型失败：${message}`);
            }
        } finally {
            setSyncing(false);
        }
    }

    useEffect(() => {
        void runSync();
    }, [runSync]);

    const siteName = sites?.find((s) => s.id === siteId)?.name ?? '';

    return (
        <Card>
            <CardHeader>
                <CardTitle>同步模型</CardTitle>
                <CardDescription>
                    {siteName && `站点「${siteName}」的模型同步结果`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {syncing && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">{syncingMessage}</p>
                    </div>
                )}

                {siteKeyIssue && !syncing && (
                    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                        <div className="flex gap-3">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            <div className="grid gap-1">
                                <p className="font-medium text-amber-700 dark:text-amber-400">需要网站 API Key 后才能同步模型</p>
                                <p className="text-muted-foreground">
                                    当前账号是 Access Token 模式，但目标站点还没有可用 API Key。可以让 Octopus 在站点分组
                                    <span className="font-medium text-foreground"> {siteKeyIssue.groupKey} </span>
                                    下创建一个 Key 并重新同步，或先去目标站点手动创建后再重试。
                                </p>
                                <p className="text-xs text-muted-foreground">{siteKeyIssue.message}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="rounded-xl"
                                disabled={syncing || isCreatingSiteKey}
                                onClick={() => void handleCreateSiteKeyAndRetry()}
                            >
                                <KeyRound className="size-4" />
                                创建网站 API Key 并同步
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                disabled={syncing}
                                onClick={() => void runSync()}
                            >
                                <RefreshCw className="size-4" />
                                我已创建，重新同步
                            </Button>
                        </div>
                    </div>
                )}

                {syncError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                        {syncError}
                        <div className="mt-3">
                            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => void runSync()}>
                                <RefreshCw className="size-4" />
                                重新同步
                            </Button>
                        </div>
                    </div>
                )}

                {!syncing && !syncError && !siteKeyIssue && (
                    <>
                        {models.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">未发现模型，请检查站点配置</p>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="px-4 py-2.5 text-left font-medium">模型名</th>
                                            <th className="px-4 py-2.5 text-left font-medium">路由类型</th>
                                            <th className="px-4 py-2.5 text-right font-medium">状态</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {models.map((m) => (
                                            <tr key={m.model_name} className="border-b last:border-0">
                                                <td className="px-4 py-2 font-mono text-xs">{m.model_name}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{m.route_type}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <Badge variant={m.disabled ? 'destructive' : 'default'} className="rounded-lg">
                                                        {m.disabled ? '已禁用' : '可用'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <span className="text-muted-foreground text-sm">
                                共 {models.length} 个模型
                            </span>
                            <Button className="rounded-xl" onClick={() => setStep(3)} disabled={models.length === 0}>
                                下一步
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
