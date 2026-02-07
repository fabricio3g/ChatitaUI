/**
 * Conversation types
 * Pure types - no side effects
 */

export interface Conversation {
    id: string;
    title: string;
    messageCount: number;
    lastMessageAt: number;
    createdAt: number;
    metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    isPinned?: boolean;
    tags?: string[];
}
