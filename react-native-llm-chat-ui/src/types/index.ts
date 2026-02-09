/**
 * Core message types
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  isStreaming?: boolean;
  thinking?: string;
  fadeIn?: boolean;
}

export type Theme = {
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    userBubble: string;
    assistantBubble: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
};
