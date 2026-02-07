/**
 * System/Expo Speech Provider
 * Fallback TTS using device's native engine
 */

import * as Speech from 'expo-speech';
import { TTSProvider, TTSConfig, TTSProviderId } from './types';

export class SystemTTSProvider implements TTSProvider {
    id: TTSProviderId = 'system';
    name = 'System TTS';

    async synthesize(text: string, config: TTSConfig): Promise<{ audioUri: string; duration?: number }> {
        return new Promise((resolve, reject) => {
            Speech.speak(text, {
                voice: config.voiceId !== 'default' ? config.voiceId : undefined,
                rate: config.speed || 1.0,
                onDone: () => resolve({ audioUri: 'system-played' }),
                onError: (e) => reject(e),
            });
        });
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async getVoices(): Promise<{ id: string; name: string; category?: string }[]> {
        const voices = await Speech.getAvailableVoicesAsync();
        return voices.map((v: any) => ({
            id: v.identifier,
            name: v.name,
            category: v.language
        }));
    }
}
