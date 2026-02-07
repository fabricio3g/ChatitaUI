/**
 * Template-Based LLM Provider
 * 
 * A generic provider that uses API templates to support any API provider.
 * This eliminates the need to write custom provider code for each API.
 */

import { LLMProvider, LLMConfig, StreamChunk, LLMProviderId } from './types';
import { Message } from '../../types/message';
import {
  APITemplate,
  getTemplate,
  SamplerID,
} from './templates/APITemplates';
import {
  RequestBuildConfig,
  buildHeaders,
  buildRequestBody,
  parseStreamChunk,
  parseResponse,
  buildURL,
} from './templates/RequestBuilder';

// Configuration for template-based provider
export interface TemplateProviderConfig extends LLMConfig {
  templateId: string;
  customEndpoint?: string;
}

export class TemplateBasedProvider implements LLMProvider {
  id: LLMProviderId;
  name: string;
  template: APITemplate;

  supportsNativeTools: boolean;
  supportsThinking: boolean;

  constructor(templateOrId: APITemplate | string) {
    if (typeof templateOrId === 'string') {
      const template = getTemplate(templateOrId);
      if (!template) {
        throw new Error(`Template not found: ${templateOrId}`);
      }
      this.template = template;
    } else {
      this.template = templateOrId;
    }

    this.id = this.template.id as LLMProviderId;
    this.name = this.template.name;
    this.supportsNativeTools = this.template.features.supportsTools;
    this.supportsThinking = this.template.features.supportsReasoning;
  }

  async *chatStream(
    messages: Message[],
    config: TemplateProviderConfig
  ): AsyncGenerator<StreamChunk> {
    const endpoint = config.customEndpoint || config.baseUrl || this.template.defaultEndpoint;
    const url = buildURL(this.template, endpoint, config.apiKey);

    // Build request
    const requestConfig: RequestBuildConfig = {
      template: this.template,
      apiKey: config.apiKey,
      model: config.model,
      messages,
      samplers: this.mapSamplers(config),
      stream: config.stream !== false,
      tools: config.tools,
      systemPrompt: config.systemPrompt,
    };

    const headers = buildHeaders(this.template, config.apiKey);
    const body = buildRequestBody(requestConfig);

    console.log(`[TemplateProvider:${this.id}] Sending request to ${url}`, {
      model: config.model,
      messageCount: messages.length,
      hasTools: !!config.tools && config.tools.length > 0,
    });

    // For non-streaming or fallback
    if (config.stream === false) {
      yield* this.nonStreamingRequest(url, headers, body);
      return;
    }

    try {
      yield* this.streamingRequest(url, headers, body);
    } catch (error: any) {
      // If streaming fails, try non-streaming fallback
      console.warn(`[TemplateProvider:${this.id}] Streaming failed, trying non-streaming:`, error.message);
      yield* this.nonStreamingRequest(url, headers, { ...body, stream: false });
    }
  }

  private async *streamingRequest(
    url: string,
    headers: Record<string, string>,
    body: any
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const resBody = response.body;
    if (!resBody || typeof (resBody as any).getReader !== 'function') {
      // React Native may not support streaming, fallback to non-streaming
      console.log('[TemplateProvider] Streaming not supported, falling back to non-streaming');
      const data = await response.json();
      const parsed = parseResponse(this.template, data);
      yield {
        content: parsed.content || '',
        isDone: false,
        reasoning: parsed.reasoning,
        tokenUsage: parsed.usage,
        toolCalls: parsed.toolCalls,
      };
      yield { content: '', isDone: true };
      return;
    }

    const reader = (resBody as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Accumulators
    let currentToolCalls: Map<number, any> = new Map();
    let lastReasoning = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6).trim();
          if (!data) continue;

          const chunk = parseStreamChunk(this.template, data);
          if (!chunk) continue;

          if (chunk.isDone) {
            // Flush any accumulated tool calls
            if (currentToolCalls.size > 0) {
              const tools = Array.from(currentToolCalls.values());
              yield {
                content: '',
                isDone: false,
                toolCalls: tools.map(t => ({ ...t, type: 'function' })),
              };
              currentToolCalls.clear();
            }
            yield { content: '', isDone: true };
            return;
          }

          // Accumulate tool calls (they come in parts)
          if (chunk.toolCalls) {
            for (const tc of chunk.toolCalls) {
              const index = tc.index || 0;
              if (!currentToolCalls.has(index)) {
                currentToolCalls.set(index, { id: '', function: { name: '', arguments: '' } });
              }
              const existing = currentToolCalls.get(index);
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name = tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }

          // Handle reasoning delta
          let reasoningDelta: string | undefined;
          if (chunk.reasoning) {
            if (chunk.reasoning.length > lastReasoning.length && chunk.reasoning.startsWith(lastReasoning)) {
              reasoningDelta = chunk.reasoning.slice(lastReasoning.length);
              lastReasoning = chunk.reasoning;
            } else if (chunk.reasoning !== lastReasoning) {
              reasoningDelta = chunk.reasoning;
              lastReasoning = chunk.reasoning;
            }
          }

          // Yield content/reasoning
          if (chunk.content || reasoningDelta) {
            yield {
              content: chunk.content || '',
              isDone: false,
              reasoning: reasoningDelta,
              tokenUsage: chunk.usage,
            };
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          const chunk = parseStreamChunk(this.template, data);
          if (chunk && !chunk.isDone) {
            if (chunk.content || chunk.reasoning) {
              yield {
                content: chunk.content || '',
                isDone: false,
                reasoning: chunk.reasoning,
                tokenUsage: chunk.usage,
              };
            }
          }
        }
      }

      // Flush any remaining tool calls
      if (currentToolCalls.size > 0) {
        const tools = Array.from(currentToolCalls.values());
        yield {
          content: '',
          isDone: false,
          toolCalls: tools.map(t => ({ ...t, type: 'function' })),
        };
      }
    } finally {
      reader.releaseLock?.();
    }

