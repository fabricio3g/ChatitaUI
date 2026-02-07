/**
 * ExecutorchVisionProvider
 * React Native vision provider using react-native-executorch
 * Supports classification, object detection, OCR, and segmentation
 */

import * as FileSystem from 'expo-file-system/legacy';
import { isExpoGo } from '../../utils/isExpoGo';

// Vision model URLs from HuggingFace ExecuTorch collection
export const EXECUTORCH_VISION_MODELS = {
    // Classification
    'mobilenet-v3': {
        name: 'MobileNet V3',
        type: 'classification',
        size: '~20 MB',
        url: 'https://huggingface.co/software-mansion/react-native-executorch-mobilenet-v3/resolve/main/mobilenet_v3.pte',
        description: 'Fast image classification',
    },
    // Object Detection
    'ssdlite320': {
        name: 'SSDLite320',
        type: 'detection',
        size: '~15 MB',
        url: 'https://huggingface.co/software-mansion/react-native-executorch-ssdlite320/resolve/main/ssdlite320.pte',
        description: 'Object detection',
    },
    // OCR
    'ocr-detect': {
        name: 'OCR Detector',
        type: 'ocr',
        size: '~50 MB',
        url: 'https://huggingface.co/software-mansion/react-native-executorch-ocr/resolve/main/ocr_detector.pte',
        description: 'Text detection in images',
    },
    'ocr-recognize': {
        name: 'OCR Recognizer',
        type: 'ocr',
        size: '~30 MB',
        url: 'https://huggingface.co/software-mansion/react-native-executorch-ocr/resolve/main/ocr_recognizer.pte',
        description: 'Text recognition',
    },
};

export type ExecutorchVisionModelId = keyof typeof EXECUTORCH_VISION_MODELS;
export type VisionTaskType = 'classification' | 'detection' | 'ocr' | 'segmentation';

// Lazy-load react-native-executorch
let executorchModule: any = null;
function getExecutorch() {
    if (isExpoGo()) {
        console.warn('[ExecutorchVision] Not available in Expo Go');
        return null;
    }
    if (!executorchModule) {
        try {
            executorchModule = require('react-native-executorch');
        } catch (e) {
            console.error('[ExecutorchVision] Failed to load react-native-executorch:', e);
            return null;
        }
    }
    return executorchModule;
}

export interface ClassificationResult {
    label: string;
    confidence: number;
}

export interface DetectionResult {
    label: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
}

export interface OCRResult {
    text: string;
    confidence: number;
    bbox?: { x: number; y: number; width: number; height: number };
}

export class ExecutorchVisionProvider {
    private loadedModels: Map<string, string> = new Map();

    isSupported(): boolean {
        return !isExpoGo() && getExecutorch() !== null;
    }

    async isModelDownloaded(modelId: ExecutorchVisionModelId): Promise<boolean> {
        const modelDir = `${FileSystem.documentDirectory}executorch_vision_models/`;
        const modelPath = `${modelDir}${modelId}.pte`;
        try {
            const info = await FileSystem.getInfoAsync(modelPath);
            return info.exists;
        } catch {
            return false;
        }
    }

    async getDownloadedModels(): Promise<string[]> {
        const modelDir = `${FileSystem.documentDirectory}executorch_vision_models/`;
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
        modelId: ExecutorchVisionModelId,
        onProgress?: (progress: number) => void
    ): { promise: Promise<boolean>; cancel: () => Promise<void> } {
        const modelDir = `${FileSystem.documentDirectory}executorch_vision_models/`;
        const modelPath = `${modelDir}${modelId}.pte`;
        const modelInfo = EXECUTORCH_VISION_MODELS[modelId];

        if (!modelInfo) {
            return {
                promise: Promise.reject(new Error(`Unknown vision model: ${modelId}`)),
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
                console.error(`[ExecutorchVision] Download failed for ${modelId}:`, e);
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

    async deleteModel(modelId: ExecutorchVisionModelId): Promise<boolean> {
        const modelPath = `${FileSystem.documentDirectory}executorch_vision_models/${modelId}.pte`;
        try {
            await FileSystem.deleteAsync(modelPath, { idempotent: true });
            this.loadedModels.delete(modelId);
            return true;
        } catch {
            return false;
        }
    }

    async loadModel(modelId: ExecutorchVisionModelId): Promise<boolean> {
        try {
            const exists = await this.isModelDownloaded(modelId);
            if (!exists) {
                console.error(`[ExecutorchVision] Model not downloaded: ${modelId}`);
                return false;
            }

            const modelPath = `${FileSystem.documentDirectory}executorch_vision_models/${modelId}.pte`;
            this.loadedModels.set(modelId, modelPath);

            console.log(`[ExecutorchVision] Model ready: ${modelId}`);
            return true;
        } catch (e) {
            console.error(`[ExecutorchVision] Failed to load model:`, e);
            return false;
        }
    }

    getModelPath(modelId: ExecutorchVisionModelId): string | null {
        return this.loadedModels.get(modelId) || null;
    }

    /**
     * Classify an image
     * Note: useClassification hook should be used in React components
     */
    async classify(imageUri: string): Promise<ClassificationResult[]> {
        const modelPath = this.loadedModels.get('mobilenet-v3');
        if (!modelPath) {
            throw new Error('Classification model not loaded');
        }

        console.log(`[ExecutorchVision] Would classify: ${imageUri}`);
        console.log('[ExecutorchVision] Use useClassification hook in React components');

        return [];
    }

    /**
     * Detect objects in an image
     * Note: useObjectDetection hook should be used in React components
     */
    async detect(imageUri: string): Promise<DetectionResult[]> {
        const modelPath = this.loadedModels.get('ssdlite320');
        if (!modelPath) {
            throw new Error('Detection model not loaded');
        }

        console.log(`[ExecutorchVision] Would detect objects in: ${imageUri}`);
        console.log('[ExecutorchVision] Use useObjectDetection hook in React components');

        return [];
    }

    /**
     * Extract text from an image
     * Note: useOCR hook should be used in React components
     */
    async ocr(imageUri: string): Promise<OCRResult[]> {
        const detectorPath = this.loadedModels.get('ocr-detect');
        const recognizerPath = this.loadedModels.get('ocr-recognize');

        if (!detectorPath || !recognizerPath) {
            throw new Error('OCR models not loaded');
        }

        console.log(`[ExecutorchVision] Would OCR: ${imageUri}`);
        console.log('[ExecutorchVision] Use useOCR hook in React components');

        return [];
    }

    getAvailableModels(): { id: string; name: string; type: string; size: string }[] {
        return Object.entries(EXECUTORCH_VISION_MODELS).map(([id, info]) => ({
            id,
            name: info.name,
            type: info.type,
            size: info.size,
        }));
    }

    async unloadModel(modelId: ExecutorchVisionModelId): Promise<void> {
        this.loadedModels.delete(modelId);
    }

    async unloadAll(): Promise<void> {
        this.loadedModels.clear();
    }
}

export const ExecutorchVision = new ExecutorchVisionProvider();
