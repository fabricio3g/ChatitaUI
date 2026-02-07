/**
 * API Template System
 * 
 * This system allows defining API providers declaratively through templates.
 * Adding a new API provider requires ZERO code changes - just add a template.
 * 
 * Inspired by ChatterUI's template system.
 */

import { Message } from '../../../types/message';

// Sampler/Parameter IDs that map to internal configuration
export enum SamplerID {
  TEMPERATURE = 'temperature',
  MAX_TOKENS = 'maxTokens',
  TOP_P = 'topP',
  TOP_K = 'topK',
  PRESENCE_PENALTY = 'presencePenalty',
  FREQUENCY_PENALTY = 'frequencyPenalty',
  REPETITION_PENALTY = 'repetitionPenalty',
  SEED = 'seed',
  STOP_SEQUENCES = 'stopSequences',
}

// External API field mapping
export interface SamplerField {
  internalId: SamplerID;
  externalName: string;
}

// Request format configuration
export interface RequestFormat {
  // The key used for messages in the payload (e.g., 'messages', 'prompt')
  promptKey: string;
  
  // Type of completion API
  completionType: 'chat' | 'text';
  
  // Role names for chat completions
  roles?: {
    user: string;
    assistant: string;
    system: string;
  };
  
  // Content field name within a message
  contentName?: string;
  
  // Authentication configuration
  authHeader: string;
  authPrefix: string;
  
  // Whether to include stop sequences
  useStop: boolean;
  stopKey?: string;
}

// Response parsing configuration
export interface ResponseParseConfig {
  // JSON path to extract content (e.g., 'choices.0.delta.content')
  contentPath: string;
  
  // JSON path to extract tool calls (optional)
  toolCallsPath?: string;
  
  // JSON path to extract reasoning (optional)
  reasoningPath?: string;
  
  // JSON path to extract usage stats (optional)
  usagePath?: string;
}

// API Features supported
export interface APIFeatures {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
}

// Model list parsing configuration
export interface ModelListConfig {
  // Endpoint path for fetching models (appended to base URL)
  endpoint: string;
  
  // JSON path to extract model array
  modelArrayPath: string;
  
  // JSON path to extract model name/id within each model object
  namePath: string;
  
  // JSON path to extract context length (optional)
  contextLengthPath?: string;
}

// Complete API Template
export interface APITemplate {
  id: string;
  name: string;
  description?: string;
  
  // Default endpoint URLs
  defaultEndpoint: string;
  
  // Request/Response configuration
  requestFormat: RequestFormat;
  responseParse: ResponseParseConfig;
  
  // Supported features
  features: APIFeatures;
  
  // Sampler/parameter mapping
  samplerMapping: SamplerField[];
  
  // Model list configuration
  modelList?: ModelListConfig;
  
  // Additional headers to include
  additionalHeaders?: Record<string, string>;
  
  // Request body modifications
  bodyModifications?: (body: any) => void;
}

// Helper to get nested value from object using dot notation
export function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result === null || result === undefined) return undefined;
    // Handle array indices
    if (/^\d+$/.test(key)) {
      result = result[parseInt(key, 10)];
    } else {
      result = result[key];
    }
  }
  return result;
}

// Helper to set nested value in object using dot notation
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

// ============================================
// DEFAULT API TEMPLATES
// ============================================

