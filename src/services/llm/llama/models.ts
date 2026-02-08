/**
 * Llama Model Management
 * Manages GGUF models for local LLM inference
 * Supports text, vision, and multimodal (audio+vision) models
 * Includes HuggingFace search and local file picker
 */

import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  readGGUFMetadata,
  parseModelInfo,
  getModelDescription,
  getRecommendedSettings,
  validateGGUFFile as validateWithMetadata,
  GGML_TYPE_NAMES,
} from "./GGUFMetadata";

// Storage paths
const LLAMA_STORE_DIR = `${FileSystem.documentDirectory}llama/`;
const LEGACY_LLAMA_CACHE_DIR = `${FileSystem.cacheDirectory}llama/`;
const SETTINGS_ACTIVE_LLAMA_MODEL = "settings_activeLlamaModel";
const SETTINGS_LLAMA_DOWNLOAD_PROGRESS = "settings_llamaDownloadProgress";

function normalizeLocalId(name: string): string {
  return name.startsWith("local-") ? name : `local-${name}`;
}

async function ensureLlamaStoreDir(): Promise<void> {
  const storeDir = await FileSystem.getInfoAsync(LLAMA_STORE_DIR);
  if (!storeDir.exists) {
    await FileSystem.makeDirectoryAsync(LLAMA_STORE_DIR, { intermediates: true });
  }
}

async function migrateLegacyCacheToStore(): Promise<void> {
  const legacyDir = await FileSystem.getInfoAsync(LEGACY_LLAMA_CACHE_DIR);
  if (!legacyDir.exists) return;

  await ensureLlamaStoreDir();

  const legacyFiles = await FileSystem.readDirectoryAsync(LEGACY_LLAMA_CACHE_DIR);
  for (const file of legacyFiles) {
    const from = `${LEGACY_LLAMA_CACHE_DIR}${file}`;
    const to = `${LLAMA_STORE_DIR}${file}`;
    try {
      const destInfo = await FileSystem.getInfoAsync(to);
      if (destInfo.exists) continue;
      await FileSystem.moveAsync({ from, to });
    } catch (e) {
      console.warn("Failed to migrate legacy GGUF file:", file, e);
    }
  }
}

/**
 * Model interface
 */
export interface LlamaModel {
  id: string;
  name: string;
  description: string;
  sizeGB: number;
  quantization: string;
  contextSize: number;
  url?: string;
  recommended?: boolean;
  capabilities?: ("text" | "vision" | "audio" | "multimodal")[];
  mmprojUrl?: string; // Multimodal projector file URL
  downloaded: boolean;
  status: "downloading" | "ready" | "error";
  downloadProgress?: number;
  isLocal?: boolean;
  localPath?: string;
}

/**
 * Model state for tracking
 */
export interface LlamaModelState {
  id: string;
  name: string;
  description: string;
  sizeGB: number;
  quantization: string;
  contextSize: number;
  modelPath: string;
  downloaded: boolean;
  status: "downloading" | "ready" | "error";
  downloadProgress?: number;
  isLocal?: boolean;
  capabilities?: ("text" | "vision" | "audio" | "multimodal")[];
  mmprojUrl?: string;
}

/**
 * Efficient text-only models (recommended for performance)
 */
export const EFFICIENT_TEXT_PRESETS: LlamaModel[] = [
  {
    id: "qwen2.5-0.5b-instruct-q4",
    name: "Qwen2.5 0.5B Instruct (Q4)",
    description: "Ultra-fast 0.5B model, ~0.3GB",
    sizeGB: 0.3,
    quantization: "Q4_K_M",
    contextSize: 32768,
    capabilities: ["text"],
    recommended: true,
    url: "https://huggingface.co/lmstudio-community/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
    downloaded: false,
    status: "ready",
  },
  {
    id: "phi-3-mini-4k-instruct-q4",
    name: "Phi-3 Mini 4K Instruct (Q4)",
    description: "Efficient 2.2B model, ~1.4GB, 4K context",
    sizeGB: 1.4,
    quantization: "Q4_K_M",
    contextSize: 4096,
    capabilities: ["text"],
    recommended: true,
    url: "https://huggingface.co/lmstudio-community/phi-3-mini-4k-instruct-GGUF/resolve/main/Phi-3-mini-4k-instruct-Q4_K_M.gguf",
    downloaded: false,
    status: "ready",
  },
];

