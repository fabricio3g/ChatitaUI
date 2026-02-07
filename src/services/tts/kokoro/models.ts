/**
 * Kokoro ONNX Model Management
 * Download and manage ONNX models and voice data from HuggingFace
 */

import * as FileSystem from 'expo-file-system/legacy';

// Base URLs for downloads
const MODEL_BASE_URL = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx';
const VOICE_BASE_URL = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices';

// Model options with sizes and descriptions
export const MODELS = Object.freeze({
    'model_q8f16.onnx': {
        name: 'Q8F16 (Recommended)',
        size: '86 MB',
        description: 'Balanced quality and size',
        url: `${MODEL_BASE_URL}/model_q8f16.onnx`,
    },
    'model_q4f16.onnx': {
        name: 'Q4F16',
        size: '154 MB',
        description: 'Good quality, smaller size',
        url: `${MODEL_BASE_URL}/model_q4f16.onnx`,
    },
    'model_fp16.onnx': {
        name: 'FP16',
        size: '163 MB',
        description: 'High quality, reduced size',
        url: `${MODEL_BASE_URL}/model_fp16.onnx`,
    },
});

export type ModelId = keyof typeof MODELS;

// Available voices
export const KOKORO_VOICES = Object.freeze({
    'af_bella': { name: 'Bella (F)', language: 'en-us', gender: 'female', quality: 'premium' },
    'af_heart': { name: 'Heart (F)', language: 'en-us', gender: 'female', quality: 'premium' },
    'af_nicole': { name: 'Nicole (F)', language: 'en-us', gender: 'female', quality: 'premium' },
    'af_sarah': { name: 'Sarah (F)', language: 'en-us', gender: 'female', quality: 'premium' },
    'af_sky': { name: 'Sky (F)', language: 'en-us', gender: 'female', quality: 'premium' },
    'am_adam': { name: 'Adam (M)', language: 'en-us', gender: 'male', quality: 'premium' },
    'am_michael': { name: 'Michael (M)', language: 'en-us', gender: 'male', quality: 'premium' },
    'bf_emma': { name: 'Emma (F)', language: 'en-gb', gender: 'female', quality: 'premium' },
    'bf_isabella': { name: 'Isabella (F)', language: 'en-gb', gender: 'female', quality: 'premium' },
    'bm_george': { name: 'George (M)', language: 'en-gb', gender: 'male', quality: 'premium' },
    'bm_lewis': { name: 'Lewis (M)', language: 'en-gb', gender: 'male', quality: 'premium' },
});

export type VoiceId = keyof typeof KOKORO_VOICES;

// Voice directory path
const getVoiceDir = () => `${FileSystem.documentDirectory}voices/`;

/**
 * Check if a model is downloaded
 */
export const isModelDownloaded = async (modelId: ModelId): Promise<boolean> => {
    try {
        const modelPath = FileSystem.cacheDirectory + modelId;
        const fileInfo = await FileSystem.getInfoAsync(modelPath);
        // @ts-ignore - exists property
        return fileInfo.exists;
    } catch (error) {
        console.error('Error checking if model exists:', error);
        return false;
    }
};

/**
 * Check if a voice is downloaded
 */
export const isVoiceDownloaded = async (voiceId: VoiceId): Promise<boolean> => {
    try {
        const voicePath = getVoiceDir() + `${voiceId}.bin`;
        const fileInfo = await FileSystem.getInfoAsync(voicePath);
        // @ts-ignore - exists property
        return fileInfo.exists;
    } catch (error) {
        console.error('Error checking if voice exists:', error);
        return false;
    }
};

/**
 * Get list of downloaded models
 */
export const getDownloadedModels = async (): Promise<ModelId[]> => {
    const downloaded: ModelId[] = [];
    for (const modelId of Object.keys(MODELS) as ModelId[]) {
        if (await isModelDownloaded(modelId)) {
            downloaded.push(modelId);
        }
    }
    return downloaded;
};

/**
 * Get list of downloaded voices
 */
export const getDownloadedVoices = async (): Promise<VoiceId[]> => {
    const downloaded: VoiceId[] = [];
    for (const voiceId of Object.keys(KOKORO_VOICES) as VoiceId[]) {
        if (await isVoiceDownloaded(voiceId)) {
            downloaded.push(voiceId);
        }
    }
    return downloaded;
};

/**
 * Download a model with progress callback
 */
