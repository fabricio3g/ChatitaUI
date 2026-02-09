/**
 * React Native LLM Chat UI
 * Simple components for rendering LLM chat interfaces
 */

// Components
export { MessageBubble } from './components/bubbles';
export { ChatInput } from './components/input';
export { TypingIndicator } from './components/indicators';
export { MessageContent } from './components/content';

// Types
export type {
  Message,
  MessageRole,
  MessageMetadata,
  Theme,
} from './types';

// Theme
export { defaultTheme, darkTheme } from './theme/defaultTheme';
export type { Theme as ThemeType } from './types';
