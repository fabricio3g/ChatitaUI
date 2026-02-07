/**
 * OpenAI Provider Implementation
 * Handles streaming chat completions via OpenAI-compatible APIs (OpenAI, OpenRouter, etc.)
 */

import EventSource, { EventSourceListener } from 'react-native-sse';
import { LLMProvider, LLMConfig, StreamChunk, LLMProviderId } from './types';
import { Message } from '../../types/message';

export class OpenAIProvider implements LLMProvider {
    id: LLMProviderId = 'openai';
    name = 'OpenAI Compatible';
    supportsNativeTools = true;
    supportsThinking = true; // o1, o3, and others support reasoning

    async *chatStream(messages: Message[], config: LLMConfig): AsyncGenerator<StreamChunk> {
        const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
        const apiKey = config.apiKey;

        console.log('[OpenAI Provider] Request config:', {
            url,
            model: config.model,
            hasApiKey: !!apiKey,
            hasSystemPrompt: !!config.systemPrompt,
            messageCount: messages.length
        });

        if (!apiKey && !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('10.0.2.2') && !url.includes('192.168.')) {
            console.warn('[OpenAI Provider] No API key configured for:', config.baseUrl);
        }

        const apiMessages = messages.filter(m => {
            // Filter out empty assistant messages that don't have tool calls
            // But KEEP assistant messages that HAVE tool calls, even if content is empty
            if (m.role === 'assistant' && !m.content && (!m.tool_calls || m.tool_calls.length === 0)) {
                return false;
            }
            return true;
        }).map(m => {
            // STRICT SANITIZATION
            const msg: any = {
                role: m.role,
                content: typeof m.content === 'string' ? m.content : ''
            };

            // Format for previous tool calls
            if (m.tool_calls) {
                msg.tool_calls = m.tool_calls.map((tc: any) => {
                    // Handle both flat (internal) and nested (OpenAI) formats
                    const name = tc.function?.name || tc.name;
                    const args = tc.function?.arguments || tc.arguments;

                    return {
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: name,
                            arguments: args
                        }
                    };
                });
            }

            // Format for tool response
            if (m.role === 'tool') {
                msg.tool_call_id = m.tool_call_id;
            }

            return msg;
        });

        if (config.systemPrompt) {
            apiMessages.unshift({ role: 'system', content: config.systemPrompt });
        }

        if (config.stream === false) {
            // === NON-STREAMING MODE ===
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        ...(config.baseUrl?.includes('openrouter') && {
                            'HTTP-Referer': 'https://kokorotts.app',
                            'X-Title': 'Kokoro TTS App',
                        }),
                    },
                    body: JSON.stringify({
                        model: config.model,
                        messages: apiMessages,
                        stream: false,
                        temperature: config.temperature || 0.7,
                        max_tokens: config.maxTokens,
                        ...(config.baseUrl?.includes('openrouter') && config.reasoning && Object.keys(config.reasoning).length > 0 && { reasoning: config.reasoning }),
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API Error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content || '';

                yield { content, isDone: false };
                yield { content: '', isDone: true };
                return;

            } catch (error) {
                console.error('Non-streaming fetch error:', error);
                throw error;
            }
        }

