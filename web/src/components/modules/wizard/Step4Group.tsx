'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGroupList, useCreateGroup, GroupMode } from '@/api/endpoints/group';
import { useWizardStore } from './store';
import { useNavStore } from '@/components/modules/navbar';

export function Step4Group() {
    const { data: groups } = useGroupList();
    const createGroup = useCreateGroup();
    const { selectedModels, filterMode, reset } = useWizardStore();
    const setActiveItem = useNavStore((s) => s.setActiveItem);

    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [newGroupName, setNewGroupName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleFinish() {
        if (mode === 'new') {
            if (!newGroupName.trim()) {
                toast.error('请输入分组名称');
                return;
            }
            setSubmitting(true);
            try {
                await createGroup.mutateAsync({
                    name: newGroupName.trim(),
                    mode: GroupMode.RoundRobin,
                    match_regex: '',
                });
                toast.success('分组已创建');
            } catch (err) {
                toast.error(err instanceof Error ? err.message : '创建分组失败');
                setSubmitting(false);
                return;
            }
            setSubmitting(false);
        }

        toast.success('快速设置完成！');
        reset();
        setActiveItem('group');
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>分配分组</CardTitle>
                <CardDescription>
                    选择已有分组或创建新分组，完成配置
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Button
                        variant={mode === 'existing' ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setMode('existing')}
                    >
                        选择已有分组
                    </Button>
                    <Button
                        variant={mode === 'new' ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setMode('new')}
                    >
                        创建新分组
                    </Button>
                </div>

                {mode === 'existing' ? (
                    <Label className="grid gap-2">
                        <span>选择分组</span>
                        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                            <SelectTrigger className="w-full rounded-xl">
                                <SelectValue placeholder="选择一个分组" />
                            </SelectTrigger>
                            <SelectContent>
                                {(groups ?? []).map((g) => (
                                    <SelectItem key={g.id} value={String(g.id)}>
                                        {g.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Label>
                ) : (
                    <Label className="grid gap-2">
                        <span>新分组名称</span>
                        <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="例如：default"
                            className="rounded-xl"
                        />
                    </Label>
                )}

                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <h4 className="text-sm font-medium">配置摘要</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p>已选模型：{selectedModels.length} 个</p>
                        <p>
                            过滤模式：
                            <Badge variant="outline" className="ml-1 rounded-lg">
                                {filterMode === 'none' ? '不过滤' : filterMode === 'deny-list' ? '黑名单' : '白名单'}
                            </Badge>
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        className="rounded-xl"
                        onClick={handleFinish}
                        disabled={submitting || (mode === 'existing' && !selectedGroupId)}
                    >
                        {submitting ? '处理中...' : '完成'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