export const downloadModel = (
    modelId: ModelId,
    onProgress?: (progress: number) => void
): { promise: Promise<boolean>, cancel: () => Promise<void> } => {
    let downloadResumable: FileSystem.DownloadResumable | null = null;
    let isCancelled = false;

    const promise = (async () => {
        try {
            const model = MODELS[modelId];
            if (!model) throw new Error(`Model ${modelId} not found`);

            const modelPath = FileSystem.cacheDirectory + modelId;

            downloadResumable = FileSystem.createDownloadResumable(
                model.url,
                modelPath,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    onProgress?.(progress);
                }
            );

            console.log(`[Kokoro] Starting model download: ${modelId}...`);
            const result = await downloadResumable.downloadAsync();
            if (isCancelled) return false;
            
            if (result?.uri) {
                console.log(`[Kokoro] Model downloaded: ${modelId}`);
                return true;
            }
            return false;
        } catch (error) {
            if (isCancelled) console.log('[Kokoro] Download cancelled');
            else console.error('[Kokoro] Error downloading model:', error);
            return false;
        }
    })();

    const cancel = async () => {
        isCancelled = true;
        if (downloadResumable) {
            try {
                await downloadResumable.cancelAsync();
            } catch (e) {
                console.warn('[Kokoro] Error cancelling download:', e);
            }
        }
    };

    return { promise, cancel };
};

/**
 * Download a voice with progress callback
 */
export const downloadVoice = (
    voiceId: VoiceId,
    onProgress?: (progress: number) => void
): { promise: Promise<boolean>, cancel: () => Promise<void> } => {
    let downloadResumable: FileSystem.DownloadResumable | null = null;
    let isCancelled = false;

    const promise = (async () => {
        try {
            // Ensure voice directory exists
            const voiceDir = getVoiceDir();
            const dirInfo = await FileSystem.getInfoAsync(voiceDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(voiceDir, { intermediates: true });
            }

            const voicePath = voiceDir + `${voiceId}.bin`;
            const voiceUrl = `${VOICE_BASE_URL}/${voiceId}.bin`;

            downloadResumable = FileSystem.createDownloadResumable(
                voiceUrl,
                voicePath,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    onProgress?.(progress);
                }
            );

            console.log(`[Kokoro] Starting voice download: ${voiceId}...`);
            const result = await downloadResumable.downloadAsync();
            if (isCancelled) return false;
            
            if (result?.uri) {
                console.log(`[Kokoro] Voice downloaded: ${voiceId}`);
                return true;
            }
            return false;
        } catch (error) {
            if (isCancelled) console.log('[Kokoro] Voice download cancelled');
            else console.error('[Kokoro] Error downloading voice:', error);
            return false;
        }
    })();

    const cancel = async () => {
        isCancelled = true;
        if (downloadResumable) {
            try {
                await downloadResumable.cancelAsync();
            } catch (e) {
                console.warn('[Kokoro] Error cancelling voice download:', e);
            }
        }
    };

    return { promise, cancel };
};

/**
 * Delete a model
 */
export const deleteModel = async (modelId: ModelId): Promise<boolean> => {
    try {
        const modelPath = FileSystem.cacheDirectory + modelId;
        await FileSystem.deleteAsync(modelPath, { idempotent: true });
        return true;
    } catch (error) {
        console.error('[Kokoro] Error deleting model:', error);
        return false;
    }
};

/**
 * Delete a voice
 */
export const deleteVoice = async (voiceId: VoiceId): Promise<boolean> => {
    try {
        const voicePath = getVoiceDir() + `${voiceId}.bin`;
        await FileSystem.deleteAsync(voicePath, { idempotent: true });
        return true;
    } catch (error) {
        console.error('[Kokoro] Error deleting voice:', error);
        return false;
    }
};

/**
 * Get voice data as Float32Array
 */
export const getVoiceData = async (voiceId: VoiceId): Promise<Float32Array> => {
    try {
        const voicePath = getVoiceDir() + `${voiceId}.bin`;
        const fileInfo = await FileSystem.getInfoAsync(voicePath);
        
        if (!fileInfo.exists) {
            throw new Error(`Voice ${voiceId} not found. Please download it first.`);
        }

        // Read file as base64
        const base64Data = await FileSystem.readAsStringAsync(voicePath, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to Float32Array
        return new Float32Array(bytes.buffer);
    } catch (error) {
        console.error('[Kokoro] Error reading voice data:', error);
        throw error;
    }
};

/**
 * Get total storage used by Kokoro (models + voices)
 */
export const getStorageUsage = async (): Promise<{ models: number, voices: number, total: number }> => {
    let models = 0;
    let voices = 0;

    try {
        // Calculate models size
        for (const modelId of Object.keys(MODELS) as ModelId[]) {
            const modelPath = FileSystem.cacheDirectory + modelId;
            const info = await FileSystem.getInfoAsync(modelPath) as any;
            if (info.exists && info.size) {
                models += info.size;
            }
        }

        // Calculate voices size
        for (const voiceId of Object.keys(KOKORO_VOICES) as VoiceId[]) {
            const voicePath = getVoiceDir() + `${voiceId}.bin`;
            const info = await FileSystem.getInfoAsync(voicePath) as any;
            if (info.exists && info.size) {
                voices += info.size;
            }
        }
    } catch (error) {
        console.error('[Kokoro] Error calculating storage:', error);
    }

    return { models, voices, total: models + voices };
};
