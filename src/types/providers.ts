/**
 * LLM Provider interfaces
 * Following Unix philosophy: interface-driven, swappable providers
 */

import { Message } from './message';

export type LLMProviderType = 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'local';

export interface LLMProvider {
    /**
     * Stream chat completions (async iterator pattern)
     * Pure function - returns iterator, no side effects
     */
    streamChat(messages: Message[], options?: StreamOptions): AsyncIterator<string>;

    /**
     * Generate embeddings for RAG
     * Pure async function
     */
    generateEmbedding(text: string): Promise<number[]>;

    /**
     * Execute tool/function call
     * Pure async function
     */
    executeToolCall?(toolName: string, args: Record<string, any>): Promise<any>;
}

export interface StreamOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    model?: string;
    tools?: ToolDefinition[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ParameterSchema>;
        required?: string[];
    };
}

export interface ParameterSchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    enum?: string[];
}
