/**
 * Executorch Utilities
 * 
 * Helper functions for working with react-native-executorch
 */

import { isExpoGo } from '../../utils/isExpoGo';

/** Model category */
export type ModelCategory = 
  | 'llm' 
  | 'speech-to-text' 
  | 'text-to-speech' 
  | 'text-embeddings'
  | 'image-embeddings'
  | 'classification'
  | 'object-detection'
  | 'ocr'
  | 'segmentation'
  | 'style-transfer'
  | 'text-to-image'
  | 'vad';

/** Model information interface */
export interface ModelInfo {
  id: string;
  name: string;
  category: ModelCategory;
  description: string;
  sizeMB: number;
  parameters?: string;
  requirements?: {
    minRamGB?: number;
    minStorageGB?: number;
  };
}

/** Package version of react-native-executorch */
export const EXECUTORCH_VERSION = '0.8.0';

/**
 * Check if react-native-executorch is available
 * Returns false in Expo Go since native modules don't work there
 */
export function isExecutorchAvailable(): boolean {
  return !isExpoGo();
}

/**
 * Get the version of react-native-executorch
 */
export function getExecutorchVersion(): string {
  return EXECUTORCH_VERSION;
}

/**
 * Estimate memory requirements for a model
 * @param sizeMB Model size in MB
 * @returns Estimated RAM usage in GB (model size + runtime overhead)
 */
export function estimateModelMemory(sizeMB: number): number {
  // Models typically need 2-4x their size in RAM during inference
  const multiplier = 3;
  return Math.ceil((sizeMB * multiplier) / 1024 * 10) / 10;
}

/**
 * Format model size for display
 */
export function formatModelSize(sizeMB: number): string {
  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(1)} GB`;
  }
  if (sizeMB >= 1) {
    return `${Math.round(sizeMB)} MB`;
  }
  return `${Math.round(sizeMB * 1024)} KB`;
}

/**
 * Format memory size for display
 */
export function formatMemorySize(sizeGB: number): string {
  if (sizeGB >= 1) {
    return `${sizeGB.toFixed(1)} GB`;
  }
  return `${Math.round(sizeGB * 1024)} MB`;
}

/**
 * Check if the device likely has enough memory for a model
 * Note: This is a rough estimate and may not be accurate on all devices
 * @param modelSizeMB Model size in MB
 */
export function hasEnoughMemory(modelSizeMB: number): boolean {
  // Get device info from native module if available
  // For now, use conservative estimates
  const estimatedMemoryNeeded = estimateModelMemory(modelSizeMB);
  
  // Assume most modern phones have at least 4GB RAM
  // Conservative threshold: assume 2GB available for the app
  const assumedAvailableGB = 2;
  
  return estimatedMemoryNeeded <= assumedAvailableGB;
}

/**
 * Get recommended batch size based on model size
 * @param modelSizeMB Model size in MB
 */
export function getRecommendedBatchSize(modelSizeMB: number): number {
  if (modelSizeMB < 100) return 8;
  if (modelSizeMB < 500) return 4;
  if (modelSizeMB < 1000) return 2;
  return 1;
}

/**
 * Calculate download time estimate
 * @param sizeMB File size in MB
 * @param speedMbps Download speed in Mbps (default: 10)
 */
export function estimateDownloadTime(sizeMB: number, speedMbps: number = 10): number {
  // Convert MB to Mb and divide by speed
  const sizeMb = sizeMB * 8;
  return Math.ceil(sizeMb / speedMbps);
}

/**
 * Format download time for display
 */
export function formatDownloadTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

/**
 * Truncate text to fit within token limit
 * @param text Text to truncate
 * @param maxTokens Maximum number of tokens
 * @param approximateCharsPerToken Approximate characters per token (default: 4)
 */
export function truncateToTokenLimit(
  text: string, 
  maxTokens: number, 
  approximateCharsPerToken: number = 4
): string {
  const maxChars = maxTokens * approximateCharsPerToken;
  if (text.length <= maxChars) return text;
  
  // Try to truncate at a sentence boundary
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSentence > maxChars * 0.8) {
    return truncated.substring(0, lastSentence + 1);
  }
  
  if (lastSpace > maxChars * 0.8) {
    return truncated.substring(0, lastSpace);
  }
  
  return truncated;
}

/**
 * Split text into chunks that fit within token limits
 * @param text Text to split
 * @param maxTokens Maximum tokens per chunk
 * @param overlapTokens Number of tokens to overlap between chunks
 */
export function splitIntoTokenChunks(
  text: string,
  maxTokens: number,
  overlapTokens: number = 50
): string[] {
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.substring(start, end);
    chunks.push(chunk);
    
    if (end >= text.length) break;
    
    // Move start forward with overlap
    start = end - overlapChars;
  }
  
  return chunks;
}

/**
 * Normalize text for better model input
 * - Removes extra whitespace
 * - Normalizes quotes
 * - Removes control characters
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Convert Float32Array audio to WAV format
 * @param audio Float32Array of audio samples
 * @param sampleRate Sample rate (e.g., 16000, 24000)
 * @returns Base64 encoded WAV data
 */
export function float32ToWavBase64(audio: Float32Array, sampleRate: number): string {
  // WAV header size: 44 bytes
  const buffer = new ArrayBuffer(44 + audio.length * 2);
  const view = new DataView(buffer);
  
  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audio.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, audio.length * 2, true);
  
  // Write audio data (convert float32 to int16)
  for (let i = 0; i < audio.length; i++) {
    const sample = Math.max(-1, Math.min(1, audio[i]));
    view.setInt16(44 + i * 2, sample * 0x7FFF, true);
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Debounce function for handling rapid updates
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for limiting execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
