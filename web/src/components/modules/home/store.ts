'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/storage';

export type RankSortMode = 'cost' | 'count' | 'tokens';
export type ChartPeriod = '1' | '7' | '30' | 'all';

interface HomeViewState {
    rankSortMode: RankSortMode;
    chartPeriod: ChartPeriod;
    setRankSortMode: (value: RankSortMode) => void;
    setChartPeriod: (value: ChartPeriod) => void;
}

export const useHomeViewStore = create<HomeViewState>()(
    persist(
        (set) => ({
            rankSortMode: 'cost',
            chartPeriod: '7',
            setRankSortMode: (value) => set({ rankSortMode: value }),
            setChartPeriod: (value) => set({ chartPeriod: value }),
        }),
        {
            name: 'home-view-options-storage',
            storage: createBrowserJSONStorage(),
            partialize: (state) => ({
                rankSortMode: state.rankSortMode,
                chartPeriod: state.chartPeriod,
            }),
        }
    )
);
