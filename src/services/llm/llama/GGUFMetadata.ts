/**
 * GGUF Metadata Reader
 * 
 * Reads metadata from GGUF model files using llama.rn's loadLlamaModelInfo.
 * Provides rich model information for better model management.
 */

import * as FileSystem from 'expo-file-system/legacy';

function toFileUri(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

function toRawPath(maybeFileUri: string): string {
  const trimmed = String(maybeFileUri || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('file://') ? trimmed.replace(/^file:\/\//, '') : trimmed;
}

// GGUF metadata types
export interface GGUFMetadata {
  // General metadata
  'general.architecture'?: string;
  'general.name'?: string;
  'general.description'?: string;
  'general.quantization_version'?: number;
  'general.file_type'?: number;
  'general.size_label'?: string;
  'general.license'?: string;
  'general.url'?: string;
  'general.tags'?: string[];
  'general.languages'?: string[];
  
  // Architecture-specific metadata (prefixed by architecture name)
  [key: `${string}.context_length`]: number | undefined;
  [key: `${string}.embedding_length`]: number | undefined;
  [key: `${string}.block_count`]: number | undefined;
  [key: `${string}.feed_forward_length`]: number | undefined;
  [key: `${string}.attention.head_count`]: number | undefined;
  [key: `${string}.attention.head_count_kv`]: number | undefined;
  [key: `${string}.attention.layer_norm_rms_epsilon`]: number | undefined;
  [key: `${string}.rope.freq_base`]: number | undefined;
  [key: `${string}.rope.dimension_count`]: number | undefined;
  
  // Tokenizer metadata
  'tokenizer.ggml.model'?: string;
  'tokenizer.ggml.pre'?: string;
  'tokenizer.ggml.tokens'?: string[];
  'tokenizer.ggml.scores'?: number[];
  'tokenizer.ggml.token_type'?: number[];
  'tokenizer.ggml.bos_token_id'?: number;
  'tokenizer.ggml.eos_token_id'?: number;
  'tokenizer.ggml.padding_token_id'?: number;
  'tokenizer.ggml.unknown_token_id'?: number;
  'tokenizer.ggml.seperator_token_id'?: number;
}

// Parsed model information
export interface ParsedModelInfo {
  // Identification
  architecture: string;
  name: string;
  sizeLabel?: string;
  
  // Capabilities
  contextLength: number;
  embeddingLength?: number;
  blockCount?: number;
  headCount?: number;
  headCountKV?: number;
  
  // File info
  fileType: number;
  quantization?: string;
  
  // Parameters estimate (in billions)
  parameters?: number;
  
  // Metadata
  description?: string;
  license?: string;
  languages?: string[];
  tags?: string[];
}

// GGML file type to quantization name mapping
export const GGML_TYPE_NAMES: Record<number, string> = {
  0: 'F32',
  1: 'F16',
  2: 'Q4_0',
  3: 'Q4_1',
  6: 'Q5_0',
  7: 'Q5_1',
  8: 'Q8_0',
  9: 'Q8_1',
  10: 'Q2_K',
  11: 'Q3_K_S',
  12: 'Q3_K_M',
  13: 'Q3_K_L',
  14: 'Q4_K_S',
  15: 'Q4_K_M',
  16: 'Q5_K_S',
  17: 'Q5_K_M',
  18: 'Q6_K',
  19: 'Q8_K',
  20: 'IQ2_XXS',
  21: 'IQ2_XS',
  22: 'IQ3_XXS',
  23: 'IQ1_S',
  24: 'IQ4_NL',
  25: 'IQ3_S',
  26: 'IQ3_M',
  27: 'IQ2_S',
  28: 'IQ2_M',
  29: 'IQ4_XS',
  30: 'IQ1_M',
  31: 'BF16',
  32: 'Q4_0_4_4',
  33: 'Q4_0_4_8',
  34: 'Q4_0_8_8',
};

// Known architecture names
const KNOWN_ARCHITECTURES = [
  'llama',
  'falcon',
  'gpt2',
  'gptj',
  'gptneox',
  'mpt',
  'baichuan',
  'starcoder',
  'persimmon',
  'refact',
  'bert',
  'bloom',
  'stablelm',
  'qwen',
  'qwen2',
  'phi2',
  'phi3',
  'gemma',
  'gemma2',
  'mixtral',
  'command-r',
  'dbrx',
  'jais',
  'nemotron',
  'yi',
  'internlm2',
  'minicpm',
  'deepseek',
  'deepseek2',
  'chatglm',
  'granite',
  'olmoe',
  'chameleon',
  'clip',
  'llava',
];

/**
 * Read GGUF metadata from a model file
 */
export async function readGGUFMetadata(filePath: string): Promise<GGUFMetadata | null> {
  try {
    // Use llama.rn's loadLlamaModelInfo if available
    let llamaRN: any;
    try {
      llamaRN = require('llama.rn');
    } catch (e) {
      console.warn('[GGUFMetadata] llama.rn not available');
      return null;
    }

    if (!llamaRN.loadLlamaModelInfo) {
      console.warn('[GGUFMetadata] loadLlamaModelInfo not available in llama.rn');
      return null;
    }

    const uri = toFileUri(filePath);
    const raw = toRawPath(uri);
    const candidates = Array.from(new Set([uri, raw].filter(Boolean)));
    let lastError: any = null;
    for (const candidate of candidates) {
      try {
        const metadata = await llamaRN.loadLlamaModelInfo(candidate);
        return metadata as GGUFMetadata;
      } catch (e) {
        lastError = e;
      }
    }
    console.warn('[GGUFMetadata] loadLlamaModelInfo failed', lastError);
    return null;
  } catch (error: any) {
    console.error('[GGUFMetadata] Failed to read metadata:', error);
    return null;
  }
}

/**
 * Parse raw GGUF metadata into structured model info
 */
export function parseModelInfo(metadata: GGUFMetadata | null): ParsedModelInfo | null {
  if (!metadata) return null;

  const architecture = metadata['general.architecture'] || 'unknown';
  const archPrefix = architecture;

  // Get file type and quantization
  const fileType = metadata['general.file_type'] || 0;
  const quantization = GGML_TYPE_NAMES[fileType] || `TYPE_${fileType}`;

  // Parse size label to get parameter count
  const sizeLabel = metadata['general.size_label'] || '';
  const parameters = parseParameters(sizeLabel);

  return {
    architecture,
    name: metadata['general.name'] || 'Unknown Model',
    sizeLabel,
    contextLength: metadata[`${archPrefix}.context_length`] || 4096,
    embeddingLength: metadata[`${archPrefix}.embedding_length`],
    blockCount: metadata[`${archPrefix}.block_count`],
    headCount: metadata[`${archPrefix}.attention.head_count`],
    headCountKV: metadata[`${archPrefix}.attention.head_count_kv`],
    fileType,
    quantization,
    parameters,
    description: metadata['general.description'],
    license: metadata['general.license'],
    languages: metadata['general.languages'],
    tags: metadata['general.tags'],
  };
}

/**
 * Parse parameter count from size label
 * Examples: "7B" -> 7, "13B" -> 13, "70B" -> 70
 */
function parseParameters(sizeLabel: string): number | undefined {
  if (!sizeLabel) return undefined;
  
  const match = sizeLabel.match(/^(\d+(?:\.\d+)?)\s*B$/i);
  if (match) {
    return parseFloat(match[1]);
  }
  
  return undefined;
}

/**
 * Get human-readable model description
 */
export function getModelDescription(info: ParsedModelInfo): string {
  const parts: string[] = [];
  
  if (info.name && info.name !== 'Unknown Model') {
    parts.push(info.name);
  }
  
  if (info.parameters) {
    parts.push(`${info.parameters}B params`);
  }
  
  if (info.quantization) {
    parts.push(info.quantization);
  }
  
  if (info.contextLength) {
    parts.push(`${info.contextLength.toLocaleString()} ctx`);
  }
  
  return parts.join(' • ');
}

/**
 * Check if model supports vision/multimodal
 */
export function hasVisionCapability(metadata: GGUFMetadata): boolean {
  const arch = metadata['general.architecture'] || '';
  
  // Check for CLIP or LLaVA architecture
  if (arch === 'clip' || arch === 'llava') {
    return true;
  }
  
  // Check for mmproj in name (common convention)
  const name = metadata['general.name'] || '';
  if (name.toLowerCase().includes('vision') || 
      name.toLowerCase().includes('multimodal') ||
      name.toLowerCase().includes('llava')) {
    return true;
  }
  
  return false;
}

/**
 * Get recommended settings for a model
 */
export function getRecommendedSettings(info: ParsedModelInfo): {
  contextSize: number;
  gpuLayers: number;
  batchSize: number;
} {
  // Default settings
  const defaults = {
    contextSize: Math.min(info.contextLength || 4096, 4096),
    gpuLayers: 0, // Auto
    batchSize: 512,
  };
  
  // Adjust based on parameter count
  if (info.parameters) {
    if (info.parameters <= 3) {
      // Small models (< 3B)
      defaults.gpuLayers = 99; // Offload all to GPU
      defaults.batchSize = 1024;
    } else if (info.parameters <= 8) {
      // Medium models (3B - 8B)
      defaults.gpuLayers = 99;
      defaults.batchSize = 512;
    } else if (info.parameters <= 20) {
      // Large models (8B - 20B)
      defaults.gpuLayers = 50; // Partial offload
      defaults.batchSize = 256;
    } else {
      // Very large models (> 20B)
      defaults.gpuLayers = 30;
      defaults.batchSize = 128;
      defaults.contextSize = Math.min(defaults.contextSize, 2048);
    }
  }
  
  return defaults;
}

/**
 * Validate GGUF file
 */
export async function validateGGUFFile(filePath: string): Promise<{
  valid: boolean;
  error?: string;
  metadata?: GGUFMetadata;
}> {
  try {
    // Check file extension
    if (!filePath.toLowerCase().endsWith('.gguf')) {
      return { valid: false, error: 'File must have .gguf extension' };
    }
    
    // Check file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return { valid: false, error: 'File does not exist' };
    }
    
    // Try to read metadata
    const metadata = await readGGUFMetadata(filePath);
    if (!metadata) {
      return { valid: false, error: 'Could not read GGUF metadata' };
    }
    
    // Check for required fields
    if (!metadata['general.architecture']) {
      return { valid: false, error: 'Missing architecture in metadata', metadata };
    }
    
    return { valid: true, metadata };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Validation failed' };
  }
}
