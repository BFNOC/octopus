'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteChannelList } from '@/api/endpoints/site-channel';
import { useWizardStore } from './store';

type FilterMode = 'none' | 'deny-list' | 'allow-list';

export function Step3Filter() {
    const { siteId, accountId, selectedModels, filterMode, setSelectedModels, setFilterMode, setStep } = useWizardStore();
    const { data: channelCards } = useSiteChannelList();

    const [search, setSearch] = useState('');

    const allModels = useMemo(() => {
        const card = channelCards?.find((c) => c.site_id === siteId);
        const account = card?.accounts.find((a) => a.account_id === accountId);
        return account?.groups.flatMap((g) => g.models.map((m) => m.model_name)) ?? [];
    }, [channelCards, siteId, accountId]);

    const filteredModels = useMemo(() => {
        if (!search.trim()) return allModels;
        const q = search.trim().toLowerCase();
        return allModels.filter((m) => m.toLowerCase().includes(q));
    }, [allModels, search]);

    const selectedSet = useMemo(() => new Set(selectedModels), [selectedModels]);

    function toggleModel(model: string) {
        const next = selectedSet.has(model)
            ? selectedModels.filter((m) => m !== model)
            : [...selectedModels, model];
        setSelectedModels(next);
    }

    function selectAll() {
        setSelectedModels([...allModels]);
    }

    function selectNone() {
        setSelectedModels([]);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>过滤模型</CardTitle>
                <CardDescription>
                    选择需要启用的模型，并设置过滤模式
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="搜索模型..."
                            className="pl-9 rounded-xl"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={selectAll}>
                            全选
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={selectNone}>
                            全不选
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2">
                    {(['none', 'deny-list', 'allow-list'] as FilterMode[]).map((mode) => (
                        <Button
                            key={mode}
                            variant={filterMode === mode ? 'default' : 'outline'}
                            size="sm"
                            className="rounded-lg"
                            onClick={() => setFilterMode(mode)}
                        >
                            {mode === 'none' ? '不过滤' : mode === 'deny-list' ? '黑名单' : '白名单'}
                        </Button>
                    ))}
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border">
                    {filteredModels.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">无匹配模型</p>
                    ) : (
                        <div className="divide-y">
                            {filteredModels.map((model) => (
                                <label
                                    key={model}
                                    className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(model)}
                                        onChange={() => toggleModel(model)}
                                        className="size-4 shrink-0 accent-primary"
                                    />
                                    <span className="font-mono text-sm truncate">{model}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground text-sm">
                        已选 {selectedModels.length} / {allModels.length} 个模型
                    </span>
                    <Button className="rounded-xl" onClick={() => setStep(4)}>
                        下一步
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