/**
 * Visual models: describe images and transcribe text from photos (OCR only).
 */
export const VISUAL_MODELS: LlamaModel[] = [
  {
    id: "llava-next-7b-q4",
    name: "LLaVA-NeXT 7B (Q4)",
    description: "Describe images & read text from photos, ~4.5GB (8GB+ RAM)",
    sizeGB: 4.5,
    quantization: "Q4",
    contextSize: 4096,
    capabilities: ["vision", "text", "multimodal"],
    mmprojUrl: "https://huggingface.co/xtuner/LLaVA-NeXT-gguf/resolve/main/mmproj-any-v1.5-7b.gguf",
    url: "https://huggingface.co/xtuner/LLaVA-NeXT-gguf/resolve/main/llava-v1.5-7b-Q4_K_M.gguf",
    downloaded: false,
    status: "ready",
  },
  {
    id: "moondream2-q4",
    name: "Moondream2 (Q4)",
    description: "Describe images & read text from photos, ~0.5GB (mobile-friendly)",
    sizeGB: 0.5,
    quantization: "Q4",
    contextSize: 2048,
    capabilities: ["vision", "text"],
    mmprojUrl: "https://huggingface.co/vikhyatk/moondream2/resolve/main/moondream2-mmproj-f16.gguf",
    url: "https://huggingface.co/vikhyatk/moondream2/resolve/main/moondream2-text-model-q4_0.gguf",
    downloaded: false,
    status: "ready",
  },
];

/**
 * Audio-capable models (small, optimized for mobile)
 */
export const AUDIO_MODELS: LlamaModel[] = [
  {
    id: "mobilellm-125m-q4",
    name: "MobileLLM-125M (Q4)",
    description: "Ultra-compact 125M model, ~76MB, text-only, ideal for mobile",
    sizeGB: 0.08,
    quantization: "Q4_K_M",
    contextSize: 32768,
    capabilities: ["text"],
    recommended: true,
    url: "https://huggingface.co/pjh64/MobileLLM-125M-HF-GGUF/resolve/main/MobileLLM-125M-Q4_K_M.gguf",
    downloaded: false,
    status: "ready",
  },
  {
    id: "smolvlm-q8",
    name: "SmolVLM (Q8)",
    description: "Compact multimodal model, ~400MB, audio+vision",
    sizeGB: 0.4,
    quantization: "Q8_K",
    contextSize: 8192,
    capabilities: ["text", "vision", "audio", "multimodal"],
    mmprojUrl:
      "https://huggingface.co/smolVLM/SmolVLM-GGUF/resolve/main/mmproj.gguf",
    url: "https://huggingface.co/smolVLM/SmolVLM-GGUF/resolve/main/SmolVLM-Q8_K.gguf",
    downloaded: false,
    status: "ready",
  },
];

/**
 * Model categories for UI organization
 */
export type ModelCategory = "text" | "vision" | "audio" | "all";

/** Thrown when download is cancelled; used by SettingsScreen to avoid showing "Download failed" */
export const CANCELLED = Symbol("Download cancelled");

/**
 * Download GGUF model from URL. Returns { promise, cancel } for cancelable download.
 */
