/**
 * Request Builder
 * 
 * Builds API requests using templates. Supports both streaming and non-streaming.
 */

import { Message } from '../../../types/message';
import {
  APITemplate,
  getNestedValue,
  setNestedValue,
  SamplerID,
} from './APITemplates';

// Configuration for building a request
export interface RequestBuildConfig {
  template: APITemplate;
  apiKey?: string;
  model: string;
  messages: Message[];
  samplers: Partial<Record<SamplerID, any>>;
  stream?: boolean;
  tools?: any[];
  systemPrompt?: string;
}

// Stream chunk result
export interface ParsedStreamChunk {
  content?: string;
  reasoning?: string;
  toolCalls?: any[];
  usage?: {
    input: number;
    output: number;
    total: number;
  };
  isDone: boolean;
}

// Build request headers
export function buildHeaders(
  template: APITemplate,
  apiKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...template.additionalHeaders,
  };

  if (apiKey && template.requestFormat.authHeader) {
    headers[template.requestFormat.authHeader] = 
      template.requestFormat.authPrefix + apiKey;
  }

  return headers;
}

// Build the request body
export function buildRequestBody(config: RequestBuildConfig): any {
  const { template, model, messages, samplers, stream = true, tools, systemPrompt } = config;
  const { requestFormat } = template;

  const body: any = {
    model,
    stream,
  };

  // Map samplers to external names
  template.samplerMapping.forEach(({ internalId, externalName }) => {
    const value = samplers[internalId];
    if (value !== undefined) {
      // Special handling for stop sequences
      if (internalId === SamplerID.STOP_SEQUENCES && Array.isArray(value)) {
        body[externalName] = value;
      } else if (value !== null && value !== '') {
        body[externalName] = value;
      }
    }
  });

  // Build messages based on completion type
  if (requestFormat.completionType === 'chat') {
    const formattedMessages = messages.map(msg => formatMessage(msg, requestFormat));
    
    // Add system prompt if provided and not already present
    if (systemPrompt && !messages.some(m => m.role === 'system')) {
      formattedMessages.unshift({
        role: 'system',
        [requestFormat.contentName || 'content']: systemPrompt,
      });
    }

    body[requestFormat.promptKey] = formattedMessages;
  } else {
    // Text completion - concatenate messages
    body[requestFormat.promptKey] = messages
      .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');
  }

  // Add tools if supported
  if (tools && tools.length > 0 && template.features.supportsTools) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }

  // Apply template-specific body modifications
  if (template.bodyModifications) {
    template.bodyModifications(body);
  }

  // Handle stream options
  if (stream) {
    body.stream_options = { include_usage: true };
  }

  return body;
}

// Format a single message
function formatMessage(msg: Message, requestFormat: any): any {
  const { roles, contentName = 'content' } = requestFormat;
  
  // Handle tool calls in assistant messages
  if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
    const formatted: any = {
      role: roles?.assistant || 'assistant',
      [contentName]: msg.content || null,
      tool_calls: msg.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function?.name || tc.name,
          arguments: tc.function?.arguments || tc.arguments,
        },
      })),
    };
    return formatted;
  }

  // Handle tool response messages
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: msg.tool_call_id,
      [contentName]: msg.content,
    };
  }

  // Handle multimodal content
  if (Array.isArray(msg.content)) {
    return {
      role: roles?.[msg.role] || msg.role,
      [contentName]: msg.content.map((item: any) => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        }
        if (item.type === 'image_url' || item.type === 'image') {
          return {
            type: 'image_url',
            image_url: {
              url: item.image_url?.url || item.image_url || item.source,
            },
          };
        }
        return item;
      }),
    };
  }

  // Standard text message
  return {
    role: roles?.[msg.role] || msg.role,
    [contentName]: msg.content || '',
  };
}

// Parse a streaming SSE chunk
export function parseStreamChunk(
  template: APITemplate,
  data: string
): ParsedStreamChunk | null {
  if (data === '[DONE]') {
    return { isDone: true };
  }

  try {
    const parsed = JSON.parse(data);
    const { responseParse } = template;

    // Check for error
    if (parsed.error) {
      throw new Error(parsed.error.message || 'API Error');
    }

    const result: ParsedStreamChunk = { isDone: false };

    // Extract content
    if (responseParse.contentPath) {
      const content = getNestedValue(parsed, responseParse.contentPath);
      if (content) {
        result.content = content;
      }
    }

    // Extract reasoning
    if (responseParse.reasoningPath) {
      const reasoning = getNestedValue(parsed, responseParse.reasoningPath);
      if (reasoning) {
        result.reasoning = reasoning;
      }
    }

    // Extract tool calls
    if (responseParse.toolCallsPath) {
      const toolCalls = getNestedValue(parsed, responseParse.toolCallsPath);
      if (toolCalls && toolCalls.length > 0) {
        result.toolCalls = toolCalls.map((tc: any) => ({
          id: tc.id || `tool_${Date.now()}`,
          type: 'function',
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '{}',
          },
        }));
      }
    }

    // Extract usage
    if (responseParse.usagePath) {
      const usage = getNestedValue(parsed, responseParse.usagePath);
      if (usage) {
        result.usage = {
          input: usage.prompt_tokens || usage.input_tokens || 0,
          output: usage.completion_tokens || usage.output_tokens || 0,
          total: usage.total_tokens || 0,
        };
      }
    }

    return result;
  } catch (e) {
    // Handle parsing errors gracefully
    if (e instanceof SyntaxError) {
      console.warn('[RequestBuilder] Failed to parse chunk:', data.slice(0, 100));
      return null;
    }
    throw e;
  }
}

// Parse a non-streaming response
export function parseResponse(
  template: APITemplate,
  data: any
): ParsedStreamChunk {
  const { responseParse } = template;

  const result: ParsedStreamChunk = { isDone: true };

  // For non-streaming, the content path might be different
  const contentPath = responseParse.contentPath.replace('.delta.', '.message.');
  const content = getNestedValue(data, contentPath) || getNestedValue(data, responseParse.contentPath);
  if (content) {
    result.content = content;
  }

  // Extract tool calls from message
  if (responseParse.toolCallsPath) {
    const toolCallsPath = responseParse.toolCallsPath.replace('.delta.', '.message.');
    const toolCalls = getNestedValue(data, toolCallsPath);
    if (toolCalls && toolCalls.length > 0) {
      result.toolCalls = toolCalls.map((tc: any) => ({
        id: tc.id || `tool_${Date.now()}`,
        type: 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '{}',
        },
      }));
    }
  }

  // Extract usage
  if (responseParse.usagePath) {
    const usage = getNestedValue(data, responseParse.usagePath);
    if (usage) {
      result.usage = {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0,
        total: usage.total_tokens || 0,
      };
    }
  }

  return result;
}

// Build URL with optional query params (for APIs like Gemini that use query params)
export function buildURL(
  template: APITemplate,
  endpoint: string,
  apiKey?: string
): string {
  // Some APIs like Gemini might need API key in query params
  if (template.id === 'gemini' && apiKey) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}key=${apiKey}`;
  }
  return endpoint;
}
