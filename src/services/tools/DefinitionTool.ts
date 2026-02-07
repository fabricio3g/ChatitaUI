/**
 * Definition Tool
 * Gets dictionary definitions using Free Dictionary API
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

interface DictionaryMeaning {
    partOfSpeech: string;
    definitions: {
        definition: string;
        example?: string;
        synonyms?: string[];
    }[];
}

interface DictionaryResponse {
    word: string;
    phonetic?: string;
    phonetics?: { text?: string; audio?: string }[];
    meanings: DictionaryMeaning[];
}

export class DefinitionTool implements Tool {
    definition: ToolDefinition = {
        name: 'define_word',
        description: 'Get the dictionary definition of a word, including pronunciation, meanings, and examples.',
        renderType: 'definition',
        parameters: {
            type: 'object',
            properties: {
                word: {
                    type: 'string',
                    description: 'The word to define'
                }
            },
            required: ['word']
        }
    };

    async execute(params: { word: string }): Promise<ToolResponse> {
        try {
            const word = params.word.trim().toLowerCase();
            const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    return {
                        type: 'error',
                        content: `No definition found for "${word}". Please check the spelling.`,
                        data: { error: 'Word not found', word }
                    };
                }
                throw new Error('Dictionary service unavailable');
            }

            const data: DictionaryResponse[] = await response.json();
            const entry = data[0];

            // Extract phonetic
            const phonetic = entry.phonetic ||
                entry.phonetics?.find(p => p.text)?.text || '';

            // Extract audio URL
            const audioUrl = entry.phonetics?.find(p => p.audio && p.audio.length > 0)?.audio || null;

            // Format meanings
            const meanings = entry.meanings.map(m => ({
                partOfSpeech: m.partOfSpeech,
                definitions: m.definitions.slice(0, 3).map(d => ({
                    definition: d.definition,
                    example: d.example,
                    synonyms: d.synonyms?.slice(0, 5)
                }))
            }));

            // Create content summary
            const mainDef = meanings[0]?.definitions[0]?.definition || 'No definition available';

            return {
                type: 'definition',
                content: `${word} (${meanings[0]?.partOfSpeech || 'unknown'}): ${mainDef}`,
                data: {
                    word: entry.word,
                    phonetic,
                    audioUrl,
                    meanings
                }
            };

        } catch (error: any) {
            return {
                type: 'error',
                content: `Could not get definition: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
