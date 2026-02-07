/**
 * Enhanced Executorch TTS Provider
 * 
 * A project-specific wrapper around react-native-executorch's Text-to-Speech capabilities
 * using Kokoro models for high-quality on-device speech synthesis.
 */

import { isExpoGo } from '../../utils/isExpoGo';
import {
  TextToSpeechModule,
  KOKORO_SMALL,
  KOKORO_MEDIUM,
  KOKORO_VOICE_AF_HEART,
  KOKORO_VOICE_AF_RIVER,
  KOKORO_VOICE_AF_SARAH,
  KOKORO_VOICE_AM_ADAM,
  KOKORO_VOICE_AM_MICHAEL,
  KOKORO_VOICE_AM_SANTA,
  KOKORO_VOICE_BF_EMMA,
  KOKORO_VOICE_BM_DANIEL,
  type VoiceConfig,
} from 'react-native-executorch';

/** TTS Model information */
export interface TTSModelInfo {
  id: string;
  name: string;
  description: string;
  sizeMB: number;
  maxTokens: number;
  recommended: boolean;
  modelSource: {
    type: 'kokoro';
    durationPredictorSource: string;
    synthesizerSource: string;
  };
}

/** Voice information */
export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: 'us' | 'gb';
  description: string;
  voiceConfig: VoiceConfig;
}

/** Available TTS models */
export const TTS_MODELS: Record<string, TTSModelInfo> = {
  'kokoro-small': {
    id: 'kokoro-small',
    name: 'Kokoro Small',
    description: 'Processes in batches of 64 tokens, lower memory usage',
    sizeMB: 80,
    maxTokens: 64,
    recommended: true,
    modelSource: KOKORO_SMALL,
  },
  'kokoro-medium': {
    id: 'kokoro-medium',
    name: 'Kokoro Medium',
    description: 'Processes in batches of 128 tokens, better quality',
    sizeMB: 150,
    maxTokens: 128,
    recommended: true,
    modelSource: KOKORO_MEDIUM,
  },
};

/** Available voices */
export const TTS_VOICES: Record<string, VoiceInfo> = {
  'af-heart': {
    id: 'af-heart',
    name: 'Heart (Female US)',
    gender: 'female',
    accent: 'us',
    description: 'Warm, natural female US voice',
    voiceConfig: KOKORO_VOICE_AF_HEART,
  },
  'af-river': {
    id: 'af-river',
    name: 'River (Female US)',
    gender: 'female',
    accent: 'us',
    description: 'Clear, professional female US voice',
    voiceConfig: KOKORO_VOICE_AF_RIVER,
  },
  'af-sarah': {
    id: 'af-sarah',
    name: 'Sarah (Female US)',
    gender: 'female',
    accent: 'us',
    description: 'Friendly, conversational female US voice',
    voiceConfig: KOKORO_VOICE_AF_SARAH,
  },
  'am-adam': {
    id: 'am-adam',
    name: 'Adam (Male US)',
    gender: 'male',
    accent: 'us',
    description: 'Natural, approachable male US voice',
    voiceConfig: KOKORO_VOICE_AM_ADAM,
  },
  'am-michael': {
    id: 'am-michael',
    name: 'Michael (Male US)',
    gender: 'male',
    accent: 'us',
    description: 'Professional, authoritative male US voice',
    voiceConfig: KOKORO_VOICE_AM_MICHAEL,
  },
  'am-santa': {
    id: 'am-santa',
    name: 'Santa (Male US)',
    gender: 'male',
    accent: 'us',
    description: 'Deep, festive male US voice',
    voiceConfig: KOKORO_VOICE_AM_SANTA,
  },
  'bf-emma': {
    id: 'bf-emma',
    name: 'Emma (Female UK)',
    gender: 'female',
    accent: 'gb',
    description: 'Elegant British female voice',
    voiceConfig: KOKORO_VOICE_BF_EMMA,
  },
  'bm-daniel': {
    id: 'bm-daniel',
    name: 'Daniel (Male UK)',
    gender: 'male',
    accent: 'gb',
    description: 'Refined British male voice',
    voiceConfig: KOKORO_VOICE_BM_DANIEL,
  },
};

/** Synthesis options */
export interface SynthesisOptions {
  speed?: number; // 0.5 to 2.0, default 1.0
  voiceId?: string;
}

/** Audio chunk callback for streaming */
export interface AudioChunk {
  audio: Float32Array;
  sampleRate: number;
  isLast: boolean;
}

/** Enhanced Executorch TTS Provider */
export class EnhancedExecutorchTTSProvider {
  private ttsModule: TextToSpeechModule | null = null;
  private currentModelId: string | null = null;
  private currentVoiceId: string | null = null;
  private isLoading = false;

  get id() {
    return 'executorch_tts_enhanced' as const;
  }

  get name() {
    return 'ExecuTorch TTS (Kokoro)';
  }

  /** Check if ExecuTorch is available */
  isSupported(): boolean {
    return !isExpoGo();
  }

  /** Get all available model IDs */
  getAvailableModels(): string[] {
    return Object.keys(TTS_MODELS);
  }

  /** Get model info by ID */
  getModelInfo(modelId: string): TTSModelInfo | null {
    return TTS_MODELS[modelId] || null;
  }

  /** Get all available voices */
  getAvailableVoices(): VoiceInfo[] {
    return Object.values(TTS_VOICES);
  }

