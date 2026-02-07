import { TTSProvider, TTSConfig, TTSProviderId } from './types';
import * as FileSystem from 'expo-file-system/legacy';

export class CustomTTSProvider implements TTSProvider {
    id = 'custom' as TTSProviderId;
    name = 'Custom API';

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async getVoices(): Promise<{ id: string; name: string; category?: string }[]> {
        return [
            { id: 'default', name: 'Default Voice', category: 'custom' }
        ];
    }

    async synthesize(text: string, config: TTSConfig): Promise<{ audioUri: string; duration?: number }> {
        if (!config.baseUrl) {
            throw new Error('Custom TTS Base URL not configured');
        }

        try {
            // OpenAI-compatible format: POST /v1/audio/speech
            // Expected body: { model, input, voice, speed }
            const response = await fetch(config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {})
                },
                body: JSON.stringify({
                    model: config.model || 'tts-1',
                    input: text,
                    voice: config.voiceId || 'default',
                    speed: config.speed || 1.0
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Custom TTS API Failed (${response.status}): ${errText}`);
            }

            // Get blob/buffer
            const blob = await response.blob();

            // Convert to base64 for Expo FileSystem
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data url prefix if present
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(blob);
            const base64Data = await base64Promise;

            // Save to file
            const filename = `custom_tts_${Date.now()}.mp3`;
            const uri = `${FileSystem.cacheDirectory}${filename}`;

            await FileSystem.writeAsStringAsync(uri, base64Data, {
                encoding: 'base64'
            });

            return { audioUri: uri };

        } catch (error) {
            console.error('Custom TTS Synthesis Error:', error);
            throw error;
        }
    }
}
