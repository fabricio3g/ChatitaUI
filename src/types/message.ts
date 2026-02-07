/**
 * Core message types
 * Pure interfaces - no side effects
 */

/**
 * Tool call in LLM API format (OpenAI, Anthropic, etc.)
 * This is the format used in Message.tool_calls for API compatibility
 */
export interface APIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * Internal tool call format with execution status
 * Used in MessageMetadata.toolCalls for tracking tool execution
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>; // Parsed arguments
    result?: any;
    status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * Content part for multimodal messages (text, image, audio)
 */
export type MessageContentPart = 
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
    | { type: 'image'; source: string }
    | { type: 'input_audio'; input_audio: { data: string; format: string } };

export interface Message {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | MessageContentPart[] | null;
    tool_calls?: APIToolCall[]; // API format for LLM compatibility
    tool_call_id?: string;
    timestamp: number;
    metadata?: MessageMetadata;

    // Versioning for edits/regenerations
    versions?: MessageVersion[];
    currentVersionIndex?: number;

    // RAG Support
    embedding?: number[];
}

export interface MessageVersion {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: MessageMetadata;
}

export interface MessageMetadata {
    thinking?: string; // Content inside <think> tags
    toolCalls?: ToolCall[]; // Internal format for tracking execution
    voiceAudioUrl?: string;
    isStreaming?: boolean;
    tokenUsage?: {
        input: number;
        output: number;
        total: number;
    };
    toolResponse?: any; // ToolResponse object for UI widgets
    groupedToolResponses?: any[]; // For compacted tool messages
    fadeIn?: boolean;
}

export type MessageRole = Message['role'];