  /** Get voices by gender */
  getVoicesByGender(gender: 'male' | 'female'): VoiceInfo[] {
    return Object.values(TTS_VOICES).filter(v => v.gender === gender);
  }

  /** Get voices by accent */
  getVoicesByAccent(accent: 'us' | 'gb'): VoiceInfo[] {
    return Object.values(TTS_VOICES).filter(v => v.accent === accent);
  }

  /** Get voice info by ID */
  getVoiceInfo(voiceId: string): VoiceInfo | null {
    return TTS_VOICES[voiceId] || null;
  }

  /** Load a model with a specific voice */
  async loadModel(
    modelId: string,
    voiceId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (this.isLoading) {
      throw new Error('Model is already loading');
    }

    const modelInfo = TTS_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const voiceInfo = TTS_VOICES[voiceId];
    if (!voiceInfo) {
      throw new Error(`Unknown voice: ${voiceId}`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    this.isLoading = true;

    try {
      // Clean up previous model
      if (this.ttsModule) {
        this.ttsModule.delete();
        this.ttsModule = null;
      }

      // Create new TTS module
      this.ttsModule = new TextToSpeechModule();

      // Load the model with voice
      await this.ttsModule.load(
        {
          model: modelInfo.modelSource,
          voice: voiceInfo.voiceConfig,
        },
        onProgress
      );

      this.currentModelId = modelId;
      this.currentVoiceId = voiceId;
      console.log(`[EnhancedTTS] Loaded model: ${modelInfo.name} with voice: ${voiceInfo.name}`);
      return true;
    } catch (error) {
      console.error('[EnhancedTTS] Failed to load model:', error);
      this.ttsModule = null;
      this.currentModelId = null;
      this.currentVoiceId = null;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /** Unload the current model */
  unloadModel(): void {
    if (this.ttsModule) {
      this.ttsModule.delete();
      this.ttsModule = null;
      this.currentModelId = null;
      this.currentVoiceId = null;
      console.log('[EnhancedTTS] Model unloaded');
    }
  }

  /** Check if a model is loaded */
  isModelLoaded(): boolean {
    return this.ttsModule !== null && this.currentModelId !== null;
  }

  /** Get the currently loaded model ID */
  getCurrentModelId(): string | null {
    return this.currentModelId;
  }

  /** Get the currently loaded voice ID */
  getCurrentVoiceId(): string | null {
    return this.currentVoiceId;
  }

  /**
   * Synthesize speech from text
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Audio data as Float32Array at 24kHz
   */
  async synthesize(
    text: string,
    options: SynthesisOptions = {}
  ): Promise<Float32Array> {
    if (!this.ttsModule) {
      throw new Error('No model loaded');
    }

    const result = await this.ttsModule.forward({
      text,
      speed: options.speed ?? 1.0,
    });

    return result;
  }

  /**
   * Stream speech synthesis
   * @param text Text to synthesize
   * @param options Synthesis options with callbacks
   */
  async *synthesizeStream(
    text: string,
    options: SynthesisOptions & {
      onChunk?: (chunk: AudioChunk) => void;
    } = {}
  ): AsyncGenerator<AudioChunk> {
    if (!this.ttsModule) {
      throw new Error('No model loaded');
    }

    const stream = this.ttsModule.stream({
      text,
      speed: options.speed ?? 1.0,
    });

    for await (const audio of stream) {
      const chunk: AudioChunk = {
        audio,
        sampleRate: 24000, // Kokoro outputs 24kHz
        isLast: false,
      };
      options.onChunk?.(chunk);
      yield chunk;
    }

    // Yield final chunk
    yield {
      audio: new Float32Array(0),
      sampleRate: 24000,
      isLast: true,
    };
  }

  /** Stop streaming synthesis */
  stopSynthesis(): void {
    if (this.ttsModule) {
      this.ttsModule.streamStop();
    }
  }

  /**
   * Estimate the duration of synthesized speech
   * @param text Text to estimate
   * @param speed Speech speed multiplier
   * @returns Estimated duration in seconds
   */
  estimateDuration(text: string, speed: number = 1.0): number {
    // Rough estimate: ~13 characters per second at speed 1.0
    const charsPerSecond = 13 / speed;
    return text.length / charsPerSecond;
  }

  /**
   * Check if text fits within model's token limit
   * @param text Text to check
   * @param modelId Model ID (uses current if not specified)
   */
  fitsTokenLimit(text: string, modelId?: string): boolean {
    const targetModelId = modelId || this.currentModelId;
    if (!targetModelId) return false;
    
    const modelInfo = TTS_MODELS[targetModelId];
    if (!modelInfo) return false;

    // Rough token estimate: ~4 characters per token
    const estimatedTokens = Math.ceil(text.length / 4);
    return estimatedTokens <= modelInfo.maxTokens;
  }

  /**
   * Split text into chunks that fit within token limit
   * @param text Text to split
   * @param modelId Model ID (uses current if not specified)
   */
  splitIntoChunks(text: string, modelId?: string): string[] {
    const targetModelId = modelId || this.currentModelId;
    if (!targetModelId) return [text];

    const modelInfo = TTS_MODELS[targetModelId];
    if (!modelInfo) return [text];

    const maxChars = modelInfo.maxTokens * 4;
    const chunks: string[] = [];
    
    // Split by sentences first
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChars) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.length > 0 ? chunks : [text];
  }
}

// Export singleton instance
export const EnhancedTTS = new EnhancedExecutorchTTSProvider();
