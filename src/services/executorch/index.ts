/**
 * React Native ExecuTorch Integration
 * 
 * This module provides a comprehensive integration layer for react-native-executorch,
 * exposing all hooks, modules, types, and model constants with enhanced project-specific utilities.
 * 
 * @example
 * ```tsx
 * import { 
 *   useLLM, 
 *   LLAMA3_2_1B, 
 *   useSpeechToText, 
 *   WHISPER_TINY,
 *   useTextToSpeech,
 *   KOKORO_MEDIUM,
 *   KOKORO_VOICE_AF_HEART 
 * } from '@/services/executorch';
 * ```
 */

// ============================================================================
// RE-EXPORTS FROM REACT-NATIVE-EXECUTORCH
// ============================================================================

// Hooks - Natural Language Processing
export {
  useLLM,
  useSpeechToText,
  useTextToSpeech,
  useTextEmbeddings,
  useTokenizer,
  useVAD,
} from 'react-native-executorch';

// Hooks - Computer Vision
export {
  useClassification,
  useImageEmbeddings,
  useImageSegmentation,
  useOCR,
  useObjectDetection,
  useStyleTransfer,
  useTextToImage,
  useVerticalOCR,
} from 'react-native-executorch';

// Hooks - General
export { useExecutorchModule } from 'react-native-executorch';

// Modules - Natural Language Processing
export {
  LLMModule,
  SpeechToTextModule,
  TextToSpeechModule,
  TextEmbeddingsModule,
  TokenizerModule,
  VADModule,
} from 'react-native-executorch';

// Modules - Computer Vision
export {
  ClassificationModule,
  ImageEmbeddingsModule,
  ImageSegmentationModule,
  OCRModule,
  ObjectDetectionModule,
  StyleTransferModule,
  TextToImageModule,
  VerticalOCRModule,
} from 'react-native-executorch';

// Modules - General
export { ExecutorchModule } from 'react-native-executorch';

// Types
export type {
  Message,
  MessageRole,
  LLMConfig,
  LLMProps,
  LLMType,
  LLMTool,
  ChatConfig,
  GenerationConfig,
  ToolsConfig,
  ToolCall,
} from 'react-native-executorch';

export type {
  SpeechToTextProps,
  SpeechToTextType,
  SpeechToTextModelConfig,
  DecodingOptions,
  SpeechToTextLanguage,
} from 'react-native-executorch';

export type {
  TextToSpeechProps,
  TextToSpeechType,
  TextToSpeechInput,
  TextToSpeechStreamingInput,
  TextToSpeechConfig,
  VoiceConfig,
  KokoroVoiceExtras,
  TextToSpeechLanguage,
} from 'react-native-executorch';

export type {
  TextEmbeddingsProps,
  TextEmbeddingsType,
} from 'react-native-executorch';

export type {
  TokenizerProps,
  TokenizerType,
} from 'react-native-executorch';

export type {
  VADProps,
  VADType,
} from 'react-native-executorch';

export type {
  ClassificationProps,
  ClassificationType,
} from 'react-native-executorch';

export type {
  ImageEmbeddingsProps,
  ImageEmbeddingsType,
} from 'react-native-executorch';

export type {
  ImageSegmentationProps,
  ImageSegmentationType,
  Segment,
  Point,
} from 'react-native-executorch';

export type {
  OCRProps,
  OCRType,
  OCRDetection,
  OCRLanguage,
} from 'react-native-executorch';

export type {
  ObjectDetectionProps,
  ObjectDetectionType,
  Detection,
  Bbox,
} from 'react-native-executorch';

export type {
  StyleTransferProps,
  StyleTransferType,
} from 'react-native-executorch';

export type {
  TextToImageProps,
  TextToImageType,
} from 'react-native-executorch';

export type {
  ExecutorchModuleProps,
  ExecutorchModuleType,
  TensorPtr,
  TensorBuffer,
} from 'react-native-executorch';

export type { ResourceSource } from 'react-native-executorch';