export function downloadLlamaModel(
  model: LlamaModel,
  onProgress: (progress: number) => void,
): { promise: Promise<string>; cancel: () => Promise<void> } {
  let ggufResumable: ReturnType<typeof FileSystem.createDownloadResumable> | null = null;
  let mmprojResumable: ReturnType<typeof FileSystem.createDownloadResumable> | null = null;
  let cancelled = false;

  const promise = (async (): Promise<string> => {
    const modelKey = model.id;

    await ensureLlamaStoreDir();

    await AsyncStorage.setItem(
      SETTINGS_LLAMA_DOWNLOAD_PROGRESS,
      JSON.stringify({ [modelKey]: 0, startTime: Date.now() }),
    );

    if (!model.url) throw new Error("Model URL not provided");

    const fileName = `${model.id}.gguf`;
    const fileUri = `${LLAMA_STORE_DIR}${fileName}`;

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      console.log(`Model file already exists: ${fileName}`);
      onProgress(1.0);
      return fileUri;
    }

    ggufResumable = FileSystem.createDownloadResumable(
      model.url,
      fileUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        onProgress(progress);
        AsyncStorage.setItem(
          SETTINGS_LLAMA_DOWNLOAD_PROGRESS,
          JSON.stringify({ [modelKey]: progress, startTime: Date.now() }),
        );
      },
    );

    const result = await ggufResumable.downloadAsync();
    if (cancelled) throw CANCELLED;
    if (!result) throw new Error("Download failed");

    if (model.mmprojUrl) {
      const mmprojFileName = `${model.id}.mmproj`;
      const mmprojUri = `${LLAMA_STORE_DIR}${mmprojFileName}`;
      mmprojResumable = FileSystem.createDownloadResumable(
        model.mmprojUrl,
        mmprojUri,
        {},
      );
      await mmprojResumable.downloadAsync();
      if (cancelled) throw CANCELLED;
      console.log(`Downloaded mmproj: ${mmprojFileName}`);
    }

    onProgress(1.0);
    return fileUri;
  })();

  const cancel = async () => {
    cancelled = true;
    try {
      if (ggufResumable) await (ggufResumable as any).pauseAsync?.();
      if (mmprojResumable) await (mmprojResumable as any).pauseAsync?.();
    } catch (e) {
      console.warn("Error pausing download:", e);
    }
    try {
      await FileSystem.deleteAsync(`${LLAMA_STORE_DIR}${model.id}.gguf`, { idempotent: true });
      await FileSystem.deleteAsync(`${LLAMA_STORE_DIR}${model.id}.mmproj`, { idempotent: true });
    } catch (e) {
      console.warn("Error deleting partial files:", e);
    }
  };

  return { promise, cancel };
}

/**
 * Get list of downloaded Llama models
 */
export async function getDownloadedLlamaModels(): Promise<LlamaModelState[]> {
  const models: LlamaModelState[] = [];

  await migrateLegacyCacheToStore();

  // Check store directory
  const storeDir = await FileSystem.getInfoAsync(LLAMA_STORE_DIR);
  if (!storeDir.exists) {
    return models;
  }

  // Get all files in store directory
  const files = await FileSystem.readDirectoryAsync(LLAMA_STORE_DIR);

  // Process each .gguf file and match against presets
  const allPresets = [
    ...EFFICIENT_TEXT_PRESETS,
    ...VISUAL_MODELS,
    ...AUDIO_MODELS,
  ];

  for (const file of files) {
    if (!file.endsWith(".gguf")) continue;

    const fileName = file.replace(".gguf", "");
    const fileUri = `${LLAMA_STORE_DIR}${file}`;

    // Try to match against presets
    const matchedModel = allPresets.find((m) => m.id === fileName);

    if (matchedModel) {
      models.push({
        id: matchedModel.id,
        name: matchedModel.name,
        description: matchedModel.description,
        sizeGB: matchedModel.sizeGB,
        quantization: matchedModel.quantization,
        contextSize: matchedModel.contextSize,
        modelPath: fileUri,
        downloaded: true,
        status: "ready",
        capabilities: matchedModel.capabilities,
        mmprojUrl: matchedModel.mmprojUrl,
      });
    } else {
      // If no match, add as local custom model
      const fileInfo = await FileSystem.getInfoAsync(fileUri) as any;
      const localId = normalizeLocalId(fileName);
      const displayName = fileName.replace(/^local-/, "");
      models.push({
        id: localId,
        name: displayName,
        description: `Local model: ${displayName}`,
        sizeGB: fileInfo.exists && fileInfo.size ? fileInfo.size / (1024 * 1024 * 1024) : 0,
        quantization: "?",
        contextSize: 4096,
        modelPath: fileUri,
        downloaded: true,
        status: "ready",
        isLocal: true,
      });
    }
  }

  return models;
}

/**
 * Delete downloaded Llama model
 */
