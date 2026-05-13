'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSyncSiteAccount, useSiteList } from '@/api/endpoints/site';
import { useSiteChannelList, type SiteChannelModel } from '@/api/endpoints/site-channel';
import { useWizardStore } from './store';

export function Step2Sync() {
    const { siteId, accountId, setStep } = useWizardStore();
    const syncAccount = useSyncSiteAccount();
    const { data: sites } = useSiteList();
    const { data: channelCards, refetch: refetchChannels } = useSiteChannelList();

    const [syncing, setSyncing] = useState(true);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [models, setModels] = useState<SiteChannelModel[]>([]);

    useEffect(() => {
        if (!accountId) return;

        setSyncing(true);
        setSyncError(null);

        syncAccount.mutateAsync(accountId)
            .then(() => refetchChannels())
            .then((result) => {
                const cards = result.data ?? channelCards ?? [];
                const card = cards.find((c) => c.site_id === siteId);
                const account = card?.accounts.find((a) => a.account_id === accountId);
                const allModels = account?.groups.flatMap((g) => g.models) ?? [];
                setModels(allModels);
                setSyncing(false);
            })
            .catch((err) => {
                setSyncError(err instanceof Error ? err.message : '同步失败');
                setSyncing(false);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountId]);

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
                        <p className="text-muted-foreground text-sm">正在同步模型...</p>
                    </div>
                )}

                {syncError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
                        {syncError}
                    </div>
                )}

                {!syncing && !syncError && (
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
