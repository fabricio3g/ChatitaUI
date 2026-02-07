/**
 * Vision Service
 * Handles image processing and multimodal message formatting for vision-capable models
 */

import { Message, MessageContentPart } from '../../types/message';
import { Attachment } from '../../types/document';
import { LLMProviderId } from './types';
import { LLMService } from './LLMService';
import { getActiveLlamaModel, getDownloadedLlamaModels } from './llama/models';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VisionCapabilities {
    supportsImages: boolean;
    supportsAudio: boolean;
    maxImages: number;
    supportedFormats: string[];
}

class VisionServiceClass {
    private activeVisionModelId: string | null = null;

    /**
     * Initialize and load saved vision model preference
     */
    async initialize(): Promise<void> {
        try {
            const [savedLocalVisionModel, savedLegacyVisionModel] = await AsyncStorage.multiGet([
                'settings_localVisionModel',
                'settings_activeVisionModel',
            ]);
            const savedVisionModel = savedLocalVisionModel[1] || savedLegacyVisionModel[1];
            if (savedVisionModel) {
                this.activeVisionModelId = savedVisionModel;
                console.log('[VisionService] Loaded active vision model:', savedVisionModel);
            }
        } catch (e) {
            console.warn('[VisionService] Failed to load vision model preference:', e);
        }
    }

    /**
     * Check if we have an active vision model for local inference
     */
    async hasLocalVisionModel(): Promise<boolean> {
        if (!this.activeVisionModelId) {
            await this.initialize();
        }
        
        if (!this.activeVisionModelId) return false;
        
        // Verify the model is still downloaded
        const downloaded = await getDownloadedLlamaModels();
        return downloaded.some(m => m.id === this.activeVisionModelId);
    }

