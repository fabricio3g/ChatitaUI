/**
 * Local Inference Feature Flags
 * 
 * Toggle these flags to enable/disable local inference features.
 * Set to false to disable (default) - all features use cloud API only.
 * Set to true to re-enable local inference capabilities.
 * 
 * Powered by llama.rn + whisper.rn for on-device AI inference.
 * 
 * @see https://github.com/mybigday/llama.rn
 * @see https://github.com/mybigday/whisper.rn
 */

export const LOCAL_INFERENCE_ENABLED = {
  /** Local LLM models for text generation (Qwen3, Llama3.2, SmolLM2, Phi-4, etc.) */
  LLM: true,

  /** Local vision models for image understanding (Classification, Detection, OCR, Segmentation, Style Transfer) */
  VISION: true,

  /** Local text-to-speech (disabled - use System or API TTS) */
  TTS: false,

  /** Whisper on-device speech-to-text transcription (multilingual support) */
  STT: true,

  /** Local RAG (Retrieval-Augmented Generation) with vector store */
  RAG: false,

  /** Text embeddings for semantic search and RAG (local) */
  EMBEDDINGS: false,
  
  /** Voice Activity Detection for speech processing */
  VAD: true,
  
  /** Text-to-image generation (Stable Diffusion) */
  TEXT_TO_IMAGE: false, // Disabled by default due to high resource requirements
};

/** Check if any local inference is enabled */
export const hasLocalInference = (): boolean => {
  return LOCAL_INFERENCE_ENABLED.LLM ||
    LOCAL_INFERENCE_ENABLED.VISION ||
    LOCAL_INFERENCE_ENABLED.TTS ||
    LOCAL_INFERENCE_ENABLED.STT ||
    LOCAL_INFERENCE_ENABLED.RAG ||
    LOCAL_INFERENCE_ENABLED.EMBEDDINGS ||
    LOCAL_INFERENCE_ENABLED.VAD ||
    LOCAL_INFERENCE_ENABLED.TEXT_TO_IMAGE;
};

/** Individual feature checks */
export const isLocalLLMEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.LLM;
export const isLocalVisionEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.VISION;
export const isLocalTTSEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.TTS;
export const isLocalSTTEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.STT;
export const isLocalRAGEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.RAG;
export const isLocalEmbeddingsEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.EMBEDDINGS;
export const isLocalVADEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.VAD;
export const isLocalTextToImageEnabled = (): boolean => LOCAL_INFERENCE_ENABLED.TEXT_TO_IMAGE;

/** 
 * Recommended model configurations for different use cases
 */
export const RECOMMENDED_MODELS = {
  /** Best models for general chat (balance of quality and speed) */
  CHAT: [
    'qwen3-0.6b-q',     // Fast, efficient
    'llama3.2-1b',      // High quality
    'smollm2-360m',     // Lightweight
  ],
  
  /** Models that support tool/function calling */
  TOOL_CALLING: [
    'hammer2.1-0.5b-q', // Tool calling with low memory
    'hammer2.1-1.5b-q', // Better tool calling quality
  ],
  
  /** Best STT models for different scenarios */
  STT: {
    FASTEST: 'whisper-tiny-en-q',
    BALANCED: 'whisper-base',
    ACCURATE: 'whisper-small',
    MULTILINGUAL: 'whisper-tiny',
  },
  
  /** TTS handled via system/API (no local recommendations) */
  
  /** Best embedding models for different tasks */
  EMBEDDINGS: {
    GENERAL: 'all-minilm-l6-v2',
    SEMANTIC_SEARCH: 'multi-qa-minilm-l6',
    HIGH_QUALITY: 'all-mpnet-base-v2',
    IMAGE_TEXT: 'clip-text',
  },
};

/**
 * Model requirements for device capability checking
 */
export const MODEL_REQUIREMENTS = {
  LLM: {
    'smollm2-135m': { minRamGB: 1, recommendedRamGB: 2 },
    'smollm2-360m': { minRamGB: 1.5, recommendedRamGB: 3 },
    'qwen3-0.6b-q': { minRamGB: 1.5, recommendedRamGB: 3 },
    'qwen3-0.6b': { minRamGB: 3, recommendedRamGB: 4 },
    'llama3.2-1b': { minRamGB: 4, recommendedRamGB: 6 },
    'llama3.2-3b': { minRamGB: 6, recommendedRamGB: 8 },
    'hammer2.1-0.5b-q': { minRamGB: 1.5, recommendedRamGB: 3 },
    'phi-4-mini': { minRamGB: 4, recommendedRamGB: 6 },
  },
  STT: {
    'whisper-tiny-en-q': { minRamGB: 0.5, recommendedRamGB: 1 },
    'whisper-tiny': { minRamGB: 0.5, recommendedRamGB: 1 },
    'whisper-base': { minRamGB: 1, recommendedRamGB: 2 },
    'whisper-small': { minRamGB: 2, recommendedRamGB: 3 },
  },
};

/**
 * Check if device likely has enough RAM for a model
 * @param category Model category ('LLM', 'STT', 'TTS')
 * @param modelId Model identifier
 * @param availableRamGB Available RAM in GB (optional, uses conservative estimate if not provided)
 */
export const canRunModel = (
  category: keyof typeof MODEL_REQUIREMENTS,
  modelId: string,
  availableRamGB?: number
): boolean => {
  const categoryModels = MODEL_REQUIREMENTS[category];
  if (!categoryModels || !(modelId in categoryModels)) {
    return true; // Unknown model, assume it can run
  }
  
  const requirements = categoryModels[modelId as keyof typeof categoryModels];
  const available = availableRamGB ?? 2; // Conservative estimate if not provided
  
  return available >= requirements.minRamGB;
};

/**
 * Get all available features as a list
 */
export const getEnabledFeatures = (): string[] => {
  const features: string[] = [];
  if (LOCAL_INFERENCE_ENABLED.LLM) features.push('LLM');
  if (LOCAL_INFERENCE_ENABLED.VISION) features.push('Vision');
  if (LOCAL_INFERENCE_ENABLED.TTS) features.push('TTS');
  if (LOCAL_INFERENCE_ENABLED.STT) features.push('STT');
  if (LOCAL_INFERENCE_ENABLED.RAG) features.push('RAG');
  if (LOCAL_INFERENCE_ENABLED.EMBEDDINGS) features.push('Embeddings');
  if (LOCAL_INFERENCE_ENABLED.VAD) features.push('VAD');
  if (LOCAL_INFERENCE_ENABLED.TEXT_TO_IMAGE) features.push('Text-to-Image');
  return features;
};
