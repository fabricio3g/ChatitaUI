/**
 * Config Service
 * Centralizes loading and saving of app configuration (LLM, TTS, etc.)
 * Ensures services are initialized on app launch
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LLMService } from './llm/LLMService';

export const ConfigService = {
    /**
     * Load all settings from storage and initialize services
     */
    loadSettings: async () => {
        try {
            console.log('[ConfigService] Loading settings...');
            const savedKey = await AsyncStorage.getItem('settings_apiKey');
            const savedProvider = await AsyncStorage.getItem('settings_provider');
            const savedModel = await AsyncStorage.getItem('settings_model');
            const savedBaseUrl = await AsyncStorage.getItem('settings_baseUrl');
            const savedSystemPrompt = await AsyncStorage.getItem('settings_systemPrompt');

            // Initialize LLM Service
            LLMService.setConfig({
                apiKey: savedKey || undefined,
                provider: (savedProvider as any) || 'openai',
                model: savedModel || 'gpt-3.5-turbo',
                baseUrl: savedBaseUrl || undefined,
                systemPrompt: savedSystemPrompt || undefined,
            });

            console.log('[ConfigService] Settings loaded and services initialized.');
            return true;
        } catch (error) {
            console.error('[ConfigService] Failed to load settings:', error);
            return false;
        }
    },

    /**
     * Helper to save specific setting
     */
    setSetting: async (key: string, value: string) => {
        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.error('[ConfigService] Failed to save setting:', key, error);
        }
    }
};
