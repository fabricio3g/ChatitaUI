/**
 * Enhanced Executorch LLM Provider
 * 
 * A project-specific wrapper around react-native-executorch's LLM capabilities
 * that provides additional utilities for model management and chat functionality.
 */

import { isExpoGo } from '../../utils/isExpoGo';
import { Message } from '../../types/message';
import * as FileSystem from 'expo-file-system/legacy';

// Import from react-native-executorch
import {
  LLMModule,
  LLAMA3_2_1B,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_3B,
  LLAMA3_2_3B_SPINQUANT,
  QWEN3_0_6B,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  HAMMER2_1_0_5B,
  HAMMER2_1_0_5B_QUANTIZED,
  HAMMER2_1_1_5B_QUANTIZED,
  SMOLLM2_1_135M,
  SMOLLM2_1_360M,
  QWEN2_5_0_5B,
  PHI_4_MINI_4B,
  type LLMConfig,
  type LLMTool,
  type Message as ExecuTorchMessage,
} from 'react-native-executorch';

/** Model information metadata */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  sizeGB: number;
  parameters: string;
  supportsTools: boolean;
  recommended: boolean;
  modelSource: { modelSource: string; tokenizerSource: string; tokenizerConfigSource: string };
}

/** Available LLM models with metadata */
export const LLM_MODELS: Record<string, ModelInfo> = {
  'smollm2-135m': {
    id: 'smollm2-135m',
    name: 'SmolLM2 135M',
    description: 'Tiny model for quick testing and low-memory devices',
    sizeGB: 0.3,
    parameters: '135M',
    supportsTools: false,
    recommended: false,
    modelSource: SMOLLM2_1_135M,
  },
  'smollm2-360m': {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M',
    description: 'Small model with decent quality',
    sizeGB: 0.7,
    parameters: '360M',
    supportsTools: false,
    recommended: false,
    modelSource: SMOLLM2_1_360M,
  },
  'qwen3-0.6b': {
    id: 'qwen3-0.6b',
    name: 'Qwen3 0.6B',
    description: 'Fast, efficient model for everyday tasks',
    sizeGB: 1.2,
    parameters: '0.6B',
    supportsTools: false,
    recommended: true,
    modelSource: QWEN3_0_6B,
  },
  'qwen3-0.6b-q': {
    id: 'qwen3-0.6b-q',
    name: 'Qwen3 0.6B Quantized',
    description: 'Compressed version for lower memory usage',
    sizeGB: 0.4,
    parameters: '0.6B',
    supportsTools: false,
    recommended: true,
    modelSource: QWEN3_0_6B_QUANTIZED,
  },
  'llama3.2-1b': {
    id: 'llama3.2-1b',
    name: 'Llama 3.2 1B',
    description: 'High quality general-purpose model',
    sizeGB: 2.0,
    parameters: '1B',
    supportsTools: false,
    recommended: true,
    modelSource: LLAMA3_2_1B_SPINQUANT,
  },
  'llama3.2-3b': {
    id: 'llama3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Higher quality, requires more RAM',
    sizeGB: 4.0,
    parameters: '3B',
    supportsTools: false,
    recommended: false,
    modelSource: LLAMA3_2_3B_SPINQUANT,
  },
  'hammer2.1-0.5b': {
    id: 'hammer2.1-0.5b',
    name: 'Hammer 2.1 0.5B',
    description: 'Tool-calling capable model',
    sizeGB: 1.0,
    parameters: '0.5B',
    supportsTools: true,
    recommended: true,
    modelSource: HAMMER2_1_0_5B,
  },
  'hammer2.1-0.5b-q': {
    id: 'hammer2.1-0.5b-q',
    name: 'Hammer 2.1 0.5B Quantized',
    description: 'Tool-calling with lower memory footprint',
    sizeGB: 0.35,
    parameters: '0.5B',
    supportsTools: true,
    recommended: true,
    modelSource: HAMMER2_1_0_5B_QUANTIZED,
  },
  'phi-4-mini': {
    id: 'phi-4-mini',
    name: 'Phi 4 Mini',
    description: 'Microsoft Phi 4 Mini model',
    sizeGB: 2.5,
    parameters: '4B',
    supportsTools: false,
    recommended: false,
    modelSource: PHI_4_MINI_4B,
  },
};

/** Stream chunk for chat responses */
export interface StreamChunk {
  text?: string;
  done?: boolean;
  error?: string;
  tokenCount?: {
    prompt: number;
    generated: number;
    total: number;
  };
}

/** Enhanced Executorch LLM Provider */
export class EnhancedExecutorchLLMProvider {
  private llmModule: LLMModule | null = null;
  private currentModelId: string | null = null;
  private isLoading = false;
  private abortController: AbortController | null = null;

  get id() {
    return 'executorch_llm_enhanced' as const;
  }

  get name() {
    return 'ExecuTorch LLM';
  }

  /** Check if ExecuTorch is available */
  isSupported(): boolean {
    return !isExpoGo();
  }

  /** Get all available model IDs */
  getAvailableModels(): string[] {
    return Object.keys(LLM_MODELS);
  }

  /** Get model info by ID */
  getModelInfo(modelId: string): ModelInfo | null {
    return LLM_MODELS[modelId] || null;
  }

  /** Get recommended models for the device */
  getRecommendedModels(): ModelInfo[] {
    // TODO: Add device capability checks
    return Object.values(LLM_MODELS).filter(m => m.recommended);
  }

