/**
 * LLM Service Exports
 * 
 * New template-based API system for LLM providers.
 * 
 * NOTE: To use new features, import directly from specific files:
 * import { LLMServiceNew } from './LLMServiceNew';
 * import { useLLMStore } from '../../state/LLMStore';
 */

// Core types
export * from './types';

// Template system - safe to export
export {
  SamplerID,
} from './templates/APITemplates';

// Legacy providers (backward compatible)
export { OpenAIProvider } from './OpenAIProvider';
export { LlamaRNProvider } from './LlamaRNProvider';

// Legacy service
export { LLMService } from './LLMService';

// Model management - safe exports
export * from './llama/models';

// NOTE: New services must be imported directly to avoid circular deps:
// import { LLMServiceNew } from './src/services/llm/LLMServiceNew';
// import { TemplateBasedProvider } from './src/services/llm/TemplateBasedProvider';
// import { useLLMStore } from './src/state/LLMStore';
