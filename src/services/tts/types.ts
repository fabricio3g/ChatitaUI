/**
 * TTS Service Types
 * Definitions for Text-to-Speech providers and configuration
 */

export type TTSProviderId = 'system' | 'custom' | 'kokoro' | 'executorch';

export interface TTSConfig {
    provider: TTSProviderId;
    apiKey?: string;
    baseUrl?: string; // For API endpoints
    voiceId: string;
    speed?: number; // 1.0 is default
    model?: string; // e.g. 'tts-1'
}

export interface TTSProvider {
    id: TTSProviderId;
    name: string;

    // Core synthesis method - returns audio source (URI or base64) or plays directly
    synthesize(text: string, config: TTSConfig): Promise<{ audioUri: string; duration?: number }>;

    // Check if ready/available
    isAvailable(): Promise<boolean>;

    // Get list of voices
    getVoices(): Promise<{ id: string; name: string; category?: string }[]>;
}
