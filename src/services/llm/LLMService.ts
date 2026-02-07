
// Unified LLM Service
// Manages providers and configurations
// Singleton pattern for easy access


import { LLMProvider, LLMConfig, StreamChunk, ModelMode, VisionConfig } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpenAIProvider } from './OpenAIProvider';
import { LOCAL_INFERENCE_ENABLED } from '../../config/localInference';
import ToolSimulator from './ToolSimulator';
import { ToolRegistry } from '../tools/ToolRegistry';
import { Message } from '../../types/message';

class LLMServiceClass {
    private providers: Map<string, LLMProvider> = new Map();
    private activeProviderId: string = 'openai'; // Default
    private config: LLMConfig = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        mode: 'api',
        visionConfig: {
            provider: 'openai',
            model: 'gpt-4o',
            enabled: true,
            useSeparate: false,  // Default: use same provider as LLM
            baseUrl: '',
            apiKey: '',
        },
        ragEmbeddingSource: 'api',
        embeddingModel: 'text-embedding-3-small',
        ragBaseUrl: '',
        ragApiKey: '',
        // User needs to set API key in settings
    };

    constructor() {
        this.registerProvider(new OpenAIProvider());
        // Register local LlamaRN provider only if local inference is enabled
        if (LOCAL_INFERENCE_ENABLED.LLM) {
            const { LlamaRNProvider } = require('./LlamaRNProvider');
            this.registerProvider(new LlamaRNProvider(this.config));
        }
        // Will add others: Ollama, Anthropic
    }

    registerProvider(provider: LLMProvider) {
        this.providers.set(provider.id, provider);
    }

    get activeProvider(): LLMProvider {
        // Alias openrouter to openai since OpenAIProvider handles it
        const targetId = this.activeProviderId === 'openrouter' ? 'openai' : this.activeProviderId;
        const provider = this.providers.get(targetId);
        if (!provider) throw new Error(`Provider ${targetId} (requested: ${this.activeProviderId}) not found`);
        return provider;
    }

    setConfig(config: Partial<LLMConfig>) {
        this.config = { ...this.config, ...config };
        if (config.provider) {
            this.activeProviderId = config.provider;

            // Respect explicit mode from caller; only infer mode when mode is omitted
            if (!config.mode) {
                if (config.provider === 'llama_rn') {
                    this.config.mode = 'local';
                } else {
                    this.config.mode = 'api';
                }
            }
        }
        // Persist config changes
        this.persistConfig();
    }

    getConfig(): LLMConfig {
        return this.config;
    }

    async loadLocalModel(modelId: string): Promise<boolean> {
        try {
            if (this.activeProviderId !== 'llama_rn') {
                this.activeProviderId = 'llama_rn';
                this.config.provider = 'llama_rn';
            }
            this.config.localConfig = {
                ...(this.config.localConfig || { llmModelId: null, visionModelId: null }),
                llmModelId: modelId,
            };
            const provider = this.activeProvider;
            if (provider.loadModel) {
                const ok = await provider.loadModel(modelId, this.config);
                await this.persistConfig();
                return ok;
            }
        } catch (e) {
            console.warn('[LLMService] loadLocalModel failed:', e);
        }
        return false;
    }

    async unloadLocalModel(): Promise<void> {
        const provider = this.activeProviderId === 'llama_rn' ? this.activeProvider : this.providers.get('llama_rn');
        if (provider?.unloadModel) {
            await provider.unloadModel();
        }
    }

    getLoadedLocalModelId(): string | null {
        const provider = this.activeProviderId === 'llama_rn' ? this.activeProvider : this.providers.get('llama_rn');
        return provider?.getLoadedModelId ? provider.getLoadedModelId() : null;
    }

    // ==================== MODE MANAGEMENT ====================

    /**
     * Initialize service and load persisted config
     */
    async initialize(): Promise<void> {
        try {
            const savedConfig = await AsyncStorage.getItem('llm_config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                if (parsed.provider) {
                    this.activeProviderId = parsed.provider;
                }
                console.log('[LLMService] Loaded config:', { mode: this.config.mode, provider: this.config.provider });
            }
        } catch (e) {
            console.warn('[LLMService] Failed to load config:', e);
        }
    }

    /**
     * Persist current config to storage
     */
    private async persistConfig(): Promise<void> {
        try {
            await AsyncStorage.setItem('llm_config', JSON.stringify(this.config));
        } catch (e) {
            console.warn('[LLMService] Failed to persist config:', e);
        }
    }

    /**
     * Set operation mode (API or Local) - mutually exclusive
     */
    async setMode(mode: ModelMode): Promise<void> {
        if (mode === this.config.mode) return;

        if (mode === 'mixed') {
            this.config.mode = 'mixed';
            // Don't change provider or any feature defaults; user chooses each independently
        } else if (mode === 'local') {
            const hasLocal = await this.hasLocalModels();
            if (!hasLocal) {
                throw new Error('No local models available. Download a model first.');
            }
            this.config.mode = 'local';
            this.config.provider = 'llama_rn';
            this.activeProviderId = 'llama_rn';
        } else {
            this.config.mode = 'api';
            if (this.activeProviderId === 'llama_rn' || !this.activeProviderId) {
                this.activeProviderId = 'openai';
                this.config.provider = 'openai';
            }
        }

        await this.persistConfig();
        console.log('[LLMService] Mode switched to:', mode);
    }

    /**
     * Get current operation mode
     */
    getMode(): ModelMode {
        return this.config.mode || 'api';
    }

    // ==================== VISION CONFIGURATION ====================

    /**
     * Configure vision settings separately from LLM
     */
    async setVisionConfig(config: Partial<VisionConfig>): Promise<void> {
        const current = this.config.visionConfig || {
            provider: 'openai',
            model: 'gpt-4o',
            enabled: true,
            useSeparate: false
        };
        this.config.visionConfig = { ...current, ...config };
        await this.persistConfig();
    }

    /**
     * Get vision configuration
     */
    getVisionConfig(): VisionConfig | undefined {
        return this.config.visionConfig;
    }

    /**
     * Get the active vision provider based on configuration
     */
    getVisionProvider(): LLMProvider {
        const visionConfig = this.config.visionConfig;

        if (!visionConfig?.enabled) {
            return this.activeProvider;  // Fallback to LLM provider
        }

        if (visionConfig.useSeparate && visionConfig.provider) {
            const visionProviderId = visionConfig.provider === 'openrouter'
                ? 'openai'
                : visionConfig.provider;
            const provider = this.providers.get(visionProviderId);
            if (provider) return provider;
        }

        return this.activeProvider;
    }

    /**
     * Check if vision is supported with current configuration
     */
    async supportsVision(): Promise<boolean> {
        const visionConfig = this.config.visionConfig;

        if (visionConfig?.enabled === false) {
            return false;
        }

        const visionProvider = this.getVisionProvider();

        if (visionProvider.id === 'llama_rn') {
            // Check if we have a vision-capable local model configured
            return !!this.config.localConfig?.visionModelId;
        }

        // Cloud providers that support vision
        return ['openai', 'openrouter', 'groq', 'mistral'].includes(visionProvider.id);
    }

    /**
     * Check if local models are available
     */
    private async hasLocalModels(): Promise<boolean> {
        try {
            const { getDownloadedLlamaModels } = require('./llama/models');
            const models = await getDownloadedLlamaModels();
            return models.length > 0;
        } catch {
            return false;
        }
    }

    async checkConnection(): Promise<boolean> {
        return this.activeProvider.checkConnection ? this.activeProvider.checkConnection(this.config) : false;
    }

    async checkConnectionDetail(): Promise<{ success: boolean; error?: string }> {
        if (!this.activeProvider.checkConnection) return { success: false, error: 'Provider does not support checkConnection' };
        // We need to modify provider interface or cast to access detailed error if we want it clean
        // For now, let's implement a direct check here or wrap it.
        // Actually, let's just use the provider's check logic but capture error.

        // Quick hack: The provider prints to console.error.
        // We should really update the provider interface.
        // But for speed, let's just make OpenAIProvider throw or return detail.
        // Since I can't easily change the interface everywhere without touching all files,
        // let's add a robust check here specifically for OpenAI/HTTP providers.

        const config = this.config;
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
                const text = await response.text();
                return { success: false, error: `${response.status} ${text.substring(0, 100)}` };
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message || 'Network request failed' };
        }
    }

    async fetchModels(): Promise<string[]> {
        return this.activeProvider.getAvailableModels ? this.activeProvider.getAvailableModels(this.config) : [];
    }


    // Main Streaming Method
    async *streamChat(messages: Message[], extraConfig?: Partial<LLMConfig>): AsyncGenerator<StreamChunk> {
        // Support provider override for vision mode
        let provider = this.activeProvider;
        const currentRunConfig = { ...this.config, ...extraConfig };

        // If a specific provider ID is requested (for vision mode), use it
        if (extraConfig?.provider && extraConfig.provider !== this.activeProviderId) {
            const targetId = extraConfig.provider === 'openrouter' ? 'openai' : extraConfig.provider;
            const overrideProvider = this.providers.get(targetId);
            if (overrideProvider) {
                provider = overrideProvider;
            }
        }

        // Ensure we have configuration
        if (!currentRunConfig.apiKey && currentRunConfig.provider !== 'local' && currentRunConfig.provider !== 'llama_rn') {
            // For demo purposes, we might want to throw or handle gracefully
        }

        const availableTools = ToolRegistry.getAllTools();
        const toolDefinitions = availableTools.map((t: any) => t.definition);

        let currentMessages = [...messages];

        // 1. Inject User Profile
        if (currentRunConfig.userName || currentRunConfig.userPersona) {
            let profileContext = '';
            if (currentRunConfig.userName) profileContext += `\nUser's Name: ${currentRunConfig.userName}`;
            if (currentRunConfig.userPersona) profileContext += `\nUser Context/Instructions: ${currentRunConfig.userPersona}`;

            const sysIdx = currentMessages.findIndex(m => m.role === 'system');
            if (sysIdx >= 0) {
                const sysContent = currentMessages[sysIdx].content;
                const sysContentStr = typeof sysContent === 'string' ? sysContent : '';
                // Determine if we need to add it (avoid double addition if already in history)
                if (!sysContentStr.includes('User Context/Instructions:')) {
                    currentMessages[sysIdx] = {
                        ...currentMessages[sysIdx],
                        content: sysContentStr + profileContext
                    } as any;
                }
            } else {
                currentMessages.unshift({
                    id: 'sys_' + Date.now(),
                    conversationId: 'sys',
                    role: 'system',
                    content: "You are a helpful AI assistant." + profileContext,
                    timestamp: Date.now()
                });
            }
        }

        // 2. Prepare Tools - Check if simulated tools should be used
        const disableTools = extraConfig && extraConfig.tools && extraConfig.tools.length === 0;
        const providerSupportsNative = !!provider.supportsNativeTools;
        const simulatedToolsEnabled = currentRunConfig.simulatedToolsEnabled !== false;

        // For local models or when simulated is forced, always use simulated
        const forceSimulated = currentRunConfig.provider === 'llama_rn' || currentRunConfig.forceSimulated;
        const canUseNativeTools = providerSupportsNative && !disableTools && !forceSimulated;

        // Determine which tools to use
        const useTools = disableTools ? [] : toolDefinitions;
        const useSimulatedTools = !canUseNativeTools && simulatedToolsEnabled && useTools.length > 0;

        console.log('[LLMService] Tool setup:', {
            provider: this.activeProviderId,
            providerSupportsNative,
            forceSimulated,
            canUseNativeTools,
            useSimulatedTools,
            toolCount: useTools.length
        });

        // 3. Inject Tool Instructions for simulated mode
        if (useSimulatedTools) {
            console.log('[LLMService] Injecting tool instructions for simulated mode');
            const toolInstructions = ToolSimulator.getCompactToolInstructions(useTools);

            // Find last user message
            const lastUserIdx = currentMessages.findLastIndex(m => m.role === 'user');
            if (lastUserIdx >= 0) {
                const originalContent = currentMessages[lastUserIdx].content || '';
                // Avoid double injection
                if (typeof originalContent === 'string' && !originalContent.includes('[TOOLS]')) {
                    currentMessages[lastUserIdx] = {
                        ...currentMessages[lastUserIdx],
                        content: originalContent + "\n\n" + toolInstructions
                    };
                }
            }
        }

        let turnCount = 0;
        const MAX_TURNS = 5;

        while (turnCount < MAX_TURNS) {
            turnCount++;
            let toolCalls: any[] = [];
            let assistantContent = '';

            try {
                // Pass tools to provider ONLY if native supported
                const runConfig = {
                    ...currentRunConfig,
                    tools: canUseNativeTools && useTools.length > 0 ? useTools : undefined
                };

                const generator = provider.chatStream(currentMessages, runConfig);

                let collectedUsage = undefined;
                let reasoningContent = '';

                // Yield a "thinking" indicator at start
                yield { content: '', isDone: false, toolStart: { name: '_thinking', ttsMessage: 'Processing...' } };

                for await (const chunk of generator) {
                    // Debug: log each LLM chunk/reply
                    const preview = chunk.content ? (chunk.content.length > 60 ? chunk.content.slice(0, 60) + '…' : chunk.content) : '';
                    console.log('[LLMService] chunk', {
                        hasContent: !!chunk.content,
                        contentPreview: preview || undefined,
                        isDone: chunk.isDone,
                        hasReasoning: !!chunk.reasoning,
                        tokenUsage: chunk.tokenUsage,
                        toolCalls: chunk.toolCalls ? chunk.toolCalls.length : 0
                    });

                    // Collect native tool calls
                    if (chunk.toolCalls && chunk.toolCalls.length > 0) {
                        toolCalls = chunk.toolCalls;
                        console.log('[LLMService] Native tool calls received:', toolCalls.length);
                    }

                    // Collect token usage
                    if (chunk.tokenUsage) {
                        collectedUsage = chunk.tokenUsage;
                    }

                    // Collect and yield content/reasoning
                    if (chunk.content || chunk.reasoning) {
                        assistantContent += chunk.content || '';
                        reasoningContent += chunk.reasoning || '';
                        yield { ...chunk, reasoning: chunk.reasoning };
                    }
                }

                // Clear thinking indicator
                yield { content: '', isDone: false, toolEnd: { name: '_thinking' } };

                // Yield token usage if collected
                if (collectedUsage) {
                    yield { content: '', isDone: false, tokenUsage: collectedUsage };
                }

                // FALLBACK: If no native tool calls, try simulated parsing
                // This handles models that don't support native tools or when native fails
                if (toolCalls.length === 0 && useTools.length > 0 && assistantContent) {
                    console.log('[LLMService] No native tool calls, trying simulated parsing...');
                    const parsed = ToolSimulator.parseToolCalls(assistantContent);
                    if (parsed.toolCalls.length > 0) {
                        toolCalls = parsed.toolCalls;
                        // Clean the assistant content by removing the tool call text
                        assistantContent = parsed.remainingContent;
                        console.log('[LLMService] Found simulated tool calls:', toolCalls.length, toolCalls.map(t => t.function.name));
                        console.log('[LLMService] Cleaned assistant content length:', assistantContent.length);
                    }
                }

                // DETECTION: If we got usage showing output tokens but no content and no tools, the model
                // might not support native tools properly. Retry with simulated mode.
                if (!assistantContent && toolCalls.length === 0 && collectedUsage && collectedUsage.output > 0) {
                    console.warn('[LLMService] WARNING: Model returned', collectedUsage.output, 'tokens but we got no content or tool calls!');
                    console.warn('[LLMService] This model may not support native function calling. Retrying with simulated tools...');

                    // Only retry once - if already tried simulated, give up
                    if (canUseNativeTools && useTools.length > 0 && turnCount === 1) {
                        // Inject tool instructions and retry
                        const toolInstructions = ToolSimulator.getCompactToolInstructions(useTools);
                        const lastUserIdx = currentMessages.findLastIndex(m => m.role === 'user');
                        if (lastUserIdx >= 0) {
                            const originalContent = currentMessages[lastUserIdx].content || '';
                            if (typeof originalContent === 'string' && !originalContent.includes('[TOOLS]')) {
                                currentMessages[lastUserIdx] = {
                                    ...currentMessages[lastUserIdx],
                                    content: originalContent + "\n\n" + toolInstructions
                                };
                            }
                        }

                        // Retry without native tools
                        console.log('[LLMService] Retrying stream without native tools...');
                        const retryConfig = { ...currentRunConfig, tools: undefined };
                        const retryGenerator = provider.chatStream(currentMessages, retryConfig);

                        for await (const chunk of retryGenerator) {
                            if (chunk.content) assistantContent += chunk.content;
                            if (chunk.reasoning) reasoningContent += chunk.reasoning;
                            yield chunk;
                        }

                        // Try parsing simulated tools from retry response
                        if (assistantContent) {
                            const parsed = ToolSimulator.parseToolCalls(assistantContent);
                            if (parsed.toolCalls.length > 0) {
                                toolCalls = parsed.toolCalls;
                                // Clean the assistant content by removing the tool call text
                                assistantContent = parsed.remainingContent;
                                console.log('[LLMService] Found simulated tool calls after retry:', toolCalls.length);
                                console.log('[LLMService] Cleaned assistant content length after retry:', assistantContent.length);
                            }
                        }
                    }
                }

                // If we have tool calls, yield them
                if (toolCalls.length > 0) {
                    console.log('[LLMService] Yielding tool calls to caller:', toolCalls.length);

                    if (extraConfig?.disableAutoExecution) {
                        // Let caller handle execution
                        yield { content: '', isDone: false, toolCalls: toolCalls };
                        yield { content: '', isDone: true };
                        return;
                    }
                    // Otherwise continue to execute tools below
                } else {
                    // No tool calls - we're done
                    if (assistantContent) {
                        console.log('[LLMService] Stream complete with content');
                    } else {
                        console.log('[LLMService] Stream complete (no content or tools)');
                    }
                    yield { content: '', isDone: true };
                    return;
                }

                // If we get here with disableAutoExecution, break
                if (extraConfig?.disableAutoExecution) {
                    break;
                }

                // Handle Tool Execution
                console.log(`[LLMService] Executing ${toolCalls.length} tools...`);

                // Add assistant message (if simulated, content already includes the call text, so we keep it)
                currentMessages.push({
                    role: 'assistant',
                    content: assistantContent || null,
                    tool_calls: toolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments
                        }
                    }))
                } as any);

                // Execute Tools in Parallel
                console.log(`[LLMService] Executing ${toolCalls.length} tools in parallel...`);

                // 1. Yield all start events so UI shows them
                for (const tc of toolCalls) {
                    yield {
                        content: '',
                        isDone: false,
                        toolStart: {
                            name: tc.function.name,
                            ttsMessage: ToolRegistry.getTTSMessage(tc.function.name)
                        }
                    };
                }

                // 2. Map tool calls to execution promises
                const executionPromises = toolCalls.map(async (tc) => {
                    let result = '';
                    let output: any = null;
                    try {
                        const args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
                        console.log(`[LLMService] Calling tool ${tc.function.name} concurrently...`);

                        output = await ToolRegistry.executeTool(tc.function.name, args);
                        result = JSON.stringify(output);
                    } catch (e: any) {
                        console.error(`[LLMService] Tool ${tc.name} failed:`, e);
                        result = JSON.stringify({ error: e.message });
                    }

                    // Extract metadata if it's a ToolResponse
                    let toolResponseMeta = undefined;
                    try {
                        if (typeof output === 'object' && output !== null && 'type' in output) {
                            toolResponseMeta = output;
                        }
                    } catch (e) { }

                    return { tc, result, toolResponseMeta };
                });

                // 3. Wait for all tools to complete
                const executedResults = await Promise.all(executionPromises);

                // 4. Yield end events and push messages to history
                for (const res of executedResults) {
                    yield { content: '', isDone: false, toolEnd: { name: res.tc.function.name } };

                    currentMessages.push({
                        role: 'tool',
                        content: res.result,
                        tool_call_id: res.tc.id,
                        metadata: {
                            toolResponse: res.toolResponseMeta
                        }
                    } as any);
                }

                // Loop continues to next turn to get the answer based on tool outputs

            } catch (error: any) {
                // Check for "No endpoints found that support tool use" (404)
                const errorMsg = error.message || '';
                const isToolSupportError = errorMsg.includes('404') && (errorMsg.includes('tool') || errorMsg.includes('routing'));

                if (isToolSupportError && canUseNativeTools) { // Only fallback if we tried native tools
                    console.warn('[LLMService] Native tools not supported by this model/provider. Falling back...');

                    // Fallback logic
                    const fallbackConfig: LLMConfig = {
                        ...currentRunConfig,
                        // forceSimulated=true will make canUseNativeTools=false in the next run
                        // This allows useTools to remain populated (for simulation) while preventing native tool transmission
                        forceSimulated: true,
                        simulatedToolsEnabled: simulatedToolsEnabled
                    };

                    // If simulated tools explicitly disabled, we just retry without tools (standard chat)
                    if (simulatedToolsEnabled === false) {
                        console.log('[LLMService] Simulated tools disabled. Retrying as standard chat.');
                        fallbackConfig.tools = []; // Explicitly clear tools if simulation is disabled
                        fallbackConfig.forceSimulated = false; // No need to force sim if tools are gone
                    } else {
                        console.log('[LLMService] Falling back to simulated tools.');
                    }

                    // Recursively call streamChat with the fallback configuration
                    const fallbackStream = this.streamChat(messages, fallbackConfig);
                    for await (const chunk of fallbackStream) {
                        yield chunk;
                    }
                    return; // Exit current execution
                }

                console.error('LLM Service Error:', error);
                throw error;
            }
        }
    }

    async generateResponse(messages: Message[], extraConfig?: Partial<LLMConfig>): Promise<string> {
        let response = '';
        const stream = this.streamChat(messages, extraConfig);
        for await (const chunk of stream) {
            if (chunk.content) response += chunk.content;
        }
        return response;
    }

    async generateSummary(messages: Message[]): Promise<string> {
        const provider = this.activeProvider;
        const prompt: Message[] = [
            {
                id: 'sys_sum',
                conversationId: 'sys',
                role: 'system',
                content: 'You are a Title Generator. Create a 3-5 word title for this conversation. Output ONLY the title text. Do not use quotes or roleplay indicators.',
                timestamp: Date.now()
            },
            ...messages.slice(-6).map(m => ({ ...m, role: m.role === 'user' ? 'user' : 'assistant' } as Message)) // Norm roles
        ];

        let summary = '';
        try {
            const stream = provider.chatStream(prompt, { ...this.config, tools: [] });
            for await (const chunk of stream) {
                if (chunk.content) summary += chunk.content;
            }
        } catch (e) {
            console.error('generateSummary failed', e);
            return 'New Conversation';
        }

        return (summary || '').trim() || 'Conversation';
    }

    /**
     * Embeddings for RAG (API only)
     */

    /**
     * Call provider's embedding API (OpenAI-compatible /embeddings)
     */
    private async getEmbeddingFromApi(text: string): Promise<number[] | null> {
        const cfg = this.config as any;
        const base = ((cfg.ragBaseUrl || cfg.baseUrl) || '').trim().replace(/\/$/, '');
        const key = cfg.ragApiKey || cfg.apiKey || '';
        const model = cfg.embeddingModel || 'text-embedding-3-small';
        if (!base) {
            console.warn('[LLMService] Embedding API: no baseUrl');
            return null;
        }
        const url = base.includes('/embeddings') ? base : `${base}/embeddings`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(key ? { Authorization: `Bearer ${key}` } : {}),
                },
                body: JSON.stringify({ model, input: text }),
            });
            if (!res.ok) {
                const t = await res.text();
                console.warn('[LLMService] Embedding API error:', res.status, t.slice(0, 200));
                return null;
            }
            const data = await res.json();
            const embedding = data?.data?.[0]?.embedding ?? data?.embedding;
            if (Array.isArray(embedding) && embedding.length > 0) return embedding;
            return null;
        } catch (e: any) {
            console.warn('[LLMService] Embedding API failed:', e?.message);
            return null;
        }
    }

    /**
     * Generates embedding for RAG: API only
     */
    async getEmbedding(text: string): Promise<number[] | null> {
        const embedding = await this.getEmbeddingFromApi(text);
        if (embedding && embedding.length > 0) return embedding;
        return null;
    }
}

export const LLMService = new LLMServiceClass();
