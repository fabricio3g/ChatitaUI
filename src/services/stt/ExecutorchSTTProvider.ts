/**
 * ExecutorchSTTProvider
 * React Native speech-to-text provider using react-native-executorch
 * Uses Whisper models for on-device transcription
 */

import * as FileSystem from 'expo-file-system/legacy';
import { isExpoGo } from '../../utils/isExpoGo';

// Whisper model URLs from HuggingFace ExecuTorch collection
// Note: Whisper models require separate encoder, decoder, and tokenizer files
export const EXECUTORCH_STT_MODELS = {
    'whisper-tiny': {
        name: 'Whisper Tiny',
        size: '~40 MB',
        encoderUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/main/xnnpack/whisper_tiny_encoder_xnnpack.pte',
        decoderUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/main/xnnpack/whisper_tiny_decoder_xnnpack.pte',
        tokenizerUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/main/tokenizer.json',
        description: 'Fast, lower accuracy',
        isMultilingual: true,
    },
    'whisper-base': {
        name: 'Whisper Base',
        size: '~74 MB',
        encoderUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-base/resolve/main/xnnpack/whisper_base_encoder_xnnpack.pte',
        decoderUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-base/resolve/main/xnnpack/whisper_base_decoder_xnnpack.pte',
        tokenizerUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-base/resolve/main/tokenizer.json',
        description: 'Good balance for most uses',
        isMultilingual: true,
    },
};

export type ExecutorchSTTModelId = keyof typeof EXECUTORCH_STT_MODELS;

// Model config type for SpeechToTextModule
interface SpeechToTextModelConfig {
    isMultilingual: boolean;
    encoderSource: string;
    decoderSource: string;
    tokenizerSource: string;
}

// Lazy-load react-native-executorch
let executorchModule: any = null;
function getExecutorch() {
    if (isExpoGo()) {
        console.warn('[ExecutorchSTT] Not available in Expo Go');
        return null;
    }
    if (!executorchModule) {
        try {
            executorchModule = require('react-native-executorch');
        } catch (e) {
            console.error('[ExecutorchSTT] Failed to load react-native-executorch:', e);
            return null;
        }
    }
    return executorchModule;
}

export class ExecutorchSTTProvider {
    private modelConfig: SpeechToTextModelConfig | null = null;
    private modelId: ExecutorchSTTModelId | null = null;
    private sttModule: any = null;

    isReady(): boolean {
        return this.sttModule !== null;
    }

    isSupported(): boolean {
        return !isExpoGo() && getExecutorch() !== null;
    }

    async isModelDownloaded(modelId: ExecutorchSTTModelId): Promise<boolean> {
        const modelDir = `${FileSystem.documentDirectory}executorch_stt_models/${modelId}/`;
        const encoderPath = `${modelDir}encoder.pte`;
        const decoderPath = `${modelDir}decoder.pte`;
        const tokenizerPath = `${modelDir}tokenizer.json`;
        
        try {
            const [encoderInfo, decoderInfo, tokenizerInfo] = await Promise.all([
                FileSystem.getInfoAsync(encoderPath),
                FileSystem.getInfoAsync(decoderPath),
                FileSystem.getInfoAsync(tokenizerPath)
            ]);
            return encoderInfo.exists && decoderInfo.exists && tokenizerInfo.exists;
        } catch {
            return false;
        }
    }

    async getDownloadedModels(): Promise<string[]> {
        const modelDir = `${FileSystem.documentDirectory}executorch_stt_models/`;
        try {
            const dirInfo = await FileSystem.getInfoAsync(modelDir);
            if (!dirInfo.exists) return [];

            const files = await FileSystem.readDirectoryAsync(modelDir);
            // Check for model directories that have all required files
            const downloaded: string[] = [];
            for (const modelId of Object.keys(EXECUTORCH_STT_MODELS)) {
                if (await this.isModelDownloaded(modelId as ExecutorchSTTModelId)) {
                    downloaded.push(modelId);
                }
            }
            return downloaded;
        } catch {
            return [];
        }
    }