        // === STREAMING MODE (Default) ===
        // When API key is present, use fetch() so Authorization header is sent reliably (fixes 401 with OpenRouter).
        // EventSource in react-native-sse may not send custom headers on POST.
        const streamBody = {
            model: config.model,
            messages: apiMessages,
            stream: true,
            stream_options: { include_usage: true },
            temperature: config.temperature || 0.7,
            max_tokens: config.maxTokens || 8192,
            tools: config.tools?.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }
            })),
            ...(config.baseUrl?.includes('openrouter') && { route: 'fallback' as const }),
            tool_choice: 'auto' as const,
            // OpenRouter reasoning tokens (https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
            ...(config.baseUrl?.includes('openrouter') && config.reasoning && Object.keys(config.reasoning).length > 0 && { reasoning: config.reasoning }),
        };
        const streamHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
            ...(config.baseUrl?.includes('openrouter') && {
                'HTTP-Referer': 'https://kokorotts.app',
                'X-Title': 'Kokoro TTS App',
            }),
        };

        if (apiKey) {
            const response = await fetch(url, {
                method: 'POST',
                headers: streamHeaders,
                body: JSON.stringify(streamBody),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }
            const resBody = response.body;
            const canStream = resBody && typeof (resBody as any).getReader === 'function';
            if (!canStream) {
                // React Native / some runtimes don't support response.body stream; use non-streaming request instead so auth works
                console.log('[OpenAIProvider] Falling back to non-streaming request');
                const fallbackBody = { ...streamBody, stream: false };
                const fallbackRes = await fetch(url, {
                    method: 'POST',
                    headers: streamHeaders,
                    body: JSON.stringify(fallbackBody),
                });
                if (!fallbackRes.ok) {
                    const errText = await fallbackRes.text();
                    throw new Error(`API Error: ${fallbackRes.status} - ${errText}`);
                }
                const data = await fallbackRes.json();
                console.log('[OpenAIProvider] Non-stream response keys:', Object.keys(data));
                
                const message = data.choices?.[0]?.message;
                const content = message?.content ?? '';
                const toolCalls = message?.tool_calls;
                
                // Yield usage first
                if (data.usage) {
                    yield {
                        content: '',
                        isDone: false,
                        tokenUsage: {
                            input: data.usage.prompt_tokens,
                            output: data.usage.completion_tokens,
                            total: data.usage.total_tokens,
                        },
                    };
                }
                
                // Yield tool calls if present
                if (toolCalls && toolCalls.length > 0) {
                    console.log('[OpenAIProvider] Non-stream tool calls:', toolCalls.length);
                    yield {
                        content: '',
                        isDone: false,
                        toolCalls: toolCalls.map((tc: any) => ({
                            id: tc.id || `tool_${Date.now()}`,
                            type: 'function',
                            function: {
                                name: tc.function?.name || '',
                                arguments: tc.function?.arguments || '{}'
                            }
                        }))
                    };
                }
                
                // Yield content
                if (content) {
                    yield { content, isDone: false };
                }
                
                yield { content: '', isDone: true };
                return;
            }
            {
                const reader = (resBody as ReadableStream<Uint8Array>).getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fetchToolCalls: Record<number, { id: string; function: { name: string; arguments: string } }> = {};
                let fetchLastReasoning = '';

                const processOne = (data: string): any[] => {
                    const items: any[] = [];
                    if (data === '[DONE]') return [{ done: true }];
                    try {
                        const parsed = JSON.parse(data || '{}');
                        
                        // Handle usage stats
                        if (parsed.usage) {
                            items.push({
                                tokenUsage: {
                                    input: parsed.usage.prompt_tokens,
                                    output: parsed.usage.completion_tokens,
                                    total: parsed.usage.total_tokens
                                },
                                done: false
                            });
                        }
                        
                        const choice = parsed.choices?.[0];
                        
                        // Handle tool calls in delta (streaming format)
                        if (choice?.delta?.tool_calls) {
                            console.log('[OpenAIProvider] Tool calls in delta:', JSON.stringify(choice.delta.tool_calls));
                            for (const tc of choice.delta.tool_calls) {
                                const idx = tc.index ?? 0;
                                if (!fetchToolCalls[idx]) fetchToolCalls[idx] = { id: '', function: { name: '', arguments: '' } };
                                if (tc.id) fetchToolCalls[idx].id = tc.id;
                                if (tc.function?.name) fetchToolCalls[idx].function.name = tc.function.name;
                                if (tc.function?.arguments) fetchToolCalls[idx].function.arguments += tc.function.arguments;
                            }
                        }
                        
                        // Handle tool calls in message (non-streaming or final message format)
                        if (choice?.message?.tool_calls) {
                            console.log('[OpenAIProvider] Tool calls in message:', JSON.stringify(choice.message.tool_calls));
                            for (const tc of choice.message.tool_calls) {
                                const idx = tc.index ?? Object.keys(fetchToolCalls).length;
                                fetchToolCalls[idx] = {
                                    id: tc.id || `tool_${Date.now()}`,
                                    function: {
                                        name: tc.function?.name || '',
                                        arguments: tc.function?.arguments || '{}'
                                    }
                                };
                            }
                        }
                        
                        // Emit tool calls on finish_reason
                        if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop' && Object.keys(fetchToolCalls).length > 0) {
                            const tools = Object.values(fetchToolCalls);
                            if (tools.length > 0) {
                                console.log('[OpenAIProvider] Emitting tool calls:', tools.length);
                                items.push({ toolCalls: tools.map(t => ({ ...t, type: 'function' })), done: false });
                                fetchToolCalls = {};
                            }
                        }
                        
                        // Get content from delta (streaming) or message (non-streaming)
                        const content = choice?.delta?.content || choice?.message?.content || '';
                        const reasoning = choice?.delta?.reasoning || choice?.message?.reasoning || '';
                        
                        if (content || reasoning) {
                            if (reasoning) {
                                if (reasoning.length > fetchLastReasoning.length && reasoning.startsWith(fetchLastReasoning)) {
                                    const newR = reasoning.slice(fetchLastReasoning.length);
                                    fetchLastReasoning = reasoning;
                                    if (newR) items.push({ reasoning: newR, done: false });
                                } else if (reasoning !== fetchLastReasoning) {
                                    fetchLastReasoning = reasoning;
                                    items.push({ reasoning, done: false });
                                }
                            }
                            if (content) items.push({ content, done: false });
                        }
                        
                        // Log full structure for debugging (only for chunks with data we might miss)
                        if (!content && !reasoning && !parsed.usage && !choice?.delta?.tool_calls && !choice?.message?.tool_calls && choice) {
                            console.log('[OpenAIProvider] Raw chunk:', JSON.stringify(parsed).slice(0, 500));
                        }
                    } catch (e) {
                        console.log('[OpenAIProvider] Parse error:', e, 'data:', data.slice(0, 200));
                    }
                    return items;
                };

                try {
                    let chunkCount = 0;
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const decoded = decoder.decode(value, { stream: true });
                        buffer += decoded;
                        chunkCount++;
                        
                        // Log first few raw chunks for debugging
                        if (chunkCount <= 3) {
                            console.log(`[OpenAIProvider] Raw chunk ${chunkCount}:`, decoded.slice(0, 300));
                        }
                        
                        // Try both \n\n and single \n as delimiters (some APIs differ)
                        const parts = buffer.split(/\n\n|\r\n\r\n/);
                        buffer = parts.pop() || '';
                        
                        for (const part of parts) {
                            // Find data line - could be preceded by other lines
                            const lines = part.split(/\n|\r\n/);
                            const dataLine = lines.find(l => l.startsWith('data: '));
                            if (!dataLine) continue;
                            const data = dataLine.slice(6).trim();
                            if (!data) continue;
                            for (const item of processOne(data)) {
                                if (item.done) {
                                    const tools = Object.values(fetchToolCalls);
                                    if (tools.length > 0) {
                                        yield { content: '', isDone: false, toolCalls: tools.map(t => ({ ...t, type: 'function' })) };
                                    }
                                    yield { content: '', isDone: true };
                                    return;
                                }
                                yield {
                                    content: item.content || '',
                                    isDone: false,
                                    reasoning: item.reasoning,
                                    toolCalls: item.toolCalls,
                                    tokenUsage: item.tokenUsage
                                };
                            }
                        }
                    }
                    if (buffer) {
                        const line = buffer.split('\n').find(l => l.startsWith('data: '));
                        if (line) {
                            const data = line.slice(6).trim();
                            if (data && data !== '[DONE]') {
                                for (const item of processOne(data)) {
                                    if (!item.done) yield { content: item.content || '', isDone: false, reasoning: item.reasoning, toolCalls: item.toolCalls, tokenUsage: item.tokenUsage };
                                }
                            }
                        }
                    }
                    // Flush any accumulated tool_calls when stream ends (some APIs send usage last without finish_reason)
                    const remainingTools = Object.values(fetchToolCalls);
                    if (remainingTools.length > 0) {
                        yield { content: '', isDone: false, toolCalls: remainingTools.map(t => ({ ...t, type: 'function' })) };
                    }
                } finally {
                    reader.releaseLock?.();
                }
                yield { content: '', isDone: true };
                return;
            }

        } // end if (apiKey) fetch path

        const eventSource = new EventSource(url, {
            method: 'POST',
            headers: streamHeaders,
            body: JSON.stringify(streamBody),
        });

        // We need to bridge EventSource to AsyncGenerator. 
        // This requires a push-pull buffer or a promise queue.

        let resolveNext: ((value: any) => void) | null = null;
        let rejectNext: ((reason: any) => void) | null = null;
        const queue: any[] = [];
        let closed = false;

        // Tool call accumulation
        let currentToolCalls: Record<number, { id: string, function: { name: string, arguments: string } }> = {};

        // Reasoning tracking - some providers send full reasoning each time
        let lastReasoning = '';

        const push = (item: any) => {
            if (resolveNext) {
                const resolve = resolveNext;
                resolveNext = null;
                rejectNext = null;
                resolve(item);
            } else {
                queue.push(item);
            }
        };

        eventSource.addEventListener('message', (event) => {
            if (event.data === '[DONE]') {
                // If we have accumulated tool calls, emit them before closing
                const tools = Object.values(currentToolCalls);
                if (tools.length > 0) {
                    push({ toolCalls: tools.map(t => ({ ...t, type: 'function' })), done: false });
                }
                push({ done: true });
                eventSource.close();
                closed = true;
                return;
            }
            try {
                console.log('[OpenAIProvider] Raw SSE:', event.data);
                const parsed = JSON.parse(event.data || '{}');

                if (parsed.usage) {
                    push({
                        tokenUsage: {
                            input: parsed.usage.prompt_tokens,
                            output: parsed.usage.completion_tokens,
                            total: parsed.usage.total_tokens
                        },
                        done: false
                    });
                }

                const choice = parsed.choices?.[0];

                if (choice?.delta?.tool_calls) {
                    console.log('[OpenAIProvider] Received tool_calls delta:', JSON.stringify(choice.delta.tool_calls));
                    const toolCalls = choice.delta.tool_calls;
                    for (const tc of toolCalls) {
                        const index = tc.index;
                        if (!currentToolCalls[index]) {
                            currentToolCalls[index] = { id: '', function: { name: '', arguments: '' } };
                        }
                        if (tc.id) currentToolCalls[index].id = tc.id;
                        if (tc.function?.name) currentToolCalls[index].function.name = tc.function.name;
                        if (tc.function?.arguments) currentToolCalls[index].function.arguments += tc.function.arguments;
                    }
                }

                // If finish_reason is 'tool_calls', the stream might end here or send [DONE]
                if (choice?.finish_reason === 'tool_calls' || (choice?.finish_reason && Object.keys(currentToolCalls).length > 0)) {
                    const tools = Object.values(currentToolCalls);
                    if (tools.length > 0) {
                        console.log(`[OpenAIProvider] Emitting ${tools.length} tools on finish_reason`);
                        push({ toolCalls: tools.map(t => ({ ...t, type: 'function' })), done: false });
                        currentToolCalls = {}; // Clear to prevent double emit
                    }
                }

                const content = choice?.delta?.content || '';
                const reasoning = choice?.delta?.reasoning || '';

                // Handle reasoning - some providers send full text each time
                if (reasoning) {
                    // Check if this is the full text or just delta
                    if (reasoning.length > lastReasoning.length && reasoning.startsWith(lastReasoning)) {
                        // It's accumulating - send only the new part
                        const newReasoning = reasoning.slice(lastReasoning.length);
                        lastReasoning = reasoning;
                        if (newReasoning) {
                            push({ reasoning: newReasoning, done: false });
                        }
                    } else if (reasoning !== lastReasoning) {
                        // It's different content - could be a reset or different format
                        // Send the full reasoning and update our tracking
                        lastReasoning = reasoning;
                        push({ reasoning, done: false });
                    }
                    // If reasoning === lastReasoning, it's a duplicate - ignore
                }

                if (content) {
                    push({ content, done: false });
                }
            } catch (e) {
                console.warn('Parse error', e);
            }
        });

        eventSource.addEventListener('error', (event) => {
            // If connection failed immediately, it might be auth or net error
            if (!closed) {
                console.warn("SSE Error - attempting graceful shutdown", event);

                // FLUSH TOOLS ON ERROR/CLOSE
                const tools = Object.values(currentToolCalls);
                if (tools.length > 0) {
                    console.log('[OpenAIProvider] Flushing tools on error/close:', tools.length);
                    push({ toolCalls: tools.map(t => ({ ...t, type: 'function' })), done: false });
                }

                push({ done: true });
                eventSource.close();
            }
        });

        eventSource.open();

        try {
            while (true) {
                if (queue.length > 0) {
                    const item = queue.shift();
                    if (item.done) break;
                    yield {
                        content: item.content || '',
                        isDone: false,
                        reasoning: item.reasoning,
                        toolCalls: item.toolCalls,
                        tokenUsage: item.tokenUsage
                    };
                    await new Promise(r => setTimeout(r, 0));
                } else {
                    const item = await new Promise<any>((resolve, reject) => {
                        resolveNext = resolve;
                        rejectNext = reject;
                    });
                    if (item.done) break;
                    yield {
                        content: item.content || '',
                        isDone: false,
                        reasoning: item.reasoning,
                        toolCalls: item.toolCalls,
                        tokenUsage: item.tokenUsage
                    };
                }
            }
        } finally {
            eventSource.close();
        }

        yield { content: '', isDone: true };
    }

    async checkConnection(config: LLMConfig): Promise<boolean> {
        try {
            const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Connection test failed:', errorText);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Connection test error:', error);
            return false;
        }
    }

    async getAvailableModels(config: LLMConfig): Promise<string[]> {
        try {
            const url = `${config.baseUrl || 'https://api.openai.com/v1'}/models`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const data = await response.json();
            console.log('[OpenAIProvider] Models response:', JSON.stringify(data));

            if (Array.isArray(data.data)) {
                return data.data.map((m: any) => m.id);
            }
            if (Array.isArray(data.models)) { // Ollama
                return data.models.map((m: any) => m.name || m.model);
            }

            return [];
        } catch (e: any) {
            console.error('Failed to fetch models', e);
            throw e; // Propagate error to UI
        }
    }
}
