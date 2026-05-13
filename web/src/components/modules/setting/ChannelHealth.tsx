'use client';

import { useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';
import { useChannelHealth, type ChannelHealthView } from '@/api/endpoints/channel';
import { cn } from '@/lib/utils';
import { Loader } from 'lucide-react';

const STATE_COLOR: Record<string, string> = {
    active: 'bg-green-500/15 text-green-600 dark:text-green-400',
    penalized: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    recovering: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    quarantined: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const STATE_DOT: Record<string, string> = {
    active: 'bg-green-500',
    penalized: 'bg-yellow-500',
    recovering: 'bg-blue-500',
    quarantined: 'bg-red-500',
};

function StateBadge({ state }: { state: string }) {
    const color = STATE_COLOR[state] ?? 'bg-muted text-muted-foreground';
    const dot = STATE_DOT[state] ?? 'bg-muted-foreground';
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
            <span className={cn('size-1.5 rounded-full', dot)} />
            {state}
        </span>
    );
}

function ChannelHealthRow({ ch }: { ch: ChannelHealthView }) {
    return (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/30 text-sm">
            <span className="font-medium truncate flex-1 min-w-0">{ch.channel_name}</span>
            <div className="flex items-center gap-3 shrink-0">
                {!ch.enabled && (
                    <span className="text-xs text-muted-foreground">disabled</span>
                )}
                <StateBadge state={ch.state} />
            </div>
        </div>
    );
}

export function SettingChannelHealth() {
    const t = useTranslations('setting');
    const { data, isLoading, error } = useChannelHealth();

    return (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-card-foreground flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('channelHealth.title')}
            </h2>

            {isLoading ? (
                <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
                    <Loader className="size-4 animate-spin" />
                </div>
            ) : error ? (
                <div className="h-20 flex items-center justify-center text-sm text-destructive">
                    {t('channelHealth.loadFailed')}
                </div>
            ) : !data || data.total === 0 ? (
                <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
                    {t('channelHealth.empty')}
                </div>
            ) : (
                <>
                    {/* Summary counters */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl bg-green-500/10 p-2">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">{data.active}</div>
                            <div className="text-[11px] text-muted-foreground">Active</div>
                        </div>
                        <div className="rounded-xl bg-yellow-500/10 p-2">
                            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{data.penalized}</div>
                            <div className="text-[11px] text-muted-foreground">Penalized</div>
                        </div>
                        <div className="rounded-xl bg-blue-500/10 p-2">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{data.recovering}</div>
                            <div className="text-[11px] text-muted-foreground">Recovering</div>
                        </div>
                        <div className="rounded-xl bg-red-500/10 p-2">
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">{data.quarantined}</div>
                            <div className="text-[11px] text-muted-foreground">Quarantined</div>
                        </div>
                    </div>

                    {/* Channel list */}
                    <div className="max-h-60 overflow-y-auto space-y-1.5">
                        {data.channels.map((ch) => (
                            <ChannelHealthRow key={ch.channel_id} ch={ch} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