    downloadModel(
        modelId: ExecutorchSTTModelId,
        onProgress?: (progress: number) => void
    ): { promise: Promise<boolean>; cancel: () => Promise<void> } {
        const modelDir = `${FileSystem.documentDirectory}executorch_stt_models/${modelId}/`;
        const modelInfo = EXECUTORCH_STT_MODELS[modelId];

        if (!modelInfo) {
            return {
                promise: Promise.reject(new Error(`Unknown STT model: ${modelId}`)),
                cancel: async () => { },
            };
        }

        let encoderResumable: FileSystem.DownloadResumable | null = null;
        let decoderResumable: FileSystem.DownloadResumable | null = null;
        let tokenizerResumable: FileSystem.DownloadResumable | null = null;
        let cancelled = false;

        const promise = (async () => {
            try {
                await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

                // Download tokenizer first (small, ~1MB)
                onProgress?.(0.05);
                tokenizerResumable = FileSystem.createDownloadResumable(
                    modelInfo.tokenizerUrl,
                    `${modelDir}tokenizer.json`
                );
                await tokenizerResumable.downloadAsync();
                if (cancelled) return false;
                onProgress?.(0.1);

                // Download encoder (larger)
                encoderResumable = FileSystem.createDownloadResumable(
                    modelInfo.encoderUrl,
                    `${modelDir}encoder.pte`,
                    {},
                    (progress) => {
                        const p = 0.1 + (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 0.5;
                        onProgress?.(p);
                    }
                );
                await encoderResumable.downloadAsync();
                if (cancelled) return false;
                onProgress?.(0.6);

                // Download decoder (larger)
                decoderResumable = FileSystem.createDownloadResumable(
                    modelInfo.decoderUrl,
                    `${modelDir}decoder.pte`,
                    {},
                    (progress) => {
                        const p = 0.6 + (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 0.4;
                        onProgress?.(p);
                    }
                );
                await decoderResumable.downloadAsync();
                if (cancelled) return false;
                onProgress?.(1.0);

                return true;
            } catch (e) {
                console.error(`[ExecutorchSTT] Download failed for ${modelId}:`, e);
                // Clean up partial downloads
                try {
                    await FileSystem.deleteAsync(modelDir, { idempotent: true });
                } catch { }
                return false;
            }
        })();

        return {
            promise,
            cancel: async () => {
                cancelled = true;
                if (encoderResumable) await encoderResumable.pauseAsync();
                if (decoderResumable) await decoderResumable.pauseAsync();
                if (tokenizerResumable) await tokenizerResumable.pauseAsync();
                try {
                    await FileSystem.deleteAsync(modelDir, { idempotent: true });
                } catch { }
            },
        };
    }

    async deleteModel(modelId: ExecutorchSTTModelId): Promise<boolean> {
        const modelDir = `${FileSystem.documentDirectory}executorch_stt_models/${modelId}/`;
        try {
            await FileSystem.deleteAsync(modelDir, { idempotent: true });
            return true;
        } catch {
            return false;
        }
    }

    async loadModel(modelId: ExecutorchSTTModelId = 'whisper-tiny'): Promise<boolean> {
        const executorch = getExecutorch();
        if (!executorch) {
            console.error('[ExecutorchSTT] ExecuTorch not available');
            return false;
        }

        const exists = await this.isModelDownloaded(modelId);
        if (!exists) {
            console.error(`[ExecutorchSTT] Model not downloaded: ${modelId}`);
            return false;
        }

        const modelDir = `${FileSystem.documentDirectory}executorch_stt_models/${modelId}/`;
        const modelInfo = EXECUTORCH_STT_MODELS[modelId];

        this.modelConfig = {
            isMultilingual: modelInfo.isMultilingual,
            encoderSource: `${modelDir}encoder.pte`,
            decoderSource: `${modelDir}decoder.pte`,
            tokenizerSource: `${modelDir}tokenizer.json`,
        };
        this.modelId = modelId;

        // Initialize the SpeechToTextModule
        try {
            const { SpeechToTextModule } = executorch;
            this.sttModule = new SpeechToTextModule();
            await this.sttModule.load(this.modelConfig);
            return true;
        } catch (e) {
            console.error('[ExecutorchSTT] Failed to load model:', e);
            this.sttModule = null;
            return false;
        }
    }

    /**
     * Transcribe audio waveform (Float32Array at 16kHz)
     * Note: This requires raw audio data, not a file URI
     */
    async transcribe(waveform: Float32Array, language?: string): Promise<string> {
        if (!this.sttModule) {
            throw new Error('STT model not loaded');
        }

        try {
            const options = language ? { language: language as any } : undefined;
            const result = await this.sttModule.transcribe(waveform, options);
            return result;
        } catch (e) {
            console.error('[ExecutorchSTT] Transcription failed:', e);
            throw e;
        }
    }

    /**
     * Get the current model config
     */
    getModelConfig(): SpeechToTextModelConfig | null {
        return this.modelConfig;
    }

    /**
     * Release model resources
     */
    async release(): Promise<void> {
        if (this.sttModule) {
            try {
                this.sttModule.delete();
            } catch (e) {
                console.warn('[ExecutorchSTT] Error releasing model:', e);
            }
            this.sttModule = null;
            this.modelConfig = null;
            this.modelId = null;
        }
    }
}

// Export singleton instance
export const ExecutorchSTT = new ExecutorchSTTProvider();

// Re-export for compatibility
export { EXECUTORCH_STT_MODELS as STT_MODELS };
