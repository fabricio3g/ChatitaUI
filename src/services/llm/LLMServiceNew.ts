/**
 * Refactored LLM Service
 * 
 * Uses the new template-based provider system and Zustand state management.
 * This is designed to replace the old LLMService.ts
 */

import { LLMProvider, LLMConfig, StreamChunk, ModelMode, VisionConfig } from './types';
import { Message } from '../../types/message';
import { ToolRegistry } from '../tools/ToolRegistry';
import ToolSimulator from './ToolSimulator';
import { ProviderRegistry } from './ProviderRegistry';
import { TemplateBasedProvider, TemplateProviderConfig } from './TemplateBasedProvider';
import { useLLMStore, ConnectionConfig } from '../../state/LLMStore';
import { getAllTemplates, APITemplate } from './templates/APITemplates';

// Extended config for the new service
export interface ExtendedLLMConfig extends LLMConfig {
  // Template-specific configuration
  templateId?: string;
  customEndpoint?: string;
  // Connection ID for template-based providers
  connectionId?: string;
}

/**
 * The new LLM Service - singleton
 */
class LLMServiceNewClass {
  private toolSimulator = ToolSimulator;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Provider registry is automatically initialized
    console.log('[LLMServiceNew] Initialized with providers:', 
      ProviderRegistry.getAllIds().join(', '));
  }

  /**
   * Get the active provider based on current store state
   */
  getActiveProvider(): LLMProvider {
    const store = useLLMStore.getState();
    const { activeProviderId, mode, localConfig } = store;

    // Handle local mode
    if (mode === 'local') {
      const provider = ProviderRegistry.get('llama_rn');
      if (!provider) {
        throw new Error('Local provider (llama_rn) not available. Make sure llama.rn is installed.');
      }
      return provider;
    }

    // Get active connection for template-based providers
    const activeConnection = store.getActiveConnection();
    if (activeConnection) {
      // Create a template provider with connection settings
      const template = getAllTemplates().find(t => t.id === activeConnection.providerId);
      if (template) {
        return new TemplateBasedProvider(template);
      }
    }

    // Fall back to provider ID lookup
    const provider = ProviderRegistry.get(activeProviderId);
    if (!provider) {
      throw new Error(`Provider ${activeProviderId} not found`);
    }

    return provider;
  }

  /**
   * Check connection to the active provider
   */
  async checkConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const store = useLLMStore.getState();
      const provider = this.getActiveProvider();
      
      const config: TemplateProviderConfig = {
        provider: store.activeProviderId,
        model: '', // Will be filled from connection
        templateId: store.activeProviderId,
        apiKey: store.getActiveConnection()?.apiKey,
        baseUrl: store.getActiveConnection()?.endpoint,
      };

      const success = await provider.checkConnection?.(config);
      
      if (success) {
        return { success: true };
      }
      
      return { success: false, error: 'Connection check returned false' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  /**
   * Fetch available models for the active provider
   */
  async fetchModels(): Promise<string[]> {
    try {
      const store = useLLMStore.getState();
      const provider = this.getActiveProvider();
      
      const config: TemplateProviderConfig = {
        provider: store.activeProviderId,
        model: '',
        templateId: store.activeProviderId,
        apiKey: store.getActiveConnection()?.apiKey,
        baseUrl: store.getActiveConnection()?.endpoint,
      };

      if (provider.getAvailableModels) {
        return await provider.getAvailableModels(config);
      }
      
      return [];
    } catch (error: any) {
      console.error('[LLMServiceNew] Failed to fetch models:', error);
      return [];
    }
  }

  /**
   * Main streaming chat method
   */
  async *streamChat(
    messages: Message[],
    extraConfig?: Partial<ExtendedLLMConfig>
  ): AsyncGenerator<StreamChunk> {
    const store = useLLMStore.getState();
    const provider = this.getActiveProvider();
    
    // Build configuration
    const activeConnection = store.getActiveConnection();
    const config: TemplateProviderConfig = {
      provider: store.activeProviderId,
      model: activeConnection?.model || extraConfig?.model || 'gpt-3.5-turbo',
      templateId: store.activeProviderId,
      apiKey: activeConnection?.apiKey || extraConfig?.apiKey,
      baseUrl: activeConnection?.endpoint || extraConfig?.baseUrl,
      customEndpoint: activeConnection?.endpoint || extraConfig?.baseUrl,
      temperature: store.samplers.temperature,
      maxTokens: store.samplers.maxTokens,
      systemPrompt: store.systemPrompt,
      simulatedToolsEnabled: store.simulatedToolsEnabled,
      tools: [], // Will be populated below
      ...extraConfig,
    };

    // Prepare messages with user profile
    let currentMessages = this.prepareMessages(messages, store);

    // Handle tools
    const { useTools, useSimulatedTools, toolDefinitions } = this.prepareTools(
      provider,
      config,
      store.simulatedToolsEnabled
    );

    if (useTools.length > 0) {
      config.tools = toolDefinitions;
    }

    // Inject tool instructions for simulated mode
    if (useSimulatedTools) {
      currentMessages = this.injectToolInstructions(currentMessages, toolDefinitions);
    }

    // Execute chat with tool loop
    let turnCount = 0;
    const MAX_TURNS = 5;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      
      yield { content: '', isDone: false, toolStart: { name: '_thinking', ttsMessage: 'Processing...' } };

      let assistantContent = '';
      let reasoningContent = '';
      let toolCalls: any[] = [];
      let tokenUsage: any;

      try {
        const generator = provider.chatStream(currentMessages, config);

        for await (const chunk of generator) {
          // Accumulate content
          if (chunk.content) {
            assistantContent += chunk.content;
          }
          if (chunk.reasoning) {
            reasoningContent += chunk.reasoning;
          }
          if (chunk.toolCalls) {
            toolCalls = chunk.toolCalls;
          }
          if (chunk.tokenUsage) {
            tokenUsage = chunk.tokenUsage;
          }

          // Yield to caller
          yield chunk;
        }

        yield { content: '', isDone: false, toolEnd: { name: '_thinking' } };

        if (tokenUsage) {
          yield { content: '', isDone: false, tokenUsage };
        }

        // Try simulated tool parsing if no native tool calls
        if (toolCalls.length === 0 && useTools.length > 0 && assistantContent) {
          const parsed = this.toolSimulator.parseToolCalls(assistantContent);
          if (parsed.toolCalls.length > 0) {
            toolCalls = parsed.toolCalls;
          }
        }

        // No tool calls - we're done
        if (toolCalls.length === 0) {
          yield { content: '', isDone: true };
          return;
        }

        // Execute tools
        currentMessages = await this.executeTools(
          currentMessages,
          assistantContent,
          toolCalls,
          extraConfig?.disableAutoExecution
        );

        // If auto-execution is disabled, return after first turn
        if (extraConfig?.disableAutoExecution) {
          yield { content: '', isDone: true, toolCalls };
          return;
        }

      } catch (error: any) {
        // Handle tool support errors with fallback
        if (this.isToolSupportError(error) && config.tools && config.tools.length > 0) {
          console.warn('[LLMServiceNew] Native tools not supported, falling back to simulated');
          
          // Retry with simulated tools
          const fallbackConfig = { ...config, tools: undefined };
          const fallbackGenerator = this.streamChat(messages, {
            ...extraConfig,
            forceSimulated: true,
          });
          
          for await (const chunk of fallbackGenerator) {
            yield chunk;
          }
          return;
        }

        throw error;
      }
    }

    yield { content: '', isDone: true };
  }

  /**
   * Generate a non-streaming response
   */
  async generateResponse(messages: Message[], extraConfig?: Partial<ExtendedLLMConfig>): Promise<string> {
    let response = '';
    const stream = this.streamChat(messages, { ...extraConfig, stream: false });
    for await (const chunk of stream) {
      if (chunk.content) response += chunk.content;
    }
    return response;
  }

  /**
   * Generate conversation summary for title
   */
  async generateSummary(messages: Message[]): Promise<string> {
    const provider = this.getActiveProvider();
    const store = useLLMStore.getState();
    const activeConnection = store.getActiveConnection();
    
    const summaryMessages: Message[] = [
      {
        id: 'sys_sum',
        conversationId: 'sys',
        role: 'system',
        content: 'You are a Title Generator. Create a 3-5 word title for this conversation. Output ONLY the title text.',
        timestamp: Date.now(),
      },
      ...messages.slice(-6).map(m => ({ ...m, role: m.role === 'user' ? 'user' : 'assistant' } as Message)),
    ];

    const config: TemplateProviderConfig = {
      provider: store.activeProviderId,
      model: activeConnection?.model || 'gpt-3.5-turbo',
      templateId: store.activeProviderId,
      apiKey: activeConnection?.apiKey,
      baseUrl: activeConnection?.endpoint,
      maxTokens: 20,
    };

    try {
      let summary = '';
      const generator = provider.chatStream(summaryMessages, config);
      for await (const chunk of generator) {
        if (chunk.content) summary += chunk.content;
      }
      return (summary || 'New Conversation').trim();
    } catch (e) {
      console.error('[LLMServiceNew] Summary generation failed:', e);
      return 'New Conversation';
    }
  }

  // ==================== Private Helper Methods ====================

  private prepareMessages(messages: Message[], store: ReturnType<typeof useLLMStore.getState>): Message[] {
    let currentMessages = [...messages];

    // Inject user profile
    if (store.userName || store.userPersona) {
      let profileContext = '';
      if (store.userName) profileContext += `\nUser's Name: ${store.userName}`;
      if (store.userPersona) profileContext += `\nUser Context/Instructions: ${store.userPersona}`;

      const sysIdx = currentMessages.findIndex(m => m.role === 'system');
      if (sysIdx >= 0) {
        const sysContent = currentMessages[sysIdx].content;
        const sysContentStr = typeof sysContent === 'string' ? sysContent : '';
        if (!sysContentStr.includes('User Context/Instructions:')) {
          currentMessages[sysIdx] = {
            ...currentMessages[sysIdx],
            content: sysContentStr + profileContext,
          } as Message;
        }
      } else {
        currentMessages.unshift({
          id: 'sys_' + Date.now(),
          conversationId: 'sys',
          role: 'system',
          content: 'You are a helpful AI assistant.' + profileContext,
          timestamp: Date.now(),
        });
      }
    }

    return currentMessages;
  }

  private prepareTools(
    provider: LLMProvider,
    config: LLMConfig,
    simulatedToolsEnabled: boolean
  ) {
    const availableTools = ToolRegistry.getAllTools();
    const toolDefinitions = availableTools.map((t: any) => t.definition);
    
    const disableTools = config.tools && config.tools.length === 0;
    const providerSupportsNative = !!provider.supportsNativeTools;
    const forceSimulated = config.provider === 'llama_rn' || config.forceSimulated;
    const canUseNativeTools = providerSupportsNative && !disableTools && !forceSimulated;
    const useTools = disableTools ? [] : toolDefinitions;
    const useSimulatedTools = !canUseNativeTools && simulatedToolsEnabled && useTools.length > 0;

    return { useTools, useSimulatedTools, toolDefinitions };
  }

  private injectToolInstructions(messages: Message[], tools: any[]): Message[] {
    const toolInstructions = this.toolSimulator.getCompactToolInstructions(tools);
    const lastUserIdx = messages.map(m => m.role).lastIndexOf('user');
    
    if (lastUserIdx >= 0) {
      const originalContent = messages[lastUserIdx].content || '';
      if (typeof originalContent === 'string' && !originalContent.includes('[TOOLS]')) {
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: originalContent + '\n\n' + toolInstructions,
        };
      }
    }
    
    return messages;
  }

  private async *executeTools(
    messages: Message[],
    assistantContent: string,
    toolCalls: any[],
    disableAutoExecution?: boolean
  ): Promise<Message[]> {
    // Add assistant message
    messages.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    } as any);

    // Yield tool start events
    for (const tc of toolCalls) {
      yield {
        content: '',
        isDone: false,
        toolStart: {
          name: tc.function.name,
          ttsMessage: ToolRegistry.getTTSMessage(tc.function.name),
        },
      };
    }

    // Execute tools in parallel
    const executionPromises = toolCalls.map(async (tc) => {
      try {
        const args = typeof tc.function.arguments === 'string' 
          ? JSON.parse(tc.function.arguments) 
          : tc.function.arguments;
        
        const output = await ToolRegistry.executeTool(tc.function.name, args);
        return { tc, output, success: true };
      } catch (e: any) {
        return { tc, output: { error: e.message }, success: false };
      }
    });

    const results = await Promise.all(executionPromises);

    // Yield tool end events and add to messages
    for (const res of results) {
      yield { content: '', isDone: false, toolEnd: { name: res.tc.function.name } };
      
      messages.push({
        role: 'tool',
        content: JSON.stringify(res.output),
        tool_call_id: res.tc.id,
      } as any);
    }

    return messages;
  }

  private isToolSupportError(error: any): boolean {
    const errorMsg = error.message || '';
    return errorMsg.includes('404') && (errorMsg.includes('tool') || errorMsg.includes('routing'));
  }
}

// Export singleton
export const LLMServiceNew = new LLMServiceNewClass();
