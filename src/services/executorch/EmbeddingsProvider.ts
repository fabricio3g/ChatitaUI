/**
 * Executorch Embeddings Provider
 * 
 * Provides on-device text and image embedding capabilities for:
 * - Semantic search
 * - RAG (Retrieval-Augmented Generation)
 * - Text similarity
 * - Image-text alignment (CLIP)
 */

import { isExpoGo } from '../../utils/isExpoGo';
import {
  TextEmbeddingsModule,
  ImageEmbeddingsModule,
  ALL_MINILM_L6_V2,
  ALL_MPNET_BASE_V2,
  MULTI_QA_MINILM_L6_COS_V1,
  MULTI_QA_MPNET_BASE_DOT_V1,
  CLIP_VIT_BASE_PATCH32_TEXT,
  CLIP_VIT_BASE_PATCH32_IMAGE,
} from 'react-native-executorch';

/** Embedding model types */
export type EmbeddingType = 'text' | 'image' | 'multimodal';

/** Embedding model info */
export interface EmbeddingModelInfo {
  id: string;
  name: string;
  type: EmbeddingType;
  description: string;
  sizeMB: number;
  dimensions: number;
  normalized: boolean;
  modelSource: any;
}

/** Available embedding models */
export const EMBEDDING_MODELS: Record<string, EmbeddingModelInfo> = {
  // Text embeddings
  'all-minilm-l6-v2': {
    id: 'all-minilm-l6-v2',
    name: 'all-MiniLM-L6-v2',
    type: 'text',
    description: 'Fast, general-purpose text embeddings (384D)',
    sizeMB: 90,
    dimensions: 384,
    normalized: true,
    modelSource: ALL_MINILM_L6_V2,
  },
  'all-mpnet-base-v2': {
    id: 'all-mpnet-base-v2',
    name: 'all-mpnet-base-v2',
    type: 'text',
    description: 'Higher quality text embeddings (768D)',
    sizeMB: 420,
    dimensions: 768,
    normalized: true,
    modelSource: ALL_MPNET_BASE_V2,
  },
  'multi-qa-minilm-l6': {
    id: 'multi-qa-minilm-l6',
    name: 'multi-qa-MiniLM-L6-cos-v1',
    type: 'text',
    description: 'Optimized for question-answering (384D)',
    sizeMB: 90,
    dimensions: 384,
    normalized: true,
    modelSource: MULTI_QA_MINILM_L6_COS_V1,
  },
  'multi-qa-mpnet-base': {
    id: 'multi-qa-mpnet-base',
    name: 'multi-qa-mpnet-base-dot-v1',
    type: 'text',
    description: 'Higher quality QA embeddings (768D)',
    sizeMB: 420,
    dimensions: 768,
    normalized: true,
    modelSource: MULTI_QA_MPNET_BASE_DOT_V1,
  },
  // CLIP text embeddings
  'clip-text': {
    id: 'clip-text',
    name: 'CLIP ViT-B/32 Text',
    type: 'text',
    description: 'CLIP text encoder for image-text alignment (512D)',
    sizeMB: 250,
    dimensions: 512,
    normalized: true,
    modelSource: CLIP_VIT_BASE_PATCH32_TEXT,
  },
  // Image embeddings
  'clip-image': {
    id: 'clip-image',
    name: 'CLIP ViT-B/32 Image',
    type: 'image',
    description: 'CLIP image encoder for image-text alignment (512D)',
    sizeMB: 350,
    dimensions: 512,
    normalized: true,
    modelSource: CLIP_VIT_BASE_PATCH32_IMAGE,
  },
};

/** Text embedding result */
export interface TextEmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  normalized: boolean;
}

/** Image embedding result */
export interface ImageEmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  normalized: boolean;
}

/** Batch embedding result */
export interface BatchEmbeddingResult {
  embeddings: Float32Array[];
  dimensions: number;
  normalized: boolean;
}

/** Executorch Embeddings Provider */
export class ExecutorchEmbeddingsProvider {
  private textModule: TextEmbeddingsModule | null = null;
  private imageModule: ImageEmbeddingsModule | null = null;
  private loadedTextModel: string | null = null;
  private loadedImageModel: string | null = null;

  get id() {
    return 'executorch_embeddings' as const;
  }

  get name() {
    return 'ExecuTorch Embeddings';
  }

  /** Check if ExecuTorch is available */
  isSupported(): boolean {
    return !isExpoGo();
  }

  /** Get available embedding models */
  getAvailableModels(type?: EmbeddingType): EmbeddingModelInfo[] {
    const models = Object.values(EMBEDDING_MODELS);
    if (type) {
      return models.filter(m => m.type === type);
    }
    return models;
  }

  /** Get model info by ID */
  getModelInfo(modelId: string): EmbeddingModelInfo | null {
    return EMBEDDING_MODELS[modelId] || null;
  }

