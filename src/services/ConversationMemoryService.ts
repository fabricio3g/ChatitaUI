
import { Message } from '../types/message';
import { LLMService } from './llm/LLMService';

interface ConversationMemory {
    summary: string;
    lastSummarizedIndex: number; // Index of the last message included in summary
}

// In-memory cache for speed (persist to DB if needed later)
const memoryCache: Record<string, ConversationMemory> = {};

const RECENT_MESSAGE_COUNT = 10; // Keep last 10 messages verbatim
const SUMMARY_BATCH_SIZE = 10;   // Summarize 10 messages at a time

export const ConversationMemoryService = {
    /**
     * Get context with summary for LLM
     */
    async getContext(conversationId: string, allMessages: Message[]): Promise<Message[]> {
        if (allMessages.length <= RECENT_MESSAGE_COUNT) {
            return allMessages;
        }

        let memory = memoryCache[conversationId] || { summary: '', lastSummarizedIndex: -1 };

        // Check if we need to update summary
        // We summarize messages that are older than RECENT_MESSAGE_COUNT
        // and haven't been summarized yet.
        const summaryEndIndex = allMessages.length - RECENT_MESSAGE_COUNT;

        if (summaryEndIndex > memory.lastSummarizedIndex + SUMMARY_BATCH_SIZE) {
            // Get messages to summarize (from last summarized index to current summary cutoff)
            const messagesToSummarize = allMessages.slice(
                memory.lastSummarizedIndex + 1,
                summaryEndIndex
            );

            if (messagesToSummarize.length > 0) {
                try {
                    const newSummary = await this.generateSummary(memory.summary, messagesToSummarize);
                    memory = {
                        summary: newSummary,
                        lastSummarizedIndex: summaryEndIndex - 1
                    };
                    memoryCache[conversationId] = memory;
                    console.log(`[Memory] Updated summary for ${conversationId}. Length: ${newSummary.length} chars.`);
                } catch (e) {
                    console.warn('[Memory] Summarization failed:', e);
                }
            }
        }

        // Construct context: System prompt (should be added by caller) + Summary Msg + Recent Msgs
        const context: Message[] = [];

        if (memory.summary) {
            context.push({
                id: 'memory_summary',
                role: 'system',
                content: `=== CONVERSATION SUMMARY ===\n${memory.summary}\n===========================`,
                timestamp: Date.now(),
                conversationId
            } as Message);
        }

        // Add recent messages verbatim
        const recentMessages = allMessages.slice(Math.max(0, memory.lastSummarizedIndex + 1));
        context.push(...recentMessages);

        return context;
    },

    /**
     * Generate summary using LLM
     */
    async generateSummary(currentSummary: string, newMessages: Message[]): Promise<string> {
        const prompt = `
You are a summarization assistant. Update the conversation summary with new interactions.

CURRENT SUMMARY:
${currentSummary || "None"}

NEW MESSAGES:
${newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

TASK:
Write a concise, updated summary of the entire conversation details. 
- Keep important facts, names, decisions, and plot points.
- Discard trivial chit-chat.
- Write in 3rd person.
- Maximum 150 words.
`;

        try {
            // Use a cheaper/faster model call if possible, or just standard completion
            // For now, we reuse the main LLM service but with non-streaming
            // We need a simple completion method in LLMService which might not exist directly exposed as non-streaming promise
            // So we'll use a hack or assume LLMService has a method. 
            // Checking LLMService... it seems mainly streaming. 
            // We'll trust LLMService.streamChat works if we collect it, or add a simple completion method.

            // NOTE: Ideally add 'complete()' to LLMService. For now collecting stream:
            const stream = LLMService.streamChat([{ role: 'user', content: prompt } as Message]);
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.content || '';
            }
            return fullText.trim();

        } catch (error) {
            console.error('Summarization error:', error);
            return currentSummary; // Fallback
        }
    },

    /**
     * Clear memory for a conversation
     */
    clearMemory(conversationId: string) {
        delete memoryCache[conversationId];
    }
};
