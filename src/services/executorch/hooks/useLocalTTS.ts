/**
 * useLocalTTS Hook
 * 
 * React hook for using local text-to-speech via react-native-executorch.
 * Uses Kokoro models for high-quality on-device speech synthesis.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EnhancedTTS, TTS_MODELS, TTS_VOICES, type TTSModelInfo, type VoiceInfo, type SynthesisOptions } from '../TTSProvider';

export interface UseLocalTTSOptions {
  modelId?: string;
  voiceId?: string;
  autoLoad?: boolean;
}

export interface UseLocalTTSReturn {
  // State
  isLoading: boolean;
  isSynthesizing: boolean;
  isReady: boolean;
  error: Error | null;
  downloadProgress: number;
  currentModelId: string | null;
  currentVoiceId: string | null;
  
  // Actions
  loadModel: (modelId: string, voiceId: string) => Promise<boolean>;
  unloadModel: () => void;
  synthesize: (text: string, options?: SynthesisOptions) => Promise<Float32Array>;
  synthesizeStream: (text: string, options?: SynthesisOptions & { onChunk?: (chunk: { audio: Float32Array; sampleRate: number; isLast: boolean }) => void }) => AsyncGenerator<{ audio: Float32Array; sampleRate: number; isLast: boolean }>;
  stopSynthesis: () => void;
  
  // Info
  getAvailableModels: () => string[];
  getAvailableVoices: () => VoiceInfo[];
  getModelInfo: (modelId: string) => TTSModelInfo | null;
  getVoiceInfo: (voiceId: string) => VoiceInfo | null;
  estimateDuration: (text: string, speed?: number) => number;
  fitsTokenLimit: (text: string) => boolean;
  splitIntoChunks: (text: string) => string[];
}

/**
 * React hook for local text-to-speech
 */
export function useLocalTTS(options: UseLocalTTSOptions = {}): UseLocalTTSReturn {
  const { modelId, voiceId, autoLoad = false } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Refs
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      EnhancedTTS.unloadModel();
    };
  }, []);
  
  // Auto-load model if specified
  useEffect(() => {
    if (autoLoad && modelId && voiceId && !isReady) {
      loadModel(modelId, voiceId);
    }
  }, [autoLoad, modelId, voiceId]);
  
  const loadModel = useCallback(async (
    targetModelId: string, 
    targetVoiceId: string
  ): Promise<boolean> => {
    if (isLoading) return false;
    
    setIsLoading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      const success = await EnhancedTTS.loadModel(targetModelId, targetVoiceId, (progress) => {
        if (isMountedRef.current) {
          setDownloadProgress(progress);
        }
      });
      
      if (isMountedRef.current) {
        setIsReady(success);
        setIsLoading(false);
      }
      
      return success;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        setIsReady(false);
      }
      return false;
    }
  }, [isLoading]);
  
  const unloadModel = useCallback(() => {
    EnhancedTTS.unloadModel();
    setIsReady(false);
  }, []);
  
  const synthesize = useCallback(async (
    text: string,
    options?: SynthesisOptions
  ): Promise<Float32Array> => {
    if (!isReady) {
      throw new Error('Model not loaded');
    }
    
    setIsSynthesizing(true);
    setError(null);
    
    try {
      const result = await EnhancedTTS.synthesize(text, options);
      
      if (isMountedRef.current) {
        setIsSynthesizing(false);
      }
      
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsSynthesizing(false);
      }
      throw err;
    }
  }, [isReady]);
  
  const synthesizeStream = useCallback(async function* (
    text: string,
    options?: SynthesisOptions & { onChunk?: (chunk: { audio: Float32Array; sampleRate: number; isLast: boolean }) => void }
  ): AsyncGenerator<{ audio: Float32Array; sampleRate: number; isLast: boolean }> {
    if (!isReady) {
      throw new Error('Model not loaded');
    }
    
    setIsSynthesizing(true);
    setError(null);
    
    try {
      for await (const chunk of EnhancedTTS.synthesizeStream(text, options)) {
        yield chunk;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(error);
      }
      throw error;
    } finally {
      if (isMountedRef.current) {
        setIsSynthesizing(false);
      }
    }
  }, [isReady]);
  
  const stopSynthesis = useCallback(() => {
    EnhancedTTS.stopSynthesis();
    setIsSynthesizing(false);
  }, []);
  
  const getAvailableModels = useCallback(() => {
    return Object.keys(TTS_MODELS);
  }, []);
  
  const getAvailableVoices = useCallback(() => {
    return Object.values(TTS_VOICES);
  }, []);
  
  const getModelInfo = useCallback((id: string) => {
    return EnhancedTTS.getModelInfo(id);
  }, []);
  
  const getVoiceInfo = useCallback((id: string) => {
    return EnhancedTTS.getVoiceInfo(id);
  }, []);
  
  const estimateDuration = useCallback((text: string, speed?: number) => {
    return EnhancedTTS.estimateDuration(text, speed);
  }, []);
  
  const fitsTokenLimit = useCallback((text: string) => {
    return EnhancedTTS.fitsTokenLimit(text);
  }, []);
  
  const splitIntoChunks = useCallback((text: string) => {
    return EnhancedTTS.splitIntoChunks(text);
  }, []);
  
  const currentModelId = EnhancedTTS.getCurrentModelId();
  const currentVoiceId = EnhancedTTS.getCurrentVoiceId();
  
  return {
    // State
    isLoading,
    isSynthesizing,
    isReady,
    error,
    downloadProgress,
    currentModelId,
    currentVoiceId,
    
    // Actions
    loadModel,
    unloadModel,
    synthesize,
    synthesizeStream,
    stopSynthesis,
    
    // Info
    getAvailableModels,
    getAvailableVoices,
    getModelInfo,
    getVoiceInfo,
    estimateDuration,
    fitsTokenLimit,
    splitIntoChunks,
  };
}
