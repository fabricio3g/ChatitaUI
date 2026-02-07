/**
 * Unified TTS Service
 * Manages TTS providers and playback
 *
 *
 */

import { TTSProvider, TTSConfig, TTSProviderId } from './types';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { SystemTTSProvider } from './SystemTTSProvider';
import { CustomTTSProvider } from './CustomTTSProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

class TTSServiceClass {
    private providers: Map<string, TTSProvider> = new Map();
    private activeProviderId: TTSProviderId = 'system';
    private config: TTSConfig = {
        provider: 'system',
        voiceId: 'default',
        speed: 1.0,
    };

    // Audio Player State
    private sound: Audio.Sound | null = null;

    constructor() {
        this.registerProvider(new SystemTTSProvider());
        this.registerProvider(new CustomTTSProvider());
    }

    registerProvider(provider: TTSProvider) {
        this.providers.set(provider.id, provider);
    }

    /**
     * Initialize TTS service - loads saved settings from AsyncStorage
     */
    async initialize(): Promise<void> {
        try {
            const [savedProvider, savedVoice] = await AsyncStorage.multiGet([
                'settings_ttsProvider',
                'settings_ttsVoice'
            ]);

            if (savedProvider[1]) {
                const provider = savedProvider[1] as TTSProviderId;
                // Verify provider is registered before switching
                if (this.providers.has(provider)) {
                    this.config.provider = provider;
                    this.activeProviderId = provider;
                } else {
                    console.warn('[TTSService] Saved provider not available:', provider);
                }
            }
            if (savedVoice[1]) {
                this.config.voiceId = savedVoice[1];
            }

            console.log('[TTSService] Initialized with provider:', this.config.provider, 'voice:', this.config.voiceId);
        } catch (e) {
            console.warn('[TTSService] Failed to initialize:', e);
        }
    }

    setConfig(config: Partial<TTSConfig>) {
        this.config = { ...this.config, ...config };
        if (config.provider) {
            this.activeProviderId = config.provider;
        }
    }

    get activeProvider(): TTSProvider {
        const provider = this.providers.get(this.activeProviderId);
        if (!provider) {
            // Fallback or throw
            throw new Error(`TTS Provider ${this.activeProviderId} not initialized`);
        }
        return provider;
    }

    /**
     * Synthesize and Play Audio
     */
    async speak(text: string): Promise<void> {
        try {
            // Stop any current playback
            await this.stop();

            const provider = this.activeProvider;
            const { audioUri } = await provider.synthesize(text, this.config);

            // Special handling for System TTS which plays directly
            if (audioUri === 'system-played') {
                return;
            }

            // Play the audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: audioUri },
                { shouldPlay: true }
            );

            this.sound = sound;

            // Cleanup when done
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    this.sound = null;
                }
            });

        } catch (error) {
            console.error('TTS Speak Failed:', error);
            if (this.activeProviderId !== 'system') {
                try {
                    console.log('[TTSService] Falling back to system TTS');
                    const fallback = this.providers.get('system');
                    if (fallback) {
                        await fallback.synthesize(text, { ...this.config, provider: 'system' });
                        return;
                    }
                } catch (fallbackError) {
                    console.error('[TTSService] System fallback failed:', fallbackError);
                }
            }
            throw error;
        }
    }

    async getVoices(): Promise<{ id: string; name: string; category?: string }[]> {
        return this.activeProvider.getVoices();
    }

    async stop(): Promise<void> {
        // Stop System TTS if valid
        try {
            await Speech.stop();
        } catch (e) {
            // Ignore if speech not available/running
        }

        if (this.sound) {
            try {
                await this.sound.stopAsync();
                await this.sound.unloadAsync();
            } catch (e) {
                // Ignore unload errors
            }
            this.sound = null;
        }
    }
}

export const TTSService = new TTSServiceClass();
