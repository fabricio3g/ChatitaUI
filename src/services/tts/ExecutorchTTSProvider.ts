/**
 * ExecutorchTTSProvider
 * React Native text-to-speech provider using react-native-executorch
 * High-quality local TTS with .pte models
 */

import * as FileSystem from 'expo-file-system/legacy';
import { isExpoGo } from '../../utils/isExpoGo';
import { TTSProvider, TTSConfig, TTSProviderId } from './types';

// TTS model URLs from HuggingFace ExecuTorch collection
export const EXECUTORCH_TTS_MODELS = {
    'tts-default': {
        name: 'ExecuTorch TTS',
        size: '~100 MB',
        url: 'https://huggingface.co/software-mansion/react-native-executorch-tts/resolve/main/tts.pte',
        description: 'Default TTS model',
    },
};

export type ExecutorchTTSModelId = keyof typeof EXECUTORCH_TTS_MODELS;

// Voice presets
export const EXECUTORCH_TTS_VOICES = {
    'default': { name: 'Default', gender: 'neutral' },
    'female-1': { name: 'Voice 1', gender: 'female' },
    'male-1': { name: 'Voice 2', gender: 'male' },
};

export type ExecutorchVoiceId = keyof typeof EXECUTORCH_TTS_VOICES;

// Lazy-load react-native-executorch
let executorchModule: any = null;
function getExecutorch() {
    if (isExpoGo()) {
        console.warn('[ExecutorchTTS] Not available in Expo Go');
        return null;
    }
    if (!executorchModule) {
        try {
            executorchModule = require('react-native-executorch');
        } catch (e) {
            console.error('[ExecutorchTTS] Failed to load react-native-executorch:', e);
            return null;
        }
    }
    return executorchModule;
}

export class ExecutorchTTSProvider implements TTSProvider {
    id: TTSProviderId = 'executorch' as TTSProviderId;
    name = 'ExecuTorch TTS (Local)';

    private modelPath: string | null = null;

    isSupported(): boolean {
        return !isExpoGo() && getExecutorch() !== null;
    }

    async isAvailable(): Promise<boolean> {
        return this.isSupported();
    }

    async isModelDownloaded(modelId: ExecutorchTTSModelId = 'tts-default'): Promise<boolean> {
        const modelDir = `${FileSystem.documentDirectory}executorch_tts_models/`;
        const modelPath = `${modelDir}${modelId}.pte`;
        try {
            const info = await FileSystem.getInfoAsync(modelPath);
            return info.exists;
        } catch {
            return false;
        }
    }

    async getDownloadedModels(): Promise<string[]> {
        const modelDir = `${FileSystem.documentDirectory}executorch_tts_models/`;
        try {
            const dirInfo = await FileSystem.getInfoAsync(modelDir);
            if (!dirInfo.exists) return [];

            const files = await FileSystem.readDirectoryAsync(modelDir);
            return files.filter(f => f.endsWith('.pte')).map(f => f.replace('.pte', ''));
        } catch {
            return [];
        }
    }

    downloadModel(
        modelId: ExecutorchTTSModelId = 'tts-default',
        onProgress?: (progress: number) => void
    ): { promise: Promise<boolean>; cancel: () => Promise<void> } {
        const modelDir = `${FileSystem.documentDirectory}executorch_tts_models/`;
        const modelPath = `${modelDir}${modelId}.pte`;
        const modelInfo = EXECUTORCH_TTS_MODELS[modelId];

        if (!modelInfo) {
            return {
                promise: Promise.reject(new Error(`Unknown TTS model: ${modelId}`)),
                cancel: async () => { },
            };
        }

        let downloadResumable: FileSystem.DownloadResumable | null = null;

        const promise = (async () => {
            try {
                await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

                downloadResumable = FileSystem.createDownloadResumable(
                    modelInfo.url,
                    modelPath,
                    {},
                    (downloadProgress) => {
                        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                        onProgress?.(progress);
                    }
                );

                const result = await downloadResumable.downloadAsync();
                return result?.uri ? true : false;
            } catch (e) {
                console.error(`[ExecutorchTTS] Download failed for ${modelId}:`, e);
                try {
                    await FileSystem.deleteAsync(modelPath, { idempotent: true });
                } catch { }
                return false;
            }
        })();

        return {
            promise,
            cancel: async () => {
                if (downloadResumable) {
                    await downloadResumable.pauseAsync();
                    try {
                        await FileSystem.deleteAsync(modelPath, { idempotent: true });
                    } catch { }
                }
            },
        };
    }

    async deleteModel(modelId: ExecutorchTTSModelId): Promise<boolean> {
        const modelPath = `${FileSystem.documentDirectory}executorch_tts_models/${modelId}.pte`;
        try {
            await FileSystem.deleteAsync(modelPath, { idempotent: true });
            return true;
        } catch {
            return false;
        }
    }

    async loadModel(modelId: ExecutorchTTSModelId = 'tts-default'): Promise<boolean> {
        try {
            const exists = await this.isModelDownloaded(modelId);
            if (!exists) {
                console.error(`[ExecutorchTTS] Model not downloaded: ${modelId}`);
                return false;
            }

            const modelPath = `${FileSystem.documentDirectory}executorch_tts_models/${modelId}.pte`;
            this.modelPath = modelPath;

            console.log(`[ExecutorchTTS] Model ready: ${modelId}`);
            return true;
        } catch (e) {
            console.error(`[ExecutorchTTS] Failed to load model:`, e);
            return false;
        }
    }

    /**
     * Synthesize speech from text
     * Note: useTextToSpeech hook from react-native-executorch should be used in React components
     */
    async synthesize(text: string, config: TTSConfig): Promise<{ audioUri: string; duration?: number }> {
        if (!this.modelPath) {
            throw new Error('TTS model not loaded. Call loadModel() first.');
        }

        const executorch = getExecutorch();
        if (!executorch) {
            throw new Error('ExecuTorch not available');
        }

        console.log(`[ExecutorchTTS] Would synthesize: "${text.substring(0, 50)}..."`);
        console.log('[ExecutorchTTS] Use useTextToSpeech hook in React components for actual synthesis');

        // Return placeholder - actual synthesis done through hook
        return {
            audioUri: '',
            duration: 0,
        };
    }

    async getVoices(): Promise<{ id: string; name: string; category?: string }[]> {
        return Object.entries(EXECUTORCH_TTS_VOICES).map(([id, def]) => ({
            id,
            name: def.name,
            category: def.gender,
        }));
    }

    async getDownloadedVoicesList(): Promise<string[]> {
        // All voices are included in the model
        return Object.keys(EXECUTORCH_TTS_VOICES);
    }

    async downloadVoice(voiceId: string, onProgress?: (progress: number) => void): Promise<boolean> {
        // Voices are bundled with the model
        console.log(`[ExecutorchTTS] Voice ${voiceId} is bundled with the model`);
        return true;
    }

    async isVoiceReady(voiceId: string): Promise<boolean> {
        return voiceId in EXECUTORCH_TTS_VOICES;
    }

    getModelPath(): string | null {
        return this.modelPath;
    }
}

export const ExecutorchTTS = new ExecutorchTTSProvider();