  /** Check if a model supports tool calling */
  supportsTools(modelId: string): boolean {
    return LLM_MODELS[modelId]?.supportsTools ?? false;
  }

  /** Load a model by ID */
  async loadModel(
    modelId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (this.isLoading) {
      throw new Error('Model is already loading');
    }

    const modelInfo = LLM_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (!this.isSupported()) {
      throw new Error('ExecuTorch is not available in Expo Go');
    }

    this.isLoading = true;

    try {
      // Clean up previous model
      if (this.llmModule) {
        this.llmModule.delete();
        this.llmModule = null;
      }

      // Create new LLM module
      this.llmModule = new LLMModule();

      // Load the model
      await this.llmModule.load(
        {
          modelSource: modelInfo.modelSource.modelSource,
          tokenizerSource: modelInfo.modelSource.tokenizerSource,
          tokenizerConfigSource: modelInfo.modelSource.tokenizerConfigSource,
        },
        (progress) => onProgress?.(progress)
      );

      this.currentModelId = modelId;
      console.log(`[EnhancedLLM] Loaded model: ${modelInfo.name}`);
      return true;
    } catch (error) {
      console.error('[EnhancedLLM] Failed to load model:', error);
      this.llmModule = null;
      this.currentModelId = null;
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /** Unload the current model */
  unloadModel(): void {
    if (this.llmModule) {
      this.llmModule.delete();
      this.llmModule = null;
      this.currentModelId = null;
      console.log('[EnhancedLLM] Model unloaded');
    }
    this.abortController?.abort();
  }

  /** Check if a model is loaded */
  isModelLoaded(): boolean {
    return this.llmModule !== null && this.currentModelId !== null;
  }

  /** Get the currently loaded model ID */
  getCurrentModelId(): string | null {
    return this.currentModelId;
  }

  /** Configure the LLM with chat settings and tools */
  configure(config: LLMConfig): void {
    if (!this.llmModule) {
      throw new Error('No model loaded');
    }
    this.llmModule.configure(config);
  }

  /** Generate a response with streaming */
  async *chatStream(
    messages: Message[],
    config?: LLMConfig
  ): AsyncGenerator<StreamChunk> {
    if (!this.llmModule) {
      yield { error: 'No model loaded', done: true };
      return;
    }

    // Configure if provided
    if (config) {
      this.configure(config);
    }

    // Convert messages to ExecuTorch format
    const execuTorchMessages: ExecuTorchMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' 
        ? m.content 
        : JSON.stringify(m.content),
    }));

    // Set up abort controller
    this.abortController = new AbortController();

    try {
      // Set up token callback for streaming
      let accumulatedText = '';
      this.llmModule.setTokenCallback({
        tokenCallback: (token: string) => {
          accumulatedText += token;
        },
      });

      // Generate response
      const response = await this.llmModule.generate(execuTorchMessages);

      // Stream the response word by word for better UX
      const words = response.split(' ');
      for (let i = 0; i < words.length; i++) {
        if (this.abortController?.signal.aborted) {
          this.llmModule.interrupt();
          yield { done: true };
          return;
        }

        const word = words[i];
        yield {
          text: (i > 0 ? ' ' : '') + word,
          done: false,
        };

        // Small delay for natural streaming feel
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Yield token counts
      yield {
        done: true,
        tokenCount: {
          prompt: this.llmModule.getPromptTokensCount(),
          generated: this.llmModule.getGeneratedTokenCount(),
          total: this.llmModule.getTotalTokensCount(),
        },
      };
    } catch (error) {
      console.error('[EnhancedLLM] Generation error:', error);
      yield { error: String(error), done: true };
    }
  }

  /** Generate a response without streaming */
  async generate(
    messages: Message[],
    config?: LLMConfig
  ): Promise<{ text: string; tokenCount?: { prompt: number; generated: number; total: number } }> {
    if (!this.llmModule) {
      throw new Error('No model loaded');
    }

    if (config) {
      this.configure(config);
    }

    const execuTorchMessages: ExecuTorchMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: typeof m.content === 'string' 
        ? m.content 
        : JSON.stringify(m.content),
    }));

    const response = await this.llmModule.generate(execuTorchMessages);

    return {
      text: response,
      tokenCount: {
        prompt: this.llmModule.getPromptTokensCount(),
        generated: this.llmModule.getGeneratedTokenCount(),
        total: this.llmModule.getTotalTokensCount(),
      },
    };
  }

  /** Send a simple message and get response */
  async sendMessage(message: string): Promise<string> {
    if (!this.llmModule) {
      throw new Error('No model loaded');
    }
    const history = await this.llmModule.sendMessage(message);
    const lastMessage = history[history.length - 1];
    return lastMessage?.content || '';
  }

  /** Interrupt ongoing generation */
  interrupt(): void {
    this.abortController?.abort();
    if (this.llmModule) {
      this.llmModule.interrupt();
    }
  }

  /** Get token counts from last generation */
  getTokenCount() {
    if (!this.llmModule) return null;
    return {
      prompt: this.llmModule.getPromptTokensCount(),
      generated: this.llmModule.getGeneratedTokenCount(),
      total: this.llmModule.getTotalTokensCount(),
    };
  }
}

// Export singleton instance
export const EnhancedLLM = new EnhancedExecutorchLLMProvider();
