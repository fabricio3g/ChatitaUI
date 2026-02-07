/**
 * LlamaRNProvider
 * Local LLM inference via llama.rn
 */

import { LLMConfig, LLMProvider, StreamChunk, LLMProviderId } from './types';
import { Message } from '../../types/message';
import { getActiveLlamaModel, getDownloadedLlamaModels } from './llama/models';
import { isExpoGo } from '../../utils/isExpoGo';
import * as FileSystem from 'expo-file-system/legacy';

type LlamaModule = {
  initLlama: (opts: any) => Promise<any>;
};

function toFileUri(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('file://')) return trimmed;
  // Expo FileSystem APIs typically return file:// URIs, but allow raw absolute paths too.
  if (trimmed.startsWith('/')) return `file://${trimmed}`;
  return trimmed;
}

function toRawPath(maybeFileUri: string): string {
  const trimmed = String(maybeFileUri || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('file://') ? trimmed.replace(/^file:\/\//, '') : trimmed;
}

export class LlamaRNProvider implements LLMProvider {
  private config: LLMConfig;
  private context: any = null;
  private loadedModelId: string | null = null;
  private loadedModelPath: string | null = null;
  private module: LlamaModule | null = null;

  id: LLMProviderId = 'llama_rn';
  name: string = 'Local LLM (GGUF)';
  supportsNativeTools: boolean = false;
  supportsThinking: boolean = false;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private async getModule(): Promise<LlamaModule | null> {
    if (this.module) return this.module;
    if (isExpoGo()) {
      console.warn('[LlamaRNProvider] llama.rn is not available in Expo Go');
      return null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.module = require('llama.rn');
      return this.module;
    } catch (e) {
      console.warn('[LlamaRNProvider] Failed to load llama.rn:', e);
      return null;
    }
  }

  isSupported() {
    return !isExpoGo();
  }

  private async resolveModel(config?: LLMConfig): Promise<{ id: string | null; path: string; mmprojPath?: string }> {
    const cfg = config ?? this.config;
    const explicitPath = cfg.modelPath;
    if (explicitPath) {
      return { id: cfg.localConfig?.llmModelId || null, path: explicitPath };
    }

    const requestedId =
      cfg.localConfig?.llmModelId ||
      this.config.localConfig?.llmModelId ||
      cfg.model ||
      this.config.model ||
      null;

    const downloaded = await getDownloadedLlamaModels();
    let model = requestedId ? downloaded.find(m => m.id === requestedId) : null;

    if (!model) {
      const active = await getActiveLlamaModel();
      model = active || null;
    }

    if (!model?.modelPath) {
      throw new Error('No local GGUF model found. Download one in Settings.');
    }

    const mmprojPathCandidate = model.modelPath.replace(/\.gguf$/i, '.mmproj');
    let mmprojPath: string | undefined;
    try {
      const info = await FileSystem.getInfoAsync(mmprojPathCandidate);
      if (info.exists) {
        mmprojPath = mmprojPathCandidate;
      }
    } catch {
      // Ignore mmproj lookup failures
    }

    return { id: model.id, path: model.modelPath, mmprojPath };
  }

  private async getModelSizeGB(modelPath: string): Promise<number> {
    try {
      const info: any = await FileSystem.getInfoAsync(modelPath);
      const size = typeof info?.size === 'number' ? info.size : 0;
      return size > 0 ? size / (1024 ** 3) : 0;
    } catch {
      return 0;
    }
  }

  private async ensureContext(config?: LLMConfig): Promise<void> {
    const module = await this.getModule();
    if (!module) {
      throw new Error('llama.rn not available');
    }

    const modelInfo = await this.resolveModel(config);
    const modelPathUri = toFileUri(modelInfo.path);
    const modelPathRaw = toRawPath(modelPathUri);
    const candidateModelPaths = Array.from(new Set([modelPathUri, modelPathRaw].filter(Boolean)));

    const mmprojPathUri = modelInfo.mmprojPath ? toFileUri(modelInfo.mmprojPath) : undefined;
    const mmprojPathRaw = mmprojPathUri ? toRawPath(mmprojPathUri) : undefined;
    const candidateMmprojPaths = mmprojPathUri
      ? Array.from(new Set([mmprojPathUri, mmprojPathRaw].filter(Boolean)))
      : [];

    if (this.loadedModelPath === modelPathUri && this.context) {
      return;
    }

    if (this.context?.release) {
      try {
        await this.context.release();
      } catch {
        // Ignore release errors
      }
    }

    const cfg = config ?? this.config;
    const modelSizeGB = await this.getModelSizeGB(modelPathUri);

    // NOTE: Local model loading is memory-sensitive on mobile. Keep defaults conservative.
    const useGpu = cfg.use_gpu !== false;
    const requestedGpuLayers = cfg.n_gpu_layers;
    const requestedCtx = cfg.n_ctx;
    const requestedBatch = cfg.n_batch;
    const requestedMmap = (cfg as any).use_mmap;
    const requestedMlock = (cfg as any).use_mlock;
    const requestedCtxShift = (cfg as any).ctx_shift;

    const baseOpts = {
      // model/mmproj is set per-attempt from candidate path(s).
      use_mmap: typeof requestedMmap === 'boolean' ? requestedMmap : true,
      use_mlock: typeof requestedMlock === 'boolean' ? requestedMlock : false,
      // llama.rn recommends disabling context shifting for multimodal models
      ctx_shift: typeof requestedCtxShift === 'boolean' ? requestedCtxShift : (modelInfo.mmprojPath ? false : true),
    };

    const candidates = [
      {
        label: 'requested',
        n_ctx: requestedCtx ?? (modelSizeGB >= 3 ? 2048 : 4096),
        n_batch: requestedBatch ?? (modelSizeGB >= 3 ? 128 : 256),
        // Default to CPU unless explicitly requested; GPU offload can easily OOM.
        n_gpu_layers: useGpu ? (requestedGpuLayers ?? 0) : 0,
      },
      {
        label: 'fallback_cpu',
        n_ctx: Math.min(requestedCtx ?? 2048, 2048),
        n_batch: Math.min(requestedBatch ?? 128, 128),
        n_gpu_layers: 0,
      },
      {
        label: 'fallback_min',
        n_ctx: 1024,
        n_batch: 64,
        n_gpu_layers: 0,
      },
    ];

    let lastError: any = null;
    for (const candidateModelPath of candidateModelPaths) {
      const candidateMmprojPath =
        candidateMmprojPaths.length === 0
          ? undefined
          : candidateModelPath.startsWith('file://')
            ? mmprojPathUri
            : mmprojPathRaw;
      for (const candidate of candidates) {
        try {
          this.context = await module.initLlama({
            ...baseOpts,
            model: candidateModelPath,
            ...(candidateMmprojPath ? { mmproj: candidateMmprojPath } : {}),
            n_ctx: candidate.n_ctx,
            n_batch: candidate.n_batch,
            n_gpu_layers: candidate.n_gpu_layers,
          });
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          console.warn(
            `[LlamaRNProvider] initLlama failed (${candidate.label})`,
            {
              modelSizeGB: Math.round(modelSizeGB * 10) / 10,
              modelPath: candidateModelPath,
              n_ctx: candidate.n_ctx,
              n_batch: candidate.n_batch,
              n_gpu_layers: candidate.n_gpu_layers,
              use_mmap: baseOpts.use_mmap,
              use_mlock: baseOpts.use_mlock,
              ctx_shift: baseOpts.ctx_shift,
              error: (e as any)?.message || String(e),
            },
          );
        }
      }
      if (this.context) break;
    }

    if (!this.context) {
      throw new Error(
        `Failed to load GGUF model (size ~${Math.round(modelSizeGB * 10) / 10}GB). ` +
          `Try a smaller quantization (e.g., Q4_K_M on <=3B) or reduce context/batch. ` +
          `Last error: ${(lastError as any)?.message || String(lastError || 'Unknown error')}`,
      );
    }

    this.loadedModelId = modelInfo.id;
    this.loadedModelPath = modelPathUri;
  }

  async unloadModel(): Promise<void> {
    if (this.context?.release) {
      await this.context.release();
    }
    this.context = null;
    this.loadedModelId = null;
    this.loadedModelPath = null;
  }

  getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  async loadModel(modelId?: string, config?: LLMConfig): Promise<boolean> {
    try {
      const nextConfig: LLMConfig = {
        ...this.config,
        ...(config || {}),
        localConfig: {
          ...(this.config.localConfig || { llmModelId: null, visionModelId: null }),
          ...(config?.localConfig || {}),
          llmModelId: modelId ?? config?.localConfig?.llmModelId ?? this.config.localConfig?.llmModelId ?? null,
        },
      };
      await this.ensureContext(nextConfig);
      return true;
    } catch (e) {
      console.warn('[LlamaRNProvider] Failed to load model:', e);
      return false;
    }
  }

  async *chatStream(messages: Message[], config: LLMConfig): AsyncGenerator<StreamChunk> {
    this.config = { ...this.config, ...config };
    await this.ensureContext(config);

    const queue: StreamChunk[] = [];
    let done = false;
    let error: Error | null = null;
    let notify: (() => void) | null = null;

    const push = (content: string, isDone: boolean) => {
      queue.push({ content, isDone });
      if (notify) {
        notify();
        notify = null;
      }
    };

    const waitForItem = () =>
      new Promise<void>((resolve) => {
        notify = resolve;
      });

    const formattedMessages = config.systemPrompt
      ? [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ]
      : messages;

    const completionPromise = this.context.completion(
      {
        messages: formattedMessages.map(m => ({
          role: m.role,
          content: m.content as any,
        })),
        n_predict: config.maxTokens ?? 1024,
        temperature: config.temperature ?? 0.7,
        top_k: config.top_k ?? 40,
        top_p: config.top_p ?? 0.9,
      },
      (data: any) => {
        const token =
          typeof data?.token === 'string'
            ? data.token
            : typeof data?.text === 'string'
              ? data.text
              : '';
        if (token) {
          push(token, false);
        }
        if (data?.stop === true || data?.done === true || data?.isDone === true) {
          done = true;
          push('', true);
        }
      },
    );

    completionPromise
      .then(() => {
        done = true;
        push('', true);
      })
      .catch((e: Error) => {
        error = e;
        done = true;
        push('', true);
      });

    while (!done || queue.length > 0) {
      if (queue.length === 0) {
        await waitForItem();
        continue;
      }
      const item = queue.shift()!;
      if (error) {
        throw error;
      }
      if (item.content || item.isDone) {
        yield item;
      }
    }
  }

  async checkConnection(config: LLMConfig): Promise<boolean> {
    try {
      await this.ensureContext(config);
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableModels(config?: LLMConfig): Promise<string[]> {
    const models = await getDownloadedLlamaModels();
    return models.map(m => m.id);
  }
}
