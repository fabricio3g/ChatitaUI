/**
 * Translate Tool
 * The LLM performs the actual translation - this tool just formats the output for the widget
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

const LANGUAGES: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
};

export class TranslateTool implements Tool {
    definition: ToolDefinition = {
        name: 'translate',
        description: 'Display a translation result. You (the AI) perform the translation and call this tool to show it nicely formatted.',
        renderType: 'translate',
        parameters: {
            type: 'object',
            properties: {
                original_text: {
                    type: 'string',
                    description: 'The original text that was translated'
                },
                translated_text: {
                    type: 'string',
                    description: 'The translated text (you provide the translation)'
                },
                source_language: {
                    type: 'string',
                    description: 'Source language code (e.g., "en")',
                    enum: Object.keys(LANGUAGES)
                },
                target_language: {
                    type: 'string',
                    description: 'Target language code (e.g., "es")',
                    enum: Object.keys(LANGUAGES)
                }
            },
            required: ['original_text', 'translated_text', 'source_language', 'target_language']
        }
    };

    async execute(params: {
        original_text: string;
        translated_text: string;
        source_language: string;
        target_language: string;
    }): Promise<ToolResponse> {
        return {
            type: 'translate',
            content: params.translated_text,
            data: {
                originalText: params.original_text,
                translatedText: params.translated_text,
                sourceLanguage: params.source_language,
                sourceLanguageName: LANGUAGES[params.source_language] || params.source_language,
                targetLanguage: params.target_language,
                targetLanguageName: LANGUAGES[params.target_language] || params.target_language
            }
        };
    }
}
