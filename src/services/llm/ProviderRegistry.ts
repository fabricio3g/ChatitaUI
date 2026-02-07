/**
 * Provider Registry
 *
 * Central registry for all LLM providers. Supports both template-based
 * and custom providers. Allows dynamic registration of new providers.
 *
 * LlamaRNProvider is lazy-loaded to avoid "install of null" crash in Expo Go.
 */

import { isExpoGo } from '../../utils/isExpoGo';
import { LLMProvider, LLMProviderId } from './types';
import { TemplateBasedProvider } from './TemplateBasedProvider';
import { OpenAIProvider } from './OpenAIProvider';
import {
  APITemplate,
  defaultAPITemplates,
  getTemplate,
  registerTemplate as registerAPITemplate,
} from './templates/APITemplates';

// Provider factory function type
export type ProviderFactory = () => LLMProvider;

// Registry entry
interface RegistryEntry {
  provider: LLMProvider;
  factory: ProviderFactory;
  isTemplate: boolean;
}

class ProviderRegistryClass {
  private providers = new Map<string, RegistryEntry>();
  private initialized = false;

  constructor() {
    this.initializeDefaults();
  }

  /**
   * Initialize default providers
   */
  private initializeDefaults(): void {
    if (this.initialized) return;

    // Register template-based providers from default templates
    defaultAPITemplates.forEach(template => {
      this.registerTemplateProvider(template);
    });

    // Register legacy/custom providers
    this.register('openai_legacy', () => new OpenAIProvider());
    // LlamaRN uses llama.rn native module - skip only in Expo Go (not in release/standalone)
    if (!isExpoGo()) {
      try {
        const { LlamaRNProvider } = require('./LlamaRNProvider');
        this.register('llama_rn', () => new LlamaRNProvider({} as any));
      } catch (e) {
        console.warn('[ProviderRegistry] LlamaRNProvider not available');
      }
    }

    this.initialized = true;
  }

  /**
   * Register a provider with a factory function
   */
  register(id: string, factory: ProviderFactory, overwrite = false): void {
    if (this.providers.has(id) && !overwrite) {
      console.warn(`[ProviderRegistry] Provider ${id} already registered, skipping`);
      return;
    }

    try {
      const provider = factory();
      this.providers.set(id, {
        provider,
        factory,
        isTemplate: false,
      });
      console.log(`[ProviderRegistry] Registered provider: ${id}`);
    } catch (error) {
      console.error(`[ProviderRegistry] Failed to register provider ${id}:`, error);
    }
  }

  /**
   * Register a template-based provider
   */
  registerTemplateProvider(template: APITemplate): void {
    registerAPITemplate(template);
    
    this.providers.set(template.id, {
      provider: new TemplateBasedProvider(template),
      factory: () => new TemplateBasedProvider(template),
      isTemplate: true,
    });
    
    console.log(`[ProviderRegistry] Registered template provider: ${template.id}`);
  }

  /**
   * Get a provider by ID
   */
  get(id: string): LLMProvider | undefined {
    const entry = this.providers.get(id);
    
    if (!entry) {
      // Try to create from template if it exists
      const template = getTemplate(id);
      if (template) {
        const provider = new TemplateBasedProvider(template);
        this.providers.set(id, {
          provider,
          factory: () => new TemplateBasedProvider(template),
          isTemplate: true,
        });
        return provider;
      }
      return undefined;
    }

    return entry.provider;
  }

  /**
   * Get or create a fresh provider instance
   * Useful when you need a new instance with fresh state
   */
  create(id: string): LLMProvider | undefined {
    const entry = this.providers.get(id);
    if (!entry) {
      // Try template
      const template = getTemplate(id);
      if (template) {
        return new TemplateBasedProvider(template);
      }
      return undefined;
    }

    return entry.factory();
  }

  /**
   * Check if a provider exists
   */
  has(id: string): boolean {
    return this.providers.has(id) || !!getTemplate(id);
  }

  /**
   * Remove a provider
   */
  unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  /**
   * Get all registered provider IDs
   */
  getAllIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all providers
   */
  getAll(): LLMProvider[] {
    return Array.from(this.providers.values()).map(e => e.provider);
  }

  /**
   * Get all template-based providers
   */
  getTemplateProviders(): LLMProvider[] {
    return Array.from(this.providers.values())
      .filter(e => e.isTemplate)
      .map(e => e.provider);
  }

  /**
   * Get all custom (non-template) providers
   */
  getCustomProviders(): LLMProvider[] {
    return Array.from(this.providers.values())
      .filter(e => !e.isTemplate)
      .map(e => e.provider);
  }

  /**
   * Reload a provider (useful after configuration changes)
   */
  reload(id: string): LLMProvider | undefined {
    const entry = this.providers.get(id);
    if (!entry) return undefined;

    try {
      const newProvider = entry.factory();
      this.providers.set(id, {
        ...entry,
        provider: newProvider,
      });
      return newProvider;
    } catch (error) {
      console.error(`[ProviderRegistry] Failed to reload provider ${id}:`, error);
      return undefined;
    }
  }

  /**
   * Clear all providers (use with caution)
   */
  clear(): void {
    this.providers.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const ProviderRegistry = new ProviderRegistryClass();

// Export individual functions for convenience
export const getProvider = (id: string) => ProviderRegistry.get(id);
export const createProvider = (id: string) => ProviderRegistry.create(id);
export const registerProvider = (id: string, factory: ProviderFactory) => 
  ProviderRegistry.register(id, factory);
export const registerTemplate = (template: APITemplate) => 
  ProviderRegistry.registerTemplateProvider(template);
