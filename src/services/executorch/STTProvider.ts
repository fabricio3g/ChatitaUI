/**
 * Enhanced Executorch STT Provider
 * 
 * A project-specific wrapper around react-native-executorch's Speech-to-Text capabilities
 * using Whisper models for on-device transcription.
 */

import { isExpoGo } from '../../utils/isExpoGo';
import {
  SpeechToTextModule,
  WHISPER_TINY,
  WHISPER_TINY_EN,
  WHISPER_TINY_EN_QUANTIZED,
  WHISPER_BASE,
  WHISPER_BASE_EN,
  WHISPER_SMALL,
  WHISPER_SMALL_EN,
  type DecodingOptions,
  type SpeechToTextLanguage,
} from 'react-native-executorch';

/** Model information metadata */
export interface STTModelInfo {
  id: string;
  name: string;
  description: string;
  sizeMB: number;
  isMultilingual: boolean;
  recommended: boolean;
  modelSource: {
    isMultilingual: boolean;
    encoderSource: string;
    decoderSource: string;
    tokenizerSource: string;
  };
}

/** Available STT models */
export const STT_MODELS: Record<string, STTModelInfo> = {
  'whisper-tiny-en-q': {
    id: 'whisper-tiny-en-q',
    name: 'Whisper Tiny EN Quantized',
    description: 'Fastest, English only, lowest memory',
    sizeMB: 25,
    isMultilingual: false,
    recommended: true,
    modelSource: WHISPER_TINY_EN_QUANTIZED,
  },
  'whisper-tiny-en': {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny EN',
    description: 'Fast, English only',
    sizeMB: 40,
    isMultilingual: false,
    recommended: false,
    modelSource: WHISPER_TINY_EN,
  },
  'whisper-tiny': {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    description: 'Fast, supports multiple languages',
    sizeMB: 40,
    isMultilingual: true,
    recommended: true,
    modelSource: WHISPER_TINY,
  },
  'whisper-base-en': {
    id: 'whisper-base-en',
    name: 'Whisper Base EN',
    description: 'Better accuracy, English only',
    sizeMB: 75,
    isMultilingual: false,
    recommended: false,
    modelSource: WHISPER_BASE_EN,
  },
  'whisper-base': {
    id: 'whisper-base',
    name: 'Whisper Base',
    description: 'Good balance of speed and accuracy',
    sizeMB: 75,
    isMultilingual: true,
    recommended: true,
    modelSource: WHISPER_BASE,
  },
  'whisper-small-en': {
    id: 'whisper-small-en',
    name: 'Whisper Small EN',
    description: 'Best accuracy, English only',
    sizeMB: 250,
    isMultilingual: false,
    recommended: false,
    modelSource: WHISPER_SMALL_EN,
  },
  'whisper-small': {
    id: 'whisper-small',
    name: 'Whisper Small',
    description: 'Best accuracy, multilingual',
    sizeMB: 250,
    isMultilingual: true,
    recommended: false,
    modelSource: WHISPER_SMALL,
  },
};

/** Transcription result */
export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/** Transcription options */
export interface TranscriptionOptions {
  language?: SpeechToTextLanguage;
  task?: 'transcribe' | 'translate';
  temperature?: number;
  maxLength?: number;
  prompt?: string;
}

/** Enhanced Executorch STT Provider */
export class EnhancedExecutorchSTTProvider {
  private sttModule: SpeechToTextModule | null = null;
  private currentModelId: string | null = null;
  private isLoading = false;

  get id() {
    return 'executorch_stt_enhanced' as const;
  }

  get name() {
    return 'ExecuTorch STT (Whisper)';
  }

  /** Check if ExecuTorch is available */
  isSupported(): boolean {
    return !isExpoGo();
  }

  /** Get all available model IDs */
  getAvailableModels(): string[] {
    return Object.keys(STT_MODELS);
  }

  /** Get model info by ID */
  getModelInfo(modelId: string): STTModelInfo | null {
    return STT_MODELS[modelId] || null;
  }

  /** Get recommended models */
  getRecommendedModels(): STTModelInfo[] {
    return Object.values(STT_MODELS).filter(m => m.recommended);
  }

  /** Check if currently loaded model supports the given language */
  supportsLanguage(language: string): boolean {
    if (!this.currentModelId) return false;
    const model = STT_MODELS[this.currentModelId];
    if (!model) return false;
    return model.isMultilingual || language === 'en';
  }

  /** Load a model by ID */
  async loadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (this.isLoading) {
      throw new Error('Model is already loading');
    }

    const modelInfo = STT_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    this.isLoading = true;

    try {
      // Clean up previous model
      if (this.sttModule) {
        this.sttModule.delete();
        this.sttModule = null;
      }

      // Create new STT module
      this.sttModule = new SpeechToTextModule();

      // Load the model
      await this.sttModule.load(
        {
          isMultilingual: modelInfo.modelSource.isMultilingual,
          encoderSource: modelInfo.modelSource.encoderSource,
          decoderSource: modelInfo.modelSource.decoderSource,
          tokenizerSource: modelInfo.modelSource.tokenizerSource,
        },
        onProgress
      );

      this.currentModelId = modelId;
      console.log(`[EnhancedSTT] Loaded model: ${modelInfo.name}`);
      return true;
    } catch (error) {
      console.error('[EnhancedSTT] Failed to load model:', error);
      this.sttModule = null;
      this.currentModelId = null;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /** Unload the current model */
  unloadModel(): void {
    if (this.sttModule) {
      this.sttModule.delete();
      this.sttModule = null;
      this.currentModelId = null;
      console.log('[EnhancedSTT] Model unloaded');
    }
  }

  /** Check if a model is loaded */
  isModelLoaded(): boolean {
    return this.sttModule !== null && this.currentModelId !== null;
  }

  /** Get the currently loaded model ID */
  getCurrentModelId(): string | null {
    return this.currentModelId;
  }

  /**
   * Transcribe audio waveform
   * @param waveform Float32Array of audio samples at 16kHz
   * @param options Transcription options
   */
  async transcribe(
    waveform: Float32Array,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.sttModule) {
      throw new Error('No model loaded');
    }

    const decodingOptions: DecodingOptions = {
      language: options.language,
      task: options.task,
      temperature: options.temperature,
      maxLength: options.maxLength,
      prompt: options.prompt,
    };

    const result = await this.sttModule.transcribe(waveform, decodingOptions);

    return {
      text: result,
    };
  }

  /**
   * Stream transcription results
   * @param waveform Float32Array of audio samples at 16kHz
   * @param options Transcription options
   */
  async *transcribeStream(
    waveform: Float32Array,
    options: TranscriptionOptions = {}
  ): AsyncGenerator<TranscriptionResult> {
    // Whisper models don't support true streaming, but we simulate it
    // by yielding partial results
    if (!this.sttModule) {
      throw new Error('No model loaded');
    }

    // For now, just yield the final result
    // Future: Implement chunk-based streaming
    const result = await this.transcribe(waveform, options);
    yield result;
  }

  /**
   * Transcribe from a file URI
   * Note: Audio must be decoded to 16kHz Float32Array first
   */
  async transcribeFromFile(
    fileUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    // This would require audio decoding
    // For now, throw an error directing to use transcribe with decoded audio
    throw new Error(
      'Direct file transcription not supported. ' +
      'Use AudioDecoderWebView to decode audio to 16kHz Float32Array, then call transcribe()'
    );
  }
}

// Export singleton instance
export const EnhancedSTT = new EnhancedExecutorchSTTProvider();