export async function deleteLlamaModel(modelId: string): Promise<void> {
  const ggufUri = `${LLAMA_STORE_DIR}${modelId}.gguf`;
  const mmprojUri = `${LLAMA_STORE_DIR}${modelId}.mmproj`;

  try {
    const ggufInfo = await FileSystem.getInfoAsync(ggufUri);
    if (ggufInfo.exists) {
      await FileSystem.deleteAsync(ggufUri);
      console.log(`Deleted model: ${modelId}.gguf`);
    }

    const mmprojInfo = await FileSystem.getInfoAsync(mmprojUri);
    if (mmprojInfo.exists) {
      await FileSystem.deleteAsync(mmprojUri);
      console.log(`Deleted mmproj: ${modelId}.mmproj`);
    }

    // Remove from active models if it was active
    const activeId = await AsyncStorage.getItem(SETTINGS_ACTIVE_LLAMA_MODEL);
    if (activeId === modelId) {
      await AsyncStorage.removeItem(SETTINGS_ACTIVE_LLAMA_MODEL);
    }
  } catch (error) {
    console.error(`Failed to delete model ${modelId}:`, error);
    throw error;
  }
}

/**
 * Set active Llama model
 */
export async function setActiveLlamaModel(modelId: string): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_ACTIVE_LLAMA_MODEL, modelId);
}

/**
 * Get active Llama model
 */
export async function getActiveLlamaModel(): Promise<LlamaModelState | null> {
  const activeId = await AsyncStorage.getItem(SETTINGS_ACTIVE_LLAMA_MODEL);
  if (!activeId) return null;

  const models = await getDownloadedLlamaModels();
  const normalized = normalizeLocalId(activeId);
  return (
    models.find((m) => m.id === activeId || m.id === normalized) ||
    null
  );
}

/**
 * Load local GGUF model from device storage
 */
export async function loadLlamaModelFromFile(fileUri: string, originalFileName?: string): Promise<string> {
  // Validate file extension
  const fileName = (originalFileName || fileUri.split("/").pop() || "").trim();
  if (!fileName.endsWith(".gguf")) {
    throw new Error("Only .gguf files are supported for local models");
  }
  const baseName = fileName.replace(/\.gguf$/i, "");
  const localBase = normalizeLocalId(baseName);

  // Get file size for validation
  const fileInfo = await FileSystem.getInfoAsync(fileUri) as any;
  if (fileInfo.exists && fileInfo.size && fileInfo.size > 10 * 1024 * 1024 * 1024) {
    console.warn(
      `Large model file detected: ${fileInfo.size} bytes. May exceed device memory.`,
    );
  }

  // Create cache directory if it doesn't exist
  await ensureLlamaStoreDir();

  // Copy to cache directory
  const targetFileName = `${localBase}.gguf`;
  const targetUri = `${LLAMA_STORE_DIR}${targetFileName}`;

  await FileSystem.copyAsync({
    from: fileUri,
    to: targetUri,
  });

  console.log(`Loaded local model: ${targetFileName}`);

  // Set as active model
  await setActiveLlamaModel(localBase);

  return targetUri;
}

/**
 * Validate GGUF file
 */
export async function validateGGUFFile(fileUri: string): Promise<boolean> {
  const fileName = fileUri.split("/").pop() || "";

  // Check extension
  if (!fileName.endsWith(".gguf")) {
    return false;
  }

  // Check file exists
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  return fileInfo.exists;
}

/**
 * HuggingFace search for GGUF models (placeholder - would use HF API)
 */
export async function searchHuggingFaceModels(
  query: string,
  filters?: {
    type?: ModelCategory;
    quantization?: string;
    maxSizeGB?: number;
  },
  limit: number = 20,
): Promise<LlamaModel[]> {
  // This is a placeholder implementation
  // In production, you would use the HuggingFace Inference API
  console.log(
    `Searching HuggingFace for: ${query} (filters: ${JSON.stringify(filters)})`,
  );

  // Search in all presets for matches
  const allModels = [
    ...EFFICIENT_TEXT_PRESETS,
    ...VISUAL_MODELS,
    ...AUDIO_MODELS,
  ];

  // Filter by query
  let results = allModels.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.description.toLowerCase().includes(query.toLowerCase()),
  );

  // Filter by type if specified
  if (filters?.type && filters.type !== "all") {
    results = results.filter((m) =>
      m.capabilities?.includes(filters.type as any),
    );
  }

  // Filter by quantization if specified
  if (filters?.quantization) {
    results = results.filter((m) =>
      m.quantization?.includes(filters.quantization!),
    );
  }

  // Filter by max size if specified
  if (filters?.maxSizeGB) {
    results = results.filter((m) => (m.sizeGB || 0) <= filters.maxSizeGB!);
  }

  // Sort by size (smaller first)
  results = results.sort((a, b) => (a.sizeGB || 0) - (b.sizeGB || 0));

  return results.slice(0, limit);
}


