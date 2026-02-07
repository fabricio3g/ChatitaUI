/**
 * useExecutorchVision Hook
 * 
 * React hook for using computer vision models via react-native-executorch.
 * Supports classification, object detection, OCR, segmentation, and style transfer.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VisionProvider, VISION_MODELS, type VisionTask, type VisionModelInfo } from '../VisionProvider';

export interface UseExecutorchVisionOptions {
  autoLoad?: boolean;
  modelId?: string;
}

export interface UseExecutorchVisionReturn {
  // State
  isLoading: boolean;
  isProcessing: boolean;
  isReady: boolean;
  error: Error | null;
  downloadProgress: number;
  loadedTask: VisionTask | null;
  
  // Actions
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: () => void;
  classify: (imageUri: string) => Promise<Array<{ label: string; confidence: number }>>;
  detectObjects: (imageUri: string) => Promise<{ detections: Array<{ label: string; confidence: number; bbox: { x1: number; y1: number; x2: number; y2: number } }> }>;
  recognizeText: (imageUri: string) => Promise<{ text: string; detections: Array<{ text: string; bbox: { x1: number; y1: number; x2: number; y2: number } }> }>;
  recognizeVerticalText: (imageUri: string, independentCharacters?: boolean) => Promise<{ text: string; detections: Array<{ text: string; bbox: { x1: number; y1: number; x2: number; y2: number } }> }>;
  segment: (imageUri: string) => Promise<{ segments: Array<{ label: string; mask: string }>; mask: string }>;
  transferStyle: (imageUri: string) => Promise<{ image: string }>;
  
  // Info
  getModelsForTask: (task: VisionTask) => VisionModelInfo[];
  getModelInfo: (modelId: string) => VisionModelInfo | null;
}

/**
 * React hook for computer vision tasks
 */
export function useExecutorchVision(options: UseExecutorchVisionOptions = {}): UseExecutorchVisionReturn {
  const { autoLoad = false, modelId } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadedTask, setLoadedTask] = useState<VisionTask | null>(null);
  
  // Refs
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      VisionProvider.unloadAll();
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
      const success = await VisionProvider.loadModel(targetModelId, (progress) => {
        if (isMountedRef.current) {
          setDownloadProgress(progress);
        }
      });
      
      if (isMountedRef.current) {
        const modelInfo = VisionProvider.getModelInfo(targetModelId);
        setLoadedTask(modelInfo?.task || null);
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
    VisionProvider.unloadAll();
    setIsReady(false);
    setLoadedTask(null);
  }, []);
  
  const classify = useCallback(async (imageUri: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.classify(imageUri);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const detectObjects = useCallback(async (imageUri: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.detectObjects(imageUri);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const recognizeText = useCallback(async (imageUri: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.recognizeText(imageUri);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const recognizeVerticalText = useCallback(async (imageUri: string, independentCharacters?: boolean) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.recognizeVerticalText(imageUri, independentCharacters);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const segment = useCallback(async (imageUri: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.segment(imageUri);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const transferStyle = useCallback(async (imageUri: string) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await VisionProvider.transferStyle(imageUri);
      if (isMountedRef.current) setIsProcessing(false);
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsProcessing(false);
      }
      throw err;
    }
  }, []);
  
  const getModelsForTask = useCallback((task: VisionTask) => {
    return VisionProvider.getModelsForTask(task);
  }, []);
  
  const getModelInfo = useCallback((id: string) => {
    return VisionProvider.getModelInfo(id);
  }, []);
  
  return {
    // State
    isLoading,
    isProcessing,
    isReady,
    error,
    downloadProgress,
    loadedTask,
    
    // Actions
    loadModel,
    unloadModel,
    classify,
    detectObjects,
    recognizeText,
    recognizeVerticalText,
    segment,
    transferStyle,
    
    // Info
    getModelsForTask,
    getModelInfo,
  };
}
