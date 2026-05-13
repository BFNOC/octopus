'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
    { label: '添加站点' },
    { label: '同步模型' },
    { label: '过滤模型' },
    { label: '分配分组' },
] as const;

interface StepIndicatorProps {
    currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
    return (
        <nav className="flex items-center justify-between">
            {STEPS.map((step, index) => {
                const stepNum = index + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;

                return (
                    <div key={stepNum} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                                    isCurrent && 'border-primary bg-background text-primary',
                                    !isCompleted && !isCurrent && 'border-muted-foreground/30 bg-background text-muted-foreground',
                                )}
                            >
                                {isCompleted ? <Check className="size-4" /> : stepNum}
                            </div>
                            <span
                                className={cn(
                                    'text-xs whitespace-nowrap',
                                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground',
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                        {index < STEPS.length - 1 && (
                            <div
                                className={cn(
                                    'mx-2 h-0.5 flex-1 rounded-full transition-colors',
                                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/20',
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