  /** Get recommended model for text embeddings */
  getRecommendedTextModel(): EmbeddingModelInfo {
    return EMBEDDING_MODELS['all-minilm-l6-v2'];
  }

  /** Get recommended model for semantic search */
  getRecommendedSearchModel(): EmbeddingModelInfo {
    return EMBEDDING_MODELS['multi-qa-minilm-l6'];
  }

  /** Load a text embedding model */
  async loadTextModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const modelInfo = EMBEDDING_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (modelInfo.type !== 'text') {
      throw new Error(`Model ${modelId} is not a text embedding model`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    try {
      // Clean up existing model
      if (this.textModule) {
        this.textModule.delete();
        this.textModule = null;
      }

      // Create and load new module
      this.textModule = new TextEmbeddingsModule();
      await this.textModule.load(modelInfo.modelSource, onProgress);

      this.loadedTextModel = modelId;
      console.log(`[Embeddings] Loaded text model: ${modelInfo.name}`);
      return true;
    } catch (error) {
      console.error('[Embeddings] Failed to load text model:', error);
      this.textModule = null;
      this.loadedTextModel = null;
      return false;
    }
  }

  /** Load an image embedding model */
  async loadImageModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const modelInfo = EMBEDDING_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (modelInfo.type !== 'image') {
      throw new Error(`Model ${modelId} is not an image embedding model`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    try {
      // Clean up existing model
      if (this.imageModule) {
        this.imageModule.delete();
        this.imageModule = null;
      }

      // Create and load new module
      this.imageModule = new ImageEmbeddingsModule();
      await this.imageModule.load(modelInfo.modelSource, onProgress);

      this.loadedImageModel = modelId;
      console.log(`[Embeddings] Loaded image model: ${modelInfo.name}`);
      return true;
    } catch (error) {
      console.error('[Embeddings] Failed to load image model:', error);
      this.imageModule = null;
      this.loadedImageModel = null;
      return false;
    }
  }

  /** Unload text model */
  unloadTextModel(): void {
    if (this.textModule) {
      this.textModule.delete();
      this.textModule = null;
      this.loadedTextModel = null;
      console.log('[Embeddings] Unloaded text model');
    }
  }

  /** Unload image model */
  unloadImageModel(): void {
    if (this.imageModule) {
      this.imageModule.delete();
      this.imageModule = null;
      this.loadedImageModel = null;
      console.log('[Embeddings] Unloaded image model');
    }
  }

  /** Unload all models */
  unloadAll(): void {
    this.unloadTextModel();
    this.unloadImageModel();
  }

  /** Check if text model is loaded */
  isTextModelLoaded(): boolean {
    return this.textModule !== null;
  }

  /** Check if image model is loaded */
  isImageModelLoaded(): boolean {
    return this.imageModule !== null;
  }

  /** Get embedding for a single text */
  async embedText(text: string): Promise<TextEmbeddingResult> {
    if (!this.textModule) {
      throw new Error('Text embedding model not loaded');
    }

    const embedding = await this.textModule.forward(text);
    const modelInfo = this.loadedTextModel ? EMBEDDING_MODELS[this.loadedTextModel] : null;

    return {
      embedding,
      dimensions: embedding.length,
      normalized: modelInfo?.normalized ?? true,
    };
  }

  /** Get embeddings for multiple texts */
  async embedTexts(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.textModule) {
      throw new Error('Text embedding model not loaded');
    }

    const embeddings: Float32Array[] = [];
    for (const text of texts) {
      const embedding = await this.textModule.forward(text);
      embeddings.push(embedding);
    }

    const modelInfo = this.loadedTextModel ? EMBEDDING_MODELS[this.loadedTextModel] : null;

    return {
      embeddings,
      dimensions: embeddings[0]?.length ?? 0,
      normalized: modelInfo?.normalized ?? true,
    };
  }

  /** Get embedding for an image */
  async embedImage(imageUri: string): Promise<ImageEmbeddingResult> {
    if (!this.imageModule) {
      throw new Error('Image embedding model not loaded');
    }

    const embedding = await this.imageModule.forward(imageUri);
    const modelInfo = this.loadedImageModel ? EMBEDDING_MODELS[this.loadedImageModel] : null;

    return {
      embedding,
      dimensions: embedding.length,
      normalized: modelInfo?.normalized ?? true,
    };
  }

  /** Calculate cosine similarity between two embeddings */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** Calculate dot product between two embeddings (for normalized embeddings) */
  dotProduct(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }

  /** Find most similar embeddings */
  findMostSimilar(
    query: Float32Array,
    candidates: Float32Array[],
    topK: number = 5
  ): Array<{ index: number; score: number }> {
    const scores = candidates.map((candidate, index) => ({
      index,
      score: this.cosineSimilarity(query, candidate),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** Calculate Euclidean distance between two embeddings */
  euclideanDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }
}

// Export singleton instance
export const EmbeddingsProvider = new ExecutorchEmbeddingsProvider();
