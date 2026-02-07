/**
 * LLM Service Types
 * Definitions for providers, messages, and streaming events
 */

import { Message } from '../../types/message';

export type LLMProviderId = 'openai' | 'anthropic' | 'ollama' | 'local' | 'lmstudio' | 'groq' | 'mistral' | 'deepseek' | 'navigpt' | 'openrouter' | 'llama_rn';

// Operation mode - mutually exclusive; 'mixed' = choose each feature independently
export type ModelMode = 'api' | 'local' | 'mixed';

// Vision configuration - can be separate from LLM
export interface VisionConfig {
    provider: LLMProviderId;
    model: string;
    enabled: boolean;
    useSeparate: boolean; // If true, uses different provider/model than LLM
    /** Optional API override for vision calls */
    baseUrl?: string;
    apiKey?: string;
}

// Local model configuration
export interface LocalModelConfig {
    llmModelId: string | null;
    visionModelId: string | null;
    audioModelId?: string | null;
}

import { ToolDefinition } from '../tools/types';

export interface LLMConfig {
    provider: LLMProviderId;
    apiKey?: string;
    baseUrl?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    stream?: boolean;
    tools?: ToolDefinition[];
    disableAutoExecution?: boolean; // If true, LLMService won't execute tools, just return calls
    /** When true (default), models that don't support native tool calls use simulated tools (instructions in prompt + parse response). Set false to disable tools for non-native models. */
    simulatedToolsEnabled?: boolean;
    /** Force simulated tools even if provider supports native tools. Used for fallback. */
    forceSimulated?: boolean;
    userName?: string;
    userPersona?: string;

    // NEW: Operation mode - mutually exclusive API vs Local
    mode?: ModelMode;

    // NEW: Vision configuration - can be separate from LLM
    visionConfig?: VisionConfig;

    // NEW: Local model configuration (when mode === 'local')
    localConfig?: LocalModelConfig;

    /** RAG / Chat with documents: embedding source */
    ragEmbeddingSource?: 'local' | 'api';
    /** When ragEmbeddingSource === 'api', model for embeddings (e.g. text-embedding-3-small) */
    embeddingModel?: string;
    /** Optional API override for RAG embeddings */
    ragBaseUrl?: string;
    ragApiKey?: string;

    // OpenRouter reasoning tokens (https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
    reasoning?: {
        effort?: 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';
        max_tokens?: number;
        exclude?: boolean;
        enabled?: boolean;
    };

    // llama.rn specific configuration
    n_ctx?: number;        // Context size (default: 2048, options: 2048, 4096, 8192, 32768)
    n_gpu_layers?: number;   // GPU layers to offload (0-99, default: auto)
    n_batch?: number;        // Batch size (default: 512)
    top_p?: number;         // Nucleus sampling (0.0-1.0, default: 0.9)
    top_k?: number;         // Top-k sampling (1-100, default: 40)
    ctx_shift?: boolean;      // Enable context shifting (default: true, disable for multimodal)
    use_gpu?: boolean;      // Enable GPU acceleration (default: true if available)
    modelPath?: string;     // Full model file path (for local files)
    /** Memory mapping (recommended true on mobile for large GGUF files) */
    use_mmap?: boolean;
    /** Lock pages into RAM (often increases memory pressure; default false) */
    use_mlock?: boolean;
}

export interface StreamChunk {
    content: string;
    isDone: boolean;
    reasoning?: string; // Model reasoning/thinking content (o1, o3, Solar Pro, etc.)
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
    toolCalls?: {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }[];
    // Tool execution events for UI feedback
    toolStart?: {
        name: string;
        ttsMessage: string;
    };
    toolEnd?: {
        name: string;
    };
}

export interface LLMProvider {
    id: LLMProviderId;
    name: string;

    // Core generation methods
    chatStream(messages: Message[], config: LLMConfig): AsyncGenerator<StreamChunk>;

    // Optional local model controls
    loadModel?(modelId?: string, config?: LLMConfig): Promise<boolean>;
    unloadModel?(): Promise<void>;
    getLoadedModelId?(): string | null;

    // Optional capabilities
    checkConnection?(config: LLMConfig): Promise<boolean>;
    getAvailableModels?(config: LLMConfig): Promise<string[]>;

    // Feature flags
    supportsNativeTools?: boolean;
    supportsThinking?: boolean; // Whether model can output <think> tags
}