// ============================================
// NEW: Metadata-enhanced model functions
// ============================================

/**
 * Import a model with full GGUF metadata reading
 * This replaces the basic loadLlamaModelFromFile with rich metadata
 */
export async function importModelWithMetadata(
  fileUri: string
): Promise<{ success: boolean; model?: LlamaModelState; error?: string }> {
  try {
    // Validate and read metadata
    const validation = await validateWithMetadata(fileUri);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const metadata = validation.metadata!;
    const info = parseModelInfo(metadata);
    if (!info) {
      return { success: false, error: "Failed to parse model metadata" };
    }

    const fileName = fileUri.split("/").pop() || "";
    const baseName = fileName.replace(/\.gguf$/i, "");
    const localBase = normalizeLocalId(baseName);
    const fileInfo = (await FileSystem.getInfoAsync(fileUri)) as any;
    const sizeGB = fileInfo.exists && fileInfo.size 
      ? fileInfo.size / (1024 * 1024 * 1024) 
      : 0;

    // Detect capabilities
    const capabilities: ("text" | "vision" | "audio" | "multimodal")[] = ["text"];
    const arch = info.architecture.toLowerCase();
    
    if (arch === "clip" || arch === "llava" || fileName.toLowerCase().includes("vision")) {
      capabilities.push("vision", "multimodal");
    }
    if (arch.includes("whisper") || fileName.toLowerCase().includes("audio")) {
      capabilities.push("audio");
    }

    // Create cache directory if needed
    await ensureLlamaStoreDir();

    // Copy to cache
    const targetFileName = `${localBase}.gguf`;
    const targetUri = `${LLAMA_STORE_DIR}${targetFileName}`;

    await FileSystem.copyAsync({ from: fileUri, to: targetUri });

    // Build model state
    const modelId = localBase;
    const model: LlamaModelState = {
      id: modelId,
      name: info.name || fileName.replace(/^local-/, ""),
      description: getModelDescription(info),
      sizeGB,
      quantization: info.quantization || "?",
      contextSize: info.contextLength,
      modelPath: targetUri,
      downloaded: true,
      status: "ready",
      isLocal: true,
      capabilities,
    };

    // Set as active
    await setActiveLlamaModel(modelId);

    console.log(`[importModelWithMetadata] Imported: ${model.name}`, {
      architecture: info.architecture,
      parameters: info.parameters,
      quantization: info.quantization,
      contextLength: info.contextLength,
    });

    return { success: true, model };
  } catch (error: any) {
    console.error("[importModelWithMetadata] Failed:", error);
    return { success: false, error: error.message || "Import failed" };
  }
}

/**
 * Get downloaded models with rich metadata
 * Enhanced version of getDownloadedLlamaModels that reads actual GGUF metadata
 */
