type SettingsChange = {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    userName?: string;
    userPersona?: string;
    showReasoning?: boolean;
    streamingChunksEnabled?: boolean;
};

type Listener = (change: SettingsChange) => void;

const listeners = new Set<Listener>();

export const SettingsBus = {
    subscribe(listener: Listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    emit(change: SettingsChange) {
        listeners.forEach(listener => listener(change));
    },
};
