/**
 * KokoroProvider
 * Bridge to ExecutorchTTSProvider using react-native-executorch
 *
 * This file provides backwards compatibility with the old KokoroProvider API
 * while using the new ExecutorchTTSProvider under the hood.
 *
 * Note: The Kokoro ONNX models have been replaced with ExecuTorch TTS.
 * Voice files are bundled with the model in the new implementation.
 */

import { TTSProvider, TTSConfig, TTSProviderId } from './types';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { EnhancedTTS } from '../executorch/TTSProvider';

const DEFAULT_MODEL_ID = 'kokoro-small';
const DEFAULT_VOICE_ID = 'af-heart';

const normalizeVoiceId = (voiceId?: string): string => {
    if (!voiceId) return DEFAULT_VOICE_ID;
    const normalized = voiceId.replace(/_/g, '-').toLowerCase();
    return EnhancedTTS.getVoiceInfo(normalized) ? normalized : DEFAULT_VOICE_ID;
};

const float32ToWavBase64 = (samples: Float32Array, sampleRate = 24000): string => {
    const channels = 1;
    const bitsPerSample = 16;
    const blockAlign = channels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(offset + i, value.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
    }

    return Buffer.from(new Uint8Array(buffer)).toString('base64');
};

export class KokoroProvider implements TTSProvider {
    id: TTSProviderId = 'kokoro';
    name = 'Kokoro (Local)';

    private loadedVoiceId: string | null = null;

    async synthesize(text: string, config: TTSConfig): Promise<{ audioUri: string; duration?: number }> {
        if (!EnhancedTTS.isSupported()) {
            throw new Error("Local TTS is not supported in this environment (requires development build with react-native-executorch).");
        }

        const voiceId = normalizeVoiceId(config.voiceId);
        const needsLoad = !EnhancedTTS.isModelLoaded() || this.loadedVoiceId !== voiceId;
        if (needsLoad) {
            const modelLoaded = await EnhancedTTS.loadModel(DEFAULT_MODEL_ID, voiceId);
            if (!modelLoaded) {
                throw new Error('Failed to load Kokoro model.');
            }
            this.loadedVoiceId = voiceId;
        }

        const audioFloat = await EnhancedTTS.synthesize(text, {
            speed: config.speed ?? 1.0,
            voiceId,
        });
        const wavBase64 = float32ToWavBase64(audioFloat, 24000);
        const outputUri = `${FileSystem.cacheDirectory}kokoro_tts_${Date.now()}.wav`;

        await FileSystem.writeAsStringAsync(outputUri, wavBase64, {
            encoding: FileSystem.EncodingType.Base64,
        });

        return { audioUri: outputUri };
    }

    async isAvailable(): Promise<boolean> {
        return EnhancedTTS.isSupported();
    }

    async getVoices(): Promise<{ id: string; name: string; category?: string }[]> {
        return EnhancedTTS.getAvailableVoices().map(v => ({
            id: v.id,
            name: v.name,
            category: `${v.gender}-${v.accent}`,
        }));
    }

    /**
     * Get list of downloaded voices
     * In the new implementation, all voices are bundled with the model
     */
    async getDownloadedVoicesList(): Promise<string[]> {
        return EnhancedTTS.getAvailableVoices().map(v => v.id);
    }

    /**
     * Download a voice
     * In the new implementation, voices are bundled with the model
     */
    async downloadVoice(voiceId: string, onProgress?: (progress: number) => void): Promise<boolean> {
        onProgress?.(1);
        return EnhancedTTS.getVoiceInfo(normalizeVoiceId(voiceId)) !== null;
    }

    /**
     * Check if a voice is downloaded
     */
    async isVoiceReady(voiceId: string): Promise<boolean> {
        return EnhancedTTS.getVoiceInfo(normalizeVoiceId(voiceId)) !== null;
    }
}