export const defaultAPITemplates: APITemplate[] = [
  // ============================================
  // OpenAI / OpenAI-Compatible
  // ============================================
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT models (GPT-4, GPT-3.5)',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      toolCallsPath: 'choices.0.delta.tool_calls',
      reasoningPath: 'choices.0.delta.reasoning',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: true,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
      { internalId: SamplerID.FREQUENCY_PENALTY, externalName: 'frequency_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
      { internalId: SamplerID.STOP_SEQUENCES, externalName: 'stop' },
    ],
    modelList: {
      endpoint: 'https://api.openai.com/v1/models',
      modelArrayPath: 'data',
      namePath: 'id',
      contextLengthPath: 'context_window',
    },
  },

  // ============================================
  // OpenRouter
  // ============================================
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'OpenRouter - Unified API for many models',
    defaultEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      reasoningPath: 'choices.0.delta.reasoning',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: true,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.TOP_K, externalName: 'top_k' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
      { internalId: SamplerID.FREQUENCY_PENALTY, externalName: 'frequency_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
      { internalId: SamplerID.STOP_SEQUENCES, externalName: 'stop' },
    ],
    additionalHeaders: {
      'HTTP-Referer': 'https://kokorotts.app',
      'X-Title': 'Kokoro TTS Go',
    },
    modelList: {
      endpoint: 'https://openrouter.ai/api/v1/models',
      modelArrayPath: 'data',
      namePath: 'id',
      contextLengthPath: 'context_length',
    },
    bodyModifications: (body: any) => {
      // OpenRouter-specific: add route fallback
      body.route = 'fallback';
    },
  },

  // ============================================
  // Anthropic Claude
  // ============================================
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Anthropic Claude models',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'x-api-key',
      authPrefix: '',
      useStop: true,
      stopKey: 'stop_sequences',
    },
    responseParse: {
      contentPath: 'delta.text',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: true,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.TOP_K, externalName: 'top_k' },
      { internalId: SamplerID.STOP_SEQUENCES, externalName: 'stop_sequences' },
    ],
    modelList: {
      endpoint: 'https://api.anthropic.com/v1/models',
      modelArrayPath: 'data',
      namePath: 'id',
    },
    additionalHeaders: {
      'anthropic-version': '2023-06-01',
    },
    bodyModifications: (body: any) => {
      // Claude uses 'system' as a top-level param, not in messages
      const systemMessage = body.messages?.find((m: any) => m.role === 'system');
      if (systemMessage) {
        body.system = typeof systemMessage.content === 'string' 
          ? systemMessage.content 
          : systemMessage.content[0]?.text || '';
        body.messages = body.messages.filter((m: any) => m.role !== 'system');
      }
    },
  },

  // ============================================
  // Ollama
  // ============================================
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local Ollama server',
    defaultEndpoint: 'http://localhost:11434/api/chat',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: '',
      authPrefix: '',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'message.content',
    },
    features: {
      supportsStreaming: true,
      supportsTools: false,
      supportsVision: true,
      supportsReasoning: false,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'num_predict' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.TOP_K, externalName: 'top_k' },
      { internalId: SamplerID.REPETITION_PENALTY, externalName: 'repeat_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
    ],
    modelList: {
      endpoint: 'http://localhost:11434/api/tags',
      modelArrayPath: 'models',
      namePath: 'name',
    },
  },

  // ============================================
  // LM Studio
  // ============================================
  {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'LM Studio local server',
    defaultEndpoint: 'http://localhost:1234/v1/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: '',
      authPrefix: '',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: false,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.FREQUENCY_PENALTY, externalName: 'frequency_penalty' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
    ],
    modelList: {
      endpoint: 'http://localhost:1234/v1/models',
      modelArrayPath: 'data',
      namePath: 'id',
    },
  },

  // ============================================
  // Groq
  // ============================================
  {
    id: 'groq',
    name: 'Groq',
    description: 'Groq API - Fast inference',
    defaultEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      supportsReasoning: false,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
      { internalId: SamplerID.STOP_SEQUENCES, externalName: 'stop' },
    ],
    modelList: {
      endpoint: 'https://api.groq.com/openai/v1/models',
      modelArrayPath: 'data',
      namePath: 'id',
      contextLengthPath: 'context_window',
    },
  },

  // ============================================
  // Cohere
  // ============================================
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Cohere API',
    defaultEndpoint: 'https://api.cohere.com/v2/chat',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop_sequences',
    },
    responseParse: {
      contentPath: 'delta.message.content.text',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      supportsReasoning: false,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'p' },
      { internalId: SamplerID.TOP_K, externalName: 'k' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
      { internalId: SamplerID.FREQUENCY_PENALTY, externalName: 'frequency_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
    ],
    modelList: {
      endpoint: 'https://api.cohere.com/v1/models',
      modelArrayPath: 'models',
      namePath: 'name',
      contextLengthPath: 'context_length',
    },
  },

  // ============================================
  // DeepSeek
  // ============================================
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek API',
    defaultEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      reasoningPath: 'choices.0.delta.reasoning_content',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      supportsReasoning: true,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
      { internalId: SamplerID.FREQUENCY_PENALTY, externalName: 'frequency_penalty' },
      { internalId: SamplerID.SEED, externalName: 'seed' },
      { internalId: SamplerID.STOP_SEQUENCES, externalName: 'stop' },
    ],
  },

  // ============================================
  // Google Gemini (OpenAI-compatible)
  // ============================================
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google Gemini API (OpenAI-compatible endpoint)',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    requestFormat: {
      promptKey: 'messages',
      completionType: 'chat',
      roles: {
        user: 'user',
        assistant: 'assistant',
        system: 'system',
      },
      contentName: 'content',
      authHeader: 'Authorization',
      authPrefix: 'Bearer ',
      useStop: true,
      stopKey: 'stop',
    },
    responseParse: {
      contentPath: 'choices.0.delta.content',
      usagePath: 'usage',
    },
    features: {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: false,
    },
    samplerMapping: [
      { internalId: SamplerID.TEMPERATURE, externalName: 'temperature' },
      { internalId: SamplerID.MAX_TOKENS, externalName: 'max_tokens' },
      { internalId: SamplerID.TOP_P, externalName: 'top_p' },
      { internalId: SamplerID.PRESENCE_PENALTY, externalName: 'presence_penalty' },
    ],
  },
];

// Template registry for lookup
export const templateRegistry = new Map<string, APITemplate>();

// Initialize registry
defaultAPITemplates.forEach(template => {
  templateRegistry.set(template.id, template);
});

// Get template by ID
export function getTemplate(id: string): APITemplate | undefined {
  return templateRegistry.get(id);
}

// Get all templates
export function getAllTemplates(): APITemplate[] {
  return Array.from(templateRegistry.values());
}

// Register a custom template
export function registerTemplate(template: APITemplate): void {
  templateRegistry.set(template.id, template);
}
