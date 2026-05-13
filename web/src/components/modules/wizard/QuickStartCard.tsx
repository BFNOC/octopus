'use client';

import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavStore } from '@/components/modules/navbar';

export function QuickStartCard() {
    const setActiveItem = useNavStore((s) => s.setActiveItem);

    return (
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Zap className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">快速开始</h3>
                    <p className="text-muted-foreground text-sm">4 步完成站点配置</p>
                </div>
                <Button className="shrink-0 rounded-xl" onClick={() => setActiveItem('wizard')}>
                    开始设置
                </Button>
            </CardContent>
        </Card>
    );
}
