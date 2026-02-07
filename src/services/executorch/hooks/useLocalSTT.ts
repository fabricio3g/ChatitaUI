/**
 * useLocalSTT Hook
 * 
 * React hook for using local speech-to-text via react-native-executorch.
 * Uses Whisper models for on-device transcription.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EnhancedSTT, STT_MODELS, type STTModelInfo, type TranscriptionResult, type TranscriptionOptions } from '../STTProvider';

export interface UseLocalSTTOptions {
  modelId?: string;
  autoLoad?: boolean;
}

export interface UseLocalSTTReturn {
  // State
  isLoading: boolean;
  isTranscribing: boolean;
  isReady: boolean;
  error: Error | null;
  downloadProgress: number;
  currentModelId: string | null;
  
  // Actions
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: () => void;
  transcribe: (waveform: Float32Array, options?: TranscriptionOptions) => Promise<string>;
  transcribeStream: (waveform: Float32Array, options?: TranscriptionOptions) => AsyncGenerator<TranscriptionResult>;
  
  // Info
  getAvailableModels: () => string[];
  getModelInfo: (modelId: string) => STTModelInfo | null;
  supportsLanguage: (language: string) => boolean;
}

/**
 * React hook for local speech-to-text
 */
export function useLocalSTT(options: UseLocalSTTOptions = {}): UseLocalSTTReturn {
  const { modelId, autoLoad = false } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      EnhancedSTT.unloadModel();
    };
  }, []);
  
  // Auto-load model if specified
  useEffect(() => {
    if (autoLoad && modelId && !isReady) {
      loadModel(modelId);
    }
  }, [autoLoad, modelId]);
  
  const loadModel = useCallback(async (targetModelId: string): Promise<boolean> => {
    if (isLoading) return false;
    
    setIsLoading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      const success = await EnhancedSTT.loadModel(targetModelId, (progress) => {
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
    EnhancedSTT.unloadModel();
    setIsReady(false);
  }, []);
  
  const transcribe = useCallback(async (
    waveform: Float32Array,
    options?: TranscriptionOptions
  ): Promise<string> => {
    if (!isReady) {
      throw new Error('Model not loaded');
    }
    
    setIsTranscribing(true);
    setError(null);
    
    try {
      const result = await EnhancedSTT.transcribe(waveform, options);
      
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
      
      return result.text;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsTranscribing(false);
      }
      throw err;
    }
  }, [isReady]);
  
  const transcribeStream = useCallback(async function* (
    waveform: Float32Array,
    options?: TranscriptionOptions
  ): AsyncGenerator<TranscriptionResult> {
    if (!isReady) {
      yield { text: '', error: 'Model not loaded' };
      return;
    }
    
    setIsTranscribing(true);
    setError(null);
    
    abortControllerRef.current = new AbortController();
    
    try {
      for await (const result of EnhancedSTT.transcribeStream(waveform, options)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        yield result;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(error);
      }
      yield { text: '', error: error.message };
    } finally {
      if (isMountedRef.current) {
        setIsTranscribing(false);
      }
    }
  }, [isReady]);
  
  const getAvailableModels = useCallback(() => {
    return EnhancedSTT.getAvailableModels();
  }, []);
  
  const getModelInfo = useCallback((id: string) => {
    return EnhancedSTT.getModelInfo(id);
  }, []);
  
  const supportsLanguage = useCallback((language: string) => {
    return EnhancedSTT.supportsLanguage(language);
  }, []);
  
  const currentModelId = EnhancedSTT.getCurrentModelId();
  
  return {
    // State
    isLoading,
    isTranscribing,
    isReady,
    error,
    downloadProgress,
    currentModelId,
    
    // Actions
    loadModel,
    unloadModel,
    transcribe,
    transcribeStream,
    
    // Info
    getAvailableModels,
    getModelInfo,
    supportsLanguage,
  };
}
