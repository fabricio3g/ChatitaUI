/**
 * useExecutorchEmbeddings Hook
 * 
 * React hook for using text and image embeddings via react-native-executorch.
 * Useful for semantic search, RAG, and similarity matching.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EmbeddingsProvider, EMBEDDING_MODELS, type EmbeddingModelInfo, type EmbeddingType } from '../EmbeddingsProvider';

export interface UseExecutorchEmbeddingsOptions {
  textModelId?: string;
  imageModelId?: string;
  autoLoad?: boolean;
}

export interface UseExecutorchEmbeddingsReturn {
  // State
  isLoading: boolean;
  isEmbedding: boolean;
  isTextModelReady: boolean;
  isImageModelReady: boolean;
  error: Error | null;
  downloadProgress: number;
  loadedTextModel: string | null;
  loadedImageModel: string | null;
  
  // Actions
  loadTextModel: (modelId: string) => Promise<boolean>;
  loadImageModel: (modelId: string) => Promise<boolean>;
  unloadTextModel: () => void;
  unloadImageModel: () => void;
  unloadAll: () => void;
  embedText: (text: string) => Promise<Float32Array>;
  embedTexts: (texts: string[]) => Promise<Float32Array[]>;
  embedImage: (imageUri: string) => Promise<Float32Array>;
  
  // Similarity
  cosineSimilarity: (a: Float32Array, b: Float32Array) => number;
  dotProduct: (a: Float32Array, b: Float32Array) => number;
  euclideanDistance: (a: Float32Array, b: Float32Array) => number;
  findMostSimilar: (query: Float32Array, candidates: Float32Array[], topK?: number) => Array<{ index: number; score: number }>;
  
  // Info
  getAvailableModels: (type?: EmbeddingType) => EmbeddingModelInfo[];
  getModelInfo: (modelId: string) => EmbeddingModelInfo | null;
}

/**
 * React hook for embeddings
 */
export function useExecutorchEmbeddings(options: UseExecutorchEmbeddingsOptions = {}): UseExecutorchEmbeddingsReturn {
  const { textModelId, imageModelId, autoLoad = false } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [isTextModelReady, setIsTextModelReady] = useState(false);
  const [isImageModelReady, setIsImageModelReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadedTextModel, setLoadedTextModel] = useState<string | null>(null);
  const [loadedImageModel, setLoadedImageModel] = useState<string | null>(null);
  
  // Refs
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      EmbeddingsProvider.unloadAll();
    };
  }, []);
  
  // Auto-load models if specified
  useEffect(() => {
    if (autoLoad) {
      if (textModelId && !isTextModelReady) {
        loadTextModel(textModelId);
      }
      if (imageModelId && !isImageModelReady) {
        loadImageModel(imageModelId);
      }
    }
  }, [autoLoad, textModelId, imageModelId]);
  
  const loadTextModel = useCallback(async (targetModelId: string): Promise<boolean> => {
    if (isLoading) return false;
    
    setIsLoading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      const success = await EmbeddingsProvider.loadTextModel(targetModelId, (progress) => {
        if (isMountedRef.current) {
          setDownloadProgress(progress);
        }
      });
      
      if (isMountedRef.current) {
        setIsTextModelReady(success);
        setLoadedTextModel(success ? targetModelId : null);
        setIsLoading(false);
      }
      
      return success;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        setIsTextModelReady(false);
      }
      return false;
    }
  }, [isLoading]);
  
  const loadImageModel = useCallback(async (targetModelId: string): Promise<boolean> => {
    if (isLoading) return false;
    
    setIsLoading(true);
    setError(null);
    setDownloadProgress(0);
    
    try {
      const success = await EmbeddingsProvider.loadImageModel(targetModelId, (progress) => {
        if (isMountedRef.current) {
          setDownloadProgress(progress);
        }
      });
      
      if (isMountedRef.current) {
        setIsImageModelReady(success);
        setLoadedImageModel(success ? targetModelId : null);
        setIsLoading(false);
      }
      
      return success;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        setIsImageModelReady(false);
      }
      return false;
    }
  }, [isLoading]);
  
  const unloadTextModel = useCallback(() => {
    EmbeddingsProvider.unloadTextModel();
    setIsTextModelReady(false);
    setLoadedTextModel(null);
  }, []);
  
  const unloadImageModel = useCallback(() => {
    EmbeddingsProvider.unloadImageModel();
    setIsImageModelReady(false);
    setLoadedImageModel(null);
  }, []);
  
  const unloadAll = useCallback(() => {
    EmbeddingsProvider.unloadAll();
    setIsTextModelReady(false);
    setIsImageModelReady(false);
    setLoadedTextModel(null);
    setLoadedImageModel(null);
  }, []);
  
  const embedText = useCallback(async (text: string): Promise<Float32Array> => {
    setIsEmbedding(true);
    setError(null);
    
    try {
      const result = await EmbeddingsProvider.embedText(text);
      if (isMountedRef.current) setIsEmbedding(false);
      return result.embedding;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsEmbedding(false);
      }
      throw err;
    }
  }, []);
  
  const embedTexts = useCallback(async (texts: string[]): Promise<Float32Array[]> => {
    setIsEmbedding(true);
    setError(null);
    
    try {
      const result = await EmbeddingsProvider.embedTexts(texts);
      if (isMountedRef.current) setIsEmbedding(false);
      return result.embeddings;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsEmbedding(false);
      }
      throw err;
    }
  }, []);
  
  const embedImage = useCallback(async (imageUri: string): Promise<Float32Array> => {
    setIsEmbedding(true);
    setError(null);
    
    try {
      const result = await EmbeddingsProvider.embedImage(imageUri);
      if (isMountedRef.current) setIsEmbedding(false);
      return result.embedding;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsEmbedding(false);
      }
      throw err;
    }
  }, []);
  
  const cosineSimilarity = useCallback((a: Float32Array, b: Float32Array): number => {
    return EmbeddingsProvider.cosineSimilarity(a, b);
  }, []);
  
  const dotProduct = useCallback((a: Float32Array, b: Float32Array): number => {
    return EmbeddingsProvider.dotProduct(a, b);
  }, []);
  
  const euclideanDistance = useCallback((a: Float32Array, b: Float32Array): number => {
    return EmbeddingsProvider.euclideanDistance(a, b);
  }, []);
  
  const findMostSimilar = useCallback((query: Float32Array, candidates: Float32Array[], topK?: number) => {
    return EmbeddingsProvider.findMostSimilar(query, candidates, topK);
  }, []);
  
  const getAvailableModels = useCallback((type?: EmbeddingType) => {
    return EmbeddingsProvider.getAvailableModels(type);
  }, []);
  
  const getModelInfo = useCallback((id: string) => {
    return EmbeddingsProvider.getModelInfo(id);
  }, []);
  
  return {
    // State
    isLoading,
    isEmbedding,
    isTextModelReady,
    isImageModelReady,
    error,
    downloadProgress,
    loadedTextModel,
    loadedImageModel,
    
    // Actions
    loadTextModel,
    loadImageModel,
    unloadTextModel,
    unloadImageModel,
    unloadAll,
    embedText,
    embedTexts,
    embedImage,
    
    // Similarity
    cosineSimilarity,
    dotProduct,
    euclideanDistance,
    findMostSimilar,
    
    // Info
    getAvailableModels,
    getModelInfo,
  };
}
