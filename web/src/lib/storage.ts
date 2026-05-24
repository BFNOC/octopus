import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const noopStorage: StateStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
};

function getBrowserStorage(): StateStorage {
    if (typeof window === 'undefined') {
        return noopStorage;
    }

    try {
        return window.localStorage;
    } catch {
        return noopStorage;
    }
}

export function createBrowserJSONStorage<T>() {
    return createJSONStorage<T>(() => getBrowserStorage());
}