// Model Constants - LLMs
export {
  // Llama 3.2
  LLAMA3_2_1B,
  LLAMA3_2_1B_QLORA,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_3B,
  LLAMA3_2_3B_QLORA,
  LLAMA3_2_3B_SPINQUANT,
  // Qwen 3
  QWEN3_0_6B,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B,
  QWEN3_1_7B_QUANTIZED,
  QWEN3_4B,
  QWEN3_4B_QUANTIZED,
  // Hammer 2.1 (Tool calling)
  HAMMER2_1_0_5B,
  HAMMER2_1_0_5B_QUANTIZED,
  HAMMER2_1_1_5B,
  HAMMER2_1_1_5B_QUANTIZED,
  HAMMER2_1_3B,
  HAMMER2_1_3B_QUANTIZED,
  // SmolLM2
  SMOLLM2_1_135M,
  SMOLLM2_1_135M_QUANTIZED,
  SMOLLM2_1_360M,
  SMOLLM2_1_360M_QUANTIZED,
  SMOLLM2_1_1_7B,
  SMOLLM2_1_1_7B_QUANTIZED,
  // Qwen 2.5
  QWEN2_5_0_5B,
  QWEN2_5_0_5B_QUANTIZED,
  QWEN2_5_1_5B,
  QWEN2_5_1_5B_QUANTIZED,
  QWEN2_5_3B,
  QWEN2_5_3B_QUANTIZED,
  // Phi 4
  PHI_4_MINI_4B,
  PHI_4_MINI_4B_QUANTIZED,
} from 'react-native-executorch';

// Model Constants - Speech to Text
export {
  WHISPER_TINY,
  WHISPER_TINY_EN,
  WHISPER_TINY_EN_QUANTIZED,
  WHISPER_BASE,
  WHISPER_BASE_EN,
  WHISPER_SMALL,
  WHISPER_SMALL_EN,
} from 'react-native-executorch';

// Model Constants - Text to Speech
export {
  KOKORO_SMALL,
  KOKORO_MEDIUM,
} from 'react-native-executorch';

// Model Constants - TTS Voices
export {
  KOKORO_VOICE_AF_HEART,
  KOKORO_VOICE_AF_RIVER,
  KOKORO_VOICE_AF_SARAH,
  KOKORO_VOICE_AM_ADAM,
  KOKORO_VOICE_AM_MICHAEL,
  KOKORO_VOICE_AM_SANTA,
  KOKORO_VOICE_BF_EMMA,
  KOKORO_VOICE_BM_DANIEL,
} from 'react-native-executorch';

// Model Constants - Text Embeddings
export {
  ALL_MINILM_L6_V2,
  ALL_MPNET_BASE_V2,
  MULTI_QA_MINILM_L6_COS_V1,
  MULTI_QA_MPNET_BASE_DOT_V1,
  CLIP_VIT_BASE_PATCH32_TEXT,
} from 'react-native-executorch';

// Model Constants - Image Embeddings
export {
  CLIP_VIT_BASE_PATCH32_IMAGE,
} from 'react-native-executorch';

// Model Constants - Computer Vision
export {
  EFFICIENTNET_V2_S,
  SSDLITE_320_MOBILENET_V3_LARGE,
  DEEPLAB_V3_RESNET50,
} from 'react-native-executorch';

// Model Constants - Style Transfer
export {
  STYLE_TRANSFER_CANDY,
  STYLE_TRANSFER_MOSAIC,
  STYLE_TRANSFER_RAIN_PRINCESS,
  STYLE_TRANSFER_UDNIE,
} from 'react-native-executorch';

// Model Constants - Image Generation
export {
  BK_SDM_TINY_VPRED_256,
  BK_SDM_TINY_VPRED_512,
} from 'react-native-executorch';

// Model Constants - VAD
export {
  FSMN_VAD,
} from 'react-native-executorch';

// Utilities
export {
  ResourceFetcher,
  DEFAULT_CHAT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_MESSAGE_HISTORY,
  DEFAULT_CONTEXT_WINDOW_LENGTH,
  SPECIAL_TOKENS,
} from 'react-native-executorch';

// Errors
export {
  RnExecutorchError,
  RnExecutorchErrorCode,
} from 'react-native-executorch';

// ============================================================================
// PROJECT-SPECIFIC EXPORTS
// ============================================================================

// Enhanced Providers
export { EnhancedExecutorchLLMProvider, LLM_MODELS } from './LLMProvider';
export { EnhancedExecutorchSTTProvider, STT_MODELS } from './STTProvider';
export { EnhancedExecutorchTTSProvider, TTS_MODELS, TTS_VOICES } from './TTSProvider';
export { ExecutorchVisionProvider, VISION_MODELS } from './VisionProvider';
export { ExecutorchEmbeddingsProvider, EMBEDDING_MODELS } from './EmbeddingsProvider';

// Hooks
export { useLocalLLM } from './hooks/useLocalLLM';
export { useLocalSTT } from './hooks/useLocalSTT';
export { useLocalTTS } from './hooks/useLocalTTS';
export { useExecutorchVision } from './hooks/useExecutorchVision';
export { useExecutorchEmbeddings } from './hooks/useExecutorchEmbeddings';

// Utilities
export { 
  isExecutorchAvailable,
  getExecutorchVersion,
  estimateModelMemory,
  formatModelSize,
  type ModelInfo,
  type ModelCategory,
} from './utils';
