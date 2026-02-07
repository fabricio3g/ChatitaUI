/**
 * LLM State Management with Zustand
 * 
 * Provides centralized state management for LLM configuration with persistence.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sampler/Parameter IDs that map to internal configuration
export enum SamplerID {
  TEMPERATURE = 'temperature',
  MAX_TOKENS = 'maxTokens',
  TOP_P = 'topP',
  TOP_K = 'topK',
  PRESENCE_PENALTY = 'presencePenalty',
  FREQUENCY_PENALTY = 'frequencyPenalty',
  REPETITION_PENALTY = 'repetitionPenalty',
  SEED = 'seed',
  STOP_SEQUENCES = 'stopSequences',
}

// Operation mode
export type ModelMode = 'api' | 'local' | 'mixed';

// Vision configuration
export interface VisionConfig {
  provider: string;
  model: string;
  enabled: boolean;
  useSeparate: boolean;
}

// Local model configuration
export interface LocalModelConfig {
  llmModelId: string | null;
  visionModelId: string | null;
  audioModelId?: string | null;
}

// Connection configuration for API providers
export interface ConnectionConfig {
  id: string;
  name: string;
  providerId: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  isActive: boolean;
}

// Sampler configuration
export interface SamplerConfig {
  [SamplerID.TEMPERATURE]: number;
  [SamplerID.MAX_TOKENS]: number;
  [SamplerID.TOP_P]: number;
  [SamplerID.TOP_K]?: number;
  [SamplerID.PRESENCE_PENALTY]?: number;
  [SamplerID.FREQUENCY_PENALTY]?: number;
  [SamplerID.REPETITION_PENALTY]?: number;
  [SamplerID.SEED]?: number;
}

// Complete LLM state
export interface LLMState {
  // Mode
  mode: ModelMode;
  setMode: (mode: ModelMode) => void;

  // Active provider
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;

  // API connections (for template-based providers)
  connections: ConnectionConfig[];
  addConnection: (config: Omit<ConnectionConfig, 'id'>) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (id: string) => void;
  getActiveConnection: () => ConnectionConfig | undefined;

  // Sampler configuration
  samplers: SamplerConfig;
  updateSampler: (key: SamplerID, value: number) => void;
  updateSamplers: (samplers: Partial<SamplerConfig>) => void;
  resetSamplers: () => void;

  // Vision configuration
  visionConfig: VisionConfig;
  updateVisionConfig: (config: Partial<VisionConfig>) => void;

  // Local model configuration
  localConfig: LocalModelConfig;
  updateLocalConfig: (config: Partial<LocalModelConfig>) => void;

  // System prompt
  systemPrompt?: string;
  setSystemPrompt: (prompt: string) => void;

  // User profile
  userName?: string;
  userPersona?: string;
  setUserProfile: (name?: string, persona?: string) => void;

  // Tool settings
  simulatedToolsEnabled: boolean;
  setSimulatedToolsEnabled: (enabled: boolean) => void;

  // RAG settings
  ragEmbeddingSource: 'local' | 'api';
  setRagEmbeddingSource: (source: 'local' | 'api') => void;

  // Reset all settings
  resetToDefaults: () => void;
}

const defaultSamplers: SamplerConfig = {
  [SamplerID.TEMPERATURE]: 0.7,
  [SamplerID.MAX_TOKENS]: 2048,
  [SamplerID.TOP_P]: 0.9,
  [SamplerID.TOP_K]: 40,
  [SamplerID.PRESENCE_PENALTY]: 0,
  [SamplerID.FREQUENCY_PENALTY]: 0,
};

const defaultVisionConfig: VisionConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  enabled: true,
  useSeparate: false,
};

const defaultLocalConfig: LocalModelConfig = {
  llmModelId: null,
  visionModelId: null,
  audioModelId: null,
};

// Simple Zustand store without persist for now
export const useLLMStore = create<LLMState>()(
  (set, get) => ({
    // Mode
    mode: 'api',
    setMode: (mode) => set({ mode }),

    // Active provider
    activeProviderId: 'openai',
    setActiveProviderId: (id) => set({ activeProviderId: id }),

    // Connections
    connections: [],
    addConnection: (config) => {
      const id = `conn_${Date.now()}`;
      set((state) => ({
        connections: [
          ...state.connections.map(c => ({ ...c, isActive: false })),
          { ...config, id, isActive: true },
        ],
      }));
    },
    updateConnection: (id, updates) => {
      set((state) => ({
        connections: state.connections.map(c =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
    },
    removeConnection: (id) => {
      set((state) => ({
        connections: state.connections.filter(c => c.id !== id),
      }));
    },
    setActiveConnection: (id) => {
      set((state) => ({
        connections: state.connections.map(c => ({
          ...c,
          isActive: c.id === id,
        })),
        activeProviderId: state.connections.find(c => c.id === id)?.providerId || state.activeProviderId,
      }));
    },
    getActiveConnection: () => {
      return get().connections.find(c => c.isActive);
    },

    // Samplers
    samplers: defaultSamplers,
    updateSampler: (key, value) => {
      set((state) => ({
        samplers: { ...state.samplers, [key]: value },
      }));
    },
    updateSamplers: (updates) => {
      set((state) => ({
        samplers: { ...state.samplers, ...updates },
      }));
    },
    resetSamplers: () => set({ samplers: defaultSamplers }),

    // Vision config
    visionConfig: defaultVisionConfig,
    updateVisionConfig: (config) => {
      set((state) => ({
        visionConfig: { ...state.visionConfig, ...config },
      }));
    },

    // Local config
    localConfig: defaultLocalConfig,
    updateLocalConfig: (config) => {
      set((state) => ({
        localConfig: { ...state.localConfig, ...config },
      }));
    },

    // System prompt
    systemPrompt: undefined,
    setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

    // User profile
    userName: undefined,
    userPersona: undefined,
    setUserProfile: (name, persona) => set({ userName: name, userPersona: persona }),

    // Tool settings
    simulatedToolsEnabled: true,
    setSimulatedToolsEnabled: (enabled) => set({ simulatedToolsEnabled: enabled }),

    // RAG settings
    ragEmbeddingSource: 'local',
    setRagEmbeddingSource: (source) => set({ ragEmbeddingSource: source }),

    // Reset
    resetToDefaults: () => set({
      mode: 'api',
      activeProviderId: 'openai',
      connections: [],
      samplers: defaultSamplers,
      visionConfig: defaultVisionConfig,
      localConfig: defaultLocalConfig,
      systemPrompt: undefined,
      simulatedToolsEnabled: true,
      ragEmbeddingSource: 'local',
    }),
  })
);

// Selectors for common state slices
export const useActiveProvider = () => useLLMStore(state => state.activeProviderId);
export const useSamplers = () => useLLMStore(state => state.samplers);
export const useVisionConfig = () => useLLMStore(state => state.visionConfig);
export const useMode = () => useLLMStore(state => state.mode);