    /**
     * Check if the current provider and model support vision
     * Legacy method - kept for backward compatibility
     */
    async supportsVision(provider: LLMProviderId): Promise<boolean> {
        // Use LLMService config if available
        try {
            const supports = await LLMService.supportsVision();
            return supports;
        } catch {
            // Fallback to legacy check
        }

        // Cloud providers support vision
        if (provider === 'openai' || provider === 'openrouter') {
            return true;
        }

        // For local models, check if we have a vision model active
        if (provider === 'llama_rn' || provider === 'local') {
            // First check active text model for vision capability
            const activeModel = await getActiveLlamaModel();
            if (activeModel?.capabilities?.includes('vision')) {
                return true;
            }

            // Then check separately activated vision model
            const hasVisionModel = await this.hasLocalVisionModel();
            if (hasVisionModel) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if vision is enabled and supported using LLMService config
     * This is the preferred method going forward
     */
    async isVisionEnabled(): Promise<boolean> {
        const visionConfig = LLMService.getVisionConfig();
        if (visionConfig?.enabled === false) {
            return false;
        }
        return LLMService.supportsVision();
    }

    /**
     * Get the active vision model path if available
     */
    async getVisionModelPath(): Promise<string | null> {
        if (!this.activeVisionModelId) {
            await this.initialize();
        }
        
        if (!this.activeVisionModelId) return null;
        
        const downloaded = await getDownloadedLlamaModels();
        const visionModel = downloaded.find(m => m.id === this.activeVisionModelId);
        return visionModel?.modelPath || null;
    }

    /**
     * Get vision capabilities for current setup
     * Legacy method - kept for backward compatibility
     */
    async getCapabilities(provider: LLMProviderId): Promise<VisionCapabilities> {
        // Try to use LLMService config first
        try {
            const visionConfig = LLMService.getVisionConfig();
            if (visionConfig?.enabled === false) {
                return {
                    supportsImages: false,
                    supportsAudio: false,
                    maxImages: 0,
                    supportedFormats: [],
                };
            }

            const visionProvider = LLMService.getVisionProvider();
            provider = visionProvider.id as LLMProviderId;
        } catch {
            // Fall through to legacy logic
        }

        const supportsVision = await this.supportsVision(provider);

        if (!supportsVision) {
            return {
                supportsImages: false,
                supportsAudio: false,
                maxImages: 0,
                supportedFormats: [],
            };
        }

        // Cloud providers
        if (provider === 'openai' || provider === 'openrouter') {
            return {
                supportsImages: true,
                supportsAudio: provider === 'openai',
                maxImages: 10,
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            };
        }

        // Local vision model
        const hasVisionModel = await this.hasLocalVisionModel();
        if (hasVisionModel) {
            return {
                supportsImages: true,
                supportsAudio: false, // Most local vision models don't support audio
                maxImages: 5,
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
            };
        }

        // Check if active text model has vision
        const activeModel = await getActiveLlamaModel();
        if (activeModel?.capabilities?.includes('vision')) {
            return {
                supportsImages: true,
                supportsAudio: activeModel.capabilities?.includes('audio') || false,
                maxImages: 5,
                supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
            };
        }

        return {
            supportsImages: false,
            supportsAudio: false,
            maxImages: 0,
            supportedFormats: [],
        };
    }

    /**
     * Convert an attachment to base64 for multimodal messages
     */
    async attachmentToBase64(attachment: Attachment): Promise<string | null> {
        try {
            // For local files, we need to read them as base64
            if (attachment.uri.startsWith('file://') || attachment.uri.startsWith('content://')) {
                // Return the URI directly for llama.rn to handle
                // llama.rn can read local file paths
                return attachment.uri;
            }
            
            // For remote URLs, return as-is
            if (attachment.uri.startsWith('http://') || attachment.uri.startsWith('https://')) {
                return attachment.uri;
            }
            
            return attachment.uri;
        } catch (error) {
            console.error('[VisionService] Failed to convert attachment:', error);
            return null;
        }
    }

    /**
     * Create multimodal message content from text and attachments
     */
    async createMultimodalContent(
        text: string,
        attachments: Attachment[]
    ): Promise<MessageContentPart[]> {
        const content: MessageContentPart[] = [];

        // Add text first
        if (text.trim()) {
            content.push({ type: 'text', text: text.trim() });
        }

        // Add images
        for (const attachment of attachments) {
            if (attachment.type === 'image') {
                const imageUrl = await this.attachmentToBase64(attachment);
                if (imageUrl) {
                    content.push({
                        type: 'image_url',
                        image_url: { url: imageUrl }
                    });
                }
            }
        }

        return content;
    }

    /**
     * Format message for vision model
     * If provider supports vision and there are image attachments,
     * returns multimodal content. Otherwise returns plain text.
     */
    async formatMessage(
        text: string,
        attachments: Attachment[],
        provider: LLMProviderId
    ): Promise<string | MessageContentPart[]> {
        const hasImages = attachments.some(a => a.type === 'image');
        
        if (!hasImages) {
            return text;
        }

        const supportsVision = await this.supportsVision(provider);
        
        if (supportsVision) {
            // Format as multimodal
            return this.createMultimodalContent(text, attachments);
        } else {
            // Fall back to text description
            const imageDesc = attachments
                .filter(a => a.type === 'image')
                .map((_, i) => `[Image ${i + 1}]`)
                .join(' ');
            return imageDesc ? `${imageDesc}\n${text}` : text;
        }
    }

    /**
     * Check if message has multimodal content
     */
    isMultimodalContent(content: string | MessageContentPart[] | null): boolean {
        if (!content) return false;
        return Array.isArray(content);
    }

    /**
     * Extract text from multimodal content for display
     */
    extractText(content: string | MessageContentPart[] | null): string {
        if (!content) return '';
        if (typeof content === 'string') return content;
        
        // Extract text parts
        return content
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text)
            .join('\n');
    }

    /**
     * Count images in multimodal content
     */
    countImages(content: string | MessageContentPart[] | null): number {
        if (!content || typeof content === 'string') return 0;
        
        return content.filter(
            part => part.type === 'image_url' || part.type === 'image'
        ).length;
    }
}

export const VisionService = new VisionServiceClass();
