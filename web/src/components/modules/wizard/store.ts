import { create } from 'zustand';
import type { SiteCredentialType } from '@/api/endpoints/site';

export type WizardStep = 1 | 2 | 3 | 4;
export type WizardCredentialType = SiteCredentialType;

interface WizardState {
    step: WizardStep;
    siteId: number | null;
    accountId: number | null;
    channelId: number | null;
    groupId: number | null;
    credentialType: WizardCredentialType | null;
    selectedModels: string[];
    filterMode: 'none' | 'deny-list' | 'allow-list';
    setStep: (step: WizardStep) => void;
    setSiteId: (id: number) => void;
    setAccountId: (id: number) => void;
    setChannelId: (id: number) => void;
    setGroupId: (id: number) => void;
    setCredentialType: (type: WizardCredentialType) => void;
    setSelectedModels: (models: string[]) => void;
    setFilterMode: (mode: 'none' | 'deny-list' | 'allow-list') => void;
    reset: () => void;
}

const initialState = {
    step: 1 as WizardStep,
    siteId: null as number | null,
    accountId: null as number | null,
    channelId: null as number | null,
    groupId: null as number | null,
    credentialType: null as WizardCredentialType | null,
    selectedModels: [] as string[],
    filterMode: 'none' as const,
};

export const useWizardStore = create<WizardState>((set) => ({
    ...initialState,
    setStep: (step) => set({ step }),
    setSiteId: (id) => set({ siteId: id }),
    setAccountId: (id) => set({ accountId: id }),
    setChannelId: (id) => set({ channelId: id }),
    setGroupId: (id) => set({ groupId: id }),
    setCredentialType: (type) => set({ credentialType: type }),
    setSelectedModels: (models) => set({ selectedModels: models }),
    setFilterMode: (mode) => set({ filterMode: mode }),
    reset: () => set(initialState),
}));
