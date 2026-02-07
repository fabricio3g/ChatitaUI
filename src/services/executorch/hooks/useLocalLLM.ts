/**
 * useLocalLLM Hook
 * 
 * A React hook for using local LLM models via react-native-executorch.
 * Provides a simple interface for text generation with streaming support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EnhancedLLM, LLM_MODELS, type ModelInfo, type StreamChunk } from '../LLMProvider';
import type { LLMConfig, LLMTool } from 'react-native-executorch';
import type { Message } from '../../../types/message';

export interface UseLocalLLMOptions {
  modelId?: string;
  autoLoad?: boolean;
}

export interface UseLocalLLMReturn {
  // State
  isLoading: boolean;
  isGenerating: boolean;
  isReady: boolean;
  error: Error | null;
  downloadProgress: number;
  currentModelId: string | null;
  
  // Response
  response: string;
  messageHistory: Message[];
  
  // Actions
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: () => void;
  generate: (messages: Message[], config?: LLMConfig) => Promise<string>;
  generateStream: (messages: Message[], config?: LLMConfig) => AsyncGenerator<StreamChunk>;
  sendMessage: (message: string) => Promise<string>;
  interrupt: () => void;
  clearResponse: () => void;
  
  // Info
  getAvailableModels: () => string[];
  getModelInfo: (modelId: string) => ModelInfo | null;
  supportsTools: (modelId?: string) => boolean;
}

/**
 * React hook for local LLM inference
 */
export function useLocalLLM(options: UseLocalLLMOptions = {}): UseLocalLLMReturn {
  const { modelId, autoLoad = false } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [response, setResponse] = useState('');
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      EnhancedLLM.unloadModel();
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
      const success = await EnhancedLLM.loadModel(targetModelId, (progress) => {
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
    EnhancedLLM.unloadModel();
    setIsReady(false);
    setResponse('');
    setMessageHistory([]);
  }, []);
  
  const generate = useCallback(async (
    messages: Message[],
    config?: LLMConfig
  ): Promise<string> => {
    if (!isReady) {
      throw new Error('Model not loaded');
    }
    
    setIsGenerating(true);
    setError(null);
    setResponse('');
    
    try {
      const result = await EnhancedLLM.generate(messages, config);
      
      if (isMountedRef.current) {
        setResponse(result.text);
        setIsGenerating(false);
      }
      
      return result.text;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsGenerating(false);
      }
      throw err;
    }
  }, [isReady]);
  
  const generateStream = useCallback(async function* (
    messages: Message[],
    config?: LLMConfig
  ): AsyncGenerator<StreamChunk> {
    if (!isReady) {
      yield { error: 'Model not loaded', done: true };
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setResponse('');
    
    abortControllerRef.current = new AbortController();
    
    try {
      let fullText = '';
      
      for await (const chunk of EnhancedLLM.chatStream(messages, config)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        if (chunk.text && isMountedRef.current) {
          fullText += chunk.text;
          setResponse(fullText);
        }
        
        yield chunk;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(error);
      }
      yield { error: error.message, done: true };
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [isReady]);
  
  const sendMessage = useCallback(async (message: string): Promise<string> => {
    if (!isReady) {
      throw new Error('Model not loaded');
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await EnhancedLLM.sendMessage(message);
      
      if (isMountedRef.current) {
        setResponse(response);
        setIsGenerating(false);
      }
      
      return response;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsGenerating(false);
      }
      throw err;
    }
  }, [isReady]);
  
  const interrupt = useCallback(() => {
    abortControllerRef.current?.abort();
    EnhancedLLM.interrupt();
    setIsGenerating(false);
  }, []);
  
  const clearResponse = useCallback(() => {
    setResponse('');
  }, []);
  
  const getAvailableModels = useCallback(() => {
    return EnhancedLLM.getAvailableModels();
  }, []);
  
  const getModelInfo = useCallback((id: string) => {
    return EnhancedLLM.getModelInfo(id);
  }, []);
  
  const supportsTools = useCallback((id?: string) => {
    return EnhancedLLM.supportsTools(id || currentModelId || '');
  }, [currentModelId]);
  
  const currentModelId = EnhancedLLM.getCurrentModelId();
  
  return {
    // State
    isLoading,
    isGenerating,
    isReady,
    error,
    downloadProgress,
    currentModelId,
    
    // Response
    response,
    messageHistory,
    
    // Actions
    loadModel,
    unloadModel,
    generate,
    generateStream,
    sendMessage,
    interrupt,
    clearResponse,
    
    // Info
    getAvailableModels,
    getModelInfo,
    supportsTools,
  };
}