    yield { content: '', isDone: true };
  }

  private async *nonStreamingRequest(
    url: string,
    headers: Record<string, string>,
    body: any
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const parsed = parseResponse(this.template, data);

    yield {
      content: parsed.content || '',
      isDone: false,
      reasoning: parsed.reasoning,
      tokenUsage: parsed.usage,
      toolCalls: parsed.toolCalls,
    };
    yield { content: '', isDone: true };
  }

  async checkConnection(config: TemplateProviderConfig): Promise<boolean> {
    try {
      const endpoint = config.customEndpoint || config.baseUrl || this.template.defaultEndpoint;
      const url = endpoint.replace('/chat/completions', '/models');

      const headers = buildHeaders(this.template, config.apiKey);

      // Some APIs don't have a models endpoint, so we do a minimal completion test
      const testUrl = this.template.modelList?.endpoint || url;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return true;
      }

      // If models endpoint fails, try a minimal completion
      const completionUrl = endpoint;
      const body = buildRequestBody({
        template: this.template,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ role: 'user', content: 'hi', timestamp: Date.now(), conversationId: 'test', id: 'test' }],
        samplers: { [SamplerID.MAX_TOKENS]: 1 },
        stream: false,
      });

      const testResponse = await fetch(completionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      return testResponse.ok;
    } catch (error) {
      console.error(`[TemplateProvider:${this.id}] Connection check failed:`, error);
      return false;
    }
  }

  async getAvailableModels(config: TemplateProviderConfig): Promise<string[]> {
    if (!this.template.modelList) {
      return [];
    }

    try {
      const endpoint = config.customEndpoint || config.baseUrl || this.template.defaultEndpoint;
      let url = this.template.modelList.endpoint;

      // If modelList endpoint is relative, resolve against base endpoint
      if (!url.startsWith('http')) {
        const baseUrl = endpoint.replace('/chat/completions', '').replace('/v1/', '/');
        url = `${baseUrl}${url}`;
      }

      const headers = buildHeaders(this.template, config.apiKey);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const { modelList } = this.template;

      const models = getNestedValue(data, modelList.modelArrayPath) || [];

      return models
        .map((m: any) => getNestedValue(m, modelList.namePath) || m.id || m.name)
        .filter(Boolean);
    } catch (error) {
      console.error(`[TemplateProvider:${this.id}] Failed to fetch models:`, error);
      return [];
    }
  }

  private mapSamplers(config: LLMConfig): Partial<Record<SamplerID, any>> {
    const samplers: Partial<Record<SamplerID, any>> = {};

    if (config.temperature !== undefined) {
      samplers[SamplerID.TEMPERATURE] = config.temperature;
    }
    if (config.maxTokens !== undefined) {
      samplers[SamplerID.MAX_TOKENS] = config.maxTokens;
    }

    return samplers;
  }
}

// Helper to get nested value (re-export for convenience)
function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result === null || result === undefined) return undefined;
    result = result[key];
  }
  return result;
}