export async function getDownloadedModelsWithMetadata(): Promise<LlamaModelState[]> {
  const models: LlamaModelState[] = [];

  await migrateLegacyCacheToStore();

  const storeDir = await FileSystem.getInfoAsync(LLAMA_STORE_DIR);
  if (!storeDir.exists) {
    return models;
  }

  const files = await FileSystem.readDirectoryAsync(LLAMA_STORE_DIR);
  const allPresets = [...EFFICIENT_TEXT_PRESETS, ...VISUAL_MODELS, ...AUDIO_MODELS];

  for (const file of files) {
    if (!file.endsWith(".gguf")) continue;

    const fileName = file.replace(".gguf", "");
    const fileUri = `${LLAMA_STORE_DIR}${file}`;

    // Try to match preset first
    const matchedPreset = allPresets.find((m) => m.id === fileName);

    if (matchedPreset) {
      models.push({
        id: matchedPreset.id,
        name: matchedPreset.name,
        description: matchedPreset.description,
        sizeGB: matchedPreset.sizeGB,
        quantization: matchedPreset.quantization,
        contextSize: matchedPreset.contextSize,
        modelPath: fileUri,
        downloaded: true,
        status: "ready",
        capabilities: matchedPreset.capabilities,
        mmprojUrl: matchedPreset.mmprojUrl,
      });
    } else {
      // Try to read metadata for custom models
      try {
        const metadata = await readGGUFMetadata(fileUri);
        const info = metadata ? parseModelInfo(metadata) : null;
        const fileInfo = (await FileSystem.getInfoAsync(fileUri)) as any;

        if (info) {
          // Detect capabilities from metadata
          const capabilities: ("text" | "vision" | "audio" | "multimodal")[] = ["text"];
          const arch = info.architecture.toLowerCase();
          if (arch === "clip" || arch === "llava") {
            capabilities.push("vision", "multimodal");
          }

          const localId = normalizeLocalId(fileName);
          const displayName = (info.name || fileName).replace(/^local-/, "");
          models.push({
            id: localId,
            name: displayName,
            description: getModelDescription(info),
            sizeGB: fileInfo.exists && fileInfo.size ? fileInfo.size / (1024 * 1024 * 1024) : 0,
            quantization: info.quantization || "?",
            contextSize: info.contextLength,
            modelPath: fileUri,
            downloaded: true,
            status: "ready",
            isLocal: true,
            capabilities,
          });
        } else {
          // Fallback to basic info
          const localId = normalizeLocalId(fileName);
          const displayName = fileName.replace(/^local-/, "");
          models.push({
            id: localId,
            name: displayName,
            description: `Local model: ${displayName}`,
            sizeGB: fileInfo.exists && fileInfo.size ? fileInfo.size / (1024 * 1024 * 1024) : 0,
            quantization: "?",
            contextSize: 4096,
            modelPath: fileUri,
            downloaded: true,
            status: "ready",
            isLocal: true,
          });
        }
      } catch (e) {
        // Fallback on error
        const localId = normalizeLocalId(fileName);
        const displayName = fileName.replace(/^local-/, "");
        models.push({
          id: localId,
          name: displayName,
          description: `Local model: ${displayName}`,
          sizeGB: 0,
          quantization: "?",
          contextSize: 4096,
          modelPath: fileUri,
          downloaded: true,
          status: "ready",
          isLocal: true,
        });
      }
    }
  }

  return models;
}

/**
 * Get recommended settings for a model
 */
export async function getModelRecommendedSettings(
  modelId: string
): Promise<{
  contextSize: number;
  gpuLayers: number;
  batchSize: number;
}> {
  const models = await getDownloadedLlamaModels();
  const model = models.find((m) => m.id === modelId);

  if (!model) {
    return { contextSize: 4096, gpuLayers: 0, batchSize: 512 };
  }

  // Try to read from metadata for most accurate settings
  try {
    const metadata = await readGGUFMetadata(model.modelPath);
    const info = metadata ? parseModelInfo(metadata) : null;
    if (info) {
      return getRecommendedSettings(info);
    }
  } catch (e) {
    // Fall through to defaults
  }

  // Fallback based on size
  if (model.sizeGB < 1) {
    return { contextSize: 8192, gpuLayers: 99, batchSize: 1024 };
  } else if (model.sizeGB < 4) {
    return { contextSize: 4096, gpuLayers: 99, batchSize: 512 };
  } else {
    return { contextSize: 4096, gpuLayers: 50, batchSize: 256 };
  }
}

/**
 * Refresh model metadata after download
 * Useful for updating model info after initial import
 */
export async function refreshModelMetadata(
  modelId: string
): Promise<LlamaModelState | null> {
  const models = await getDownloadedLlamaModels();
  const model = models.find((m) => m.id === modelId);

  if (!model || !model.isLocal) {
    return model || null;
  }

  try {
    const metadata = await readGGUFMetadata(model.modelPath);
    if (!metadata) return model;

    const info = parseModelInfo(metadata);
    if (!info) return model;

    return {
      ...model,
      name: info.name || model.name,
      description: getModelDescription(info),
      quantization: info.quantization || model.quantization,
      contextSize: info.contextLength || model.contextSize,
    };
  } catch (e) {
    return model;
  }
}

// Re-export GGUF utilities
export {
  readGGUFMetadata,
  parseModelInfo,
  getModelDescription,
  getRecommendedSettings,
  validateWithMetadata as validateGGUFFileWithMetadata,
  GGML_TYPE_NAMES,
};
