/**
 * Whisper Provider for on-device STT (whisper.rn)
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { isExpoGo } from '../../utils/isExpoGo';
import { decodeAudioFile } from '../../utils/audioDecoder';

export const WHISPER_MODELS = {
  'whisper-tiny': {
    name: 'Whisper Tiny',
    size: '~75 MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    description: 'Fast, lower accuracy',
  },
  'whisper-base': {
    name: 'Whisper Base',
    size: '~142 MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    description: 'Good balance for most uses',
  },
  'whisper-small': {
    name: 'Whisper Small',
    size: '~466 MB',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    description: 'Higher accuracy (slower)',
  },
};

export type WhisperModelId = keyof typeof WHISPER_MODELS;

const MODEL_DIR = `${FileSystem.documentDirectory}whisper_models/`;

let whisperModule: any = null;
async function getWhisperModule(): Promise<any | null> {
  if (whisperModule) return whisperModule;
  if (isExpoGo()) {
    console.warn('[WhisperProvider] whisper.rn is not available in Expo Go');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    whisperModule = require('whisper.rn');
    return whisperModule;
  } catch (e) {
    console.warn('[WhisperProvider] Failed to load whisper.rn:', e);
    return null;
  }
}

const float32ToWavBase64 = (samples: Float32Array, sampleRate = 16000): string => {
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

async function writeWavFile(samples: Float32Array): Promise<string> {
  const wavBase64 = float32ToWavBase64(samples, 16000);
  const outputUri = `${FileSystem.cacheDirectory}whisper_${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(outputUri, wavBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outputUri;
}

class WhisperProvider {
  private context: any = null;
  private loadedModelId: WhisperModelId | null = null;

  get isReady(): boolean {
    return Boolean(this.context);
  }

  get isSupported(): boolean {
    return !isExpoGo();
  }

  private getModelPath(modelId: WhisperModelId): string {
    return `${MODEL_DIR}${modelId}.bin`;
  }

  async isModelDownloaded(modelId: WhisperModelId): Promise<boolean> {
    const info = await FileSystem.getInfoAsync(this.getModelPath(modelId));
    return info.exists;
  }

  async getDownloadedModels(): Promise<string[]> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
      if (!dirInfo.exists) return [];
      const files = await FileSystem.readDirectoryAsync(MODEL_DIR);
      return Object.keys(WHISPER_MODELS).filter(id => files.includes(`${id}.bin`));
    } catch {
      return [];
    }
  }

  async deleteModel(modelId: WhisperModelId): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(this.getModelPath(modelId), { idempotent: true });
      return true;
    } catch {
      return false;
    }
  }

  downloadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): { promise: Promise<boolean>; cancel: () => Promise<void> } {
    const normalized = (modelId in WHISPER_MODELS ? modelId : 'whisper-tiny') as WhisperModelId;
    const modelInfo = WHISPER_MODELS[normalized];
    const modelPath = this.getModelPath(normalized);

    let downloadResumable: FileSystem.DownloadResumable | null = null;
    let cancelled = false;

    const promise = (async () => {
      try {
        await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
        const existing = await FileSystem.getInfoAsync(modelPath);
        if (existing.exists) {
          onProgress?.(1);
          return true;
        }

        downloadResumable = FileSystem.createDownloadResumable(
          modelInfo.url,
          modelPath,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (!cancelled) onProgress?.(progress);
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (cancelled) return false;
        return Boolean(result?.uri);
      } catch (e) {
        console.error('[WhisperProvider] Download failed:', e);
        try {
          await FileSystem.deleteAsync(modelPath, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
        return false;
      }
    })();

    return {
      promise,
      cancel: async () => {
        cancelled = true;
        if (downloadResumable) {
          try {
            await downloadResumable.pauseAsync();
          } catch {
            // Ignore pause errors
          }
        }
        try {
          await FileSystem.deleteAsync(modelPath, { idempotent: true });
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  }

  async loadModel(modelId: WhisperModelId = 'whisper-tiny'): Promise<boolean> {
    const mod = await getWhisperModule();
    if (!mod) return false;

    const exists = await this.isModelDownloaded(modelId);
    if (!exists) {
      console.warn('[WhisperProvider] Model not downloaded:', modelId);
      return false;
    }

    const modelPath = this.getModelPath(modelId);
    this.context = await mod.initWhisper({
      filePath: modelPath.replace('file://', ''),
    });
    this.loadedModelId = modelId;
    return true;
  }

  async transcribeFile(audioUri: string, language?: string): Promise<string> {
    if (!this.context) {
      throw new Error('Whisper model not loaded');
    }

    let audioPath = audioUri;
    try {
      const waveform = await decodeAudioFile(audioUri);
      audioPath = await writeWavFile(waveform);
    } catch (e) {
      console.warn('[WhisperProvider] Audio decode failed, trying raw file path:', e);
    }

    const filePath = audioPath.replace('file://', '');
    const { promise } = this.context.transcribe(filePath, {
      language: language || 'en',
    });
    const result = await promise;
    return (result?.result || '').trim();
  }

  async transcribe(waveform: Float32Array, language?: string): Promise<string> {
    if (!this.context) {
      throw new Error('Whisper model not loaded');
    }
    const wavPath = await writeWavFile(waveform);
    const filePath = wavPath.replace('file://', '');
    const { promise } = this.context.transcribe(filePath, {
      language: language || 'en',
    });
    const result = await promise;
    return (result?.result || '').trim();
  }

  async release(): Promise<void> {
    if (this.context?.release) {
      await this.context.release();
    }
    this.context = null;
    this.loadedModelId = null;
  }
}

export const WhisperSTT = new WhisperProvider();
