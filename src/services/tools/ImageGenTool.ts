import { Tool, ToolDefinition, ToolResponse } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';


export class ImageGenTool implements Tool {
    definition: ToolDefinition = {
        name: 'generate_image',
        description: 'Generate an image based on a text prompt using AI image APIs.',
        renderType: 'image_generated',
        parameters: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Detailed description of the image to generate'
                },
                provider: {
                    type: 'string',
                    enum: ['openai', 'openrouter', 'custom'],
                    description: 'Image API provider (default comes from Settings)'
                },
                size: {
                    type: 'string',
                    enum: ['1024x1024', '1024x1792', '1792x1024'],
                    description: 'Size of the image (default from Settings)'
                }
            },
            required: ['prompt']
        }
    };

    private async getImageSettings() {
        const entries = await AsyncStorage.multiGet([
            'settings_imageGenProvider',
            'settings_imageGenApiKey',
            'settings_imageGenBaseUrl',
            'settings_imageGenModel',
            'settings_imageGenSize',
        ]);

        const map: Record<string, string> = {};
        for (const [k, v] of entries) {
            if (v) map[k] = v;
        }

        const provider = (map.settings_imageGenProvider || 'openai') as 'openai' | 'openrouter' | 'custom';
        const baseUrl = (map.settings_imageGenBaseUrl || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
        const model = map.settings_imageGenModel || (provider === 'openrouter' ? 'openai/gpt-image-1' : 'gpt-image-1');
        const size = (map.settings_imageGenSize || '1024x1024') as '1024x1024' | '1024x1792' | '1792x1024';

        return {
            provider,
            apiKey: map.settings_imageGenApiKey || '',
            baseUrl,
            model,
            size,
        };
    }

    async execute(params: { prompt: string; provider?: string; size?: string }): Promise<ToolResponse> {
        try {
            const prompt = params.prompt;
            const settings = await this.getImageSettings();
            const provider = (params.provider as 'openai' | 'openrouter' | 'custom' | undefined) || settings.provider;
            const size = params.size || settings.size;

            console.log(`[ImageGenTool] Generating image with ${provider}: ${prompt}`);

            let imageUrl = '';
            let revisedPrompt = '';

            // Lazy load LLMService to reuse global key when dedicated image key is empty
            const { LLMService } = require('../llm/LLMService');
            const llmConfig = LLMService.getConfig();
            const apiKey = settings.apiKey || llmConfig.apiKey || '';
            if (!apiKey) {
                throw new Error('No image API key found. Set Image Generation API key in Settings or configure the main LLM API key.');
            }

            const providerDefaultBase = provider === 'openrouter'
                ? 'https://openrouter.ai/api/v1'
                : 'https://api.openai.com/v1';
            const resolvedBaseUrl = (provider === settings.provider ? settings.baseUrl : providerDefaultBase).replace(/\/$/, '');
            const endpoint = `${resolvedBaseUrl}/images/generations`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            };
            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://kokorotts.app';
                headers['X-Title'] = 'Kokoro TTS App';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: settings.model,
                    prompt,
                    n: 1,
                    size,
                    response_format: 'url'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to generate image');
            }

            const data = await response.json();
            imageUrl = data?.data?.[0]?.url || '';
            revisedPrompt = data?.data?.[0]?.revised_prompt || '';
            if (!imageUrl) {
                throw new Error('Image provider returned no URL');
            }

            return {
                type: 'image_generated',
                content: `Image generated successfully for: "${prompt}"`,
                data: {
                    url: imageUrl,
                    prompt: prompt,
                    revisedPrompt: revisedPrompt,
                    provider: provider,
                    size: size
                }
            };

        } catch (error: any) {
            console.error('[ImageGenTool] Error:', error);
            return {
                type: 'error',
                content: `Failed to generate image: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
