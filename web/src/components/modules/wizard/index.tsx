'use client';

import { useWizardStore } from './store';
import { StepIndicator } from './StepIndicator';
import { Step1AddSite } from './Step1AddSite';
import { Step2Sync } from './Step2Sync';
import { Step3Filter } from './Step3Filter';
import { Step4Group } from './Step4Group';
import { PageWrapper } from '@/components/common/PageWrapper';

export function WizardPage() {
    const step = useWizardStore((s) => s.step);

    return (
        <PageWrapper className="h-full min-h-0 overflow-y-auto overscroll-contain space-y-6 pb-24 md:pb-4 rounded-t-3xl">
            <StepIndicator currentStep={step} />
            {step === 1 && <Step1AddSite />}
            {step === 2 && <Step2Sync />}
            {step === 3 && <Step3Filter />}
            {step === 4 && <Step4Group />}
        </PageWrapper>
    );
}
