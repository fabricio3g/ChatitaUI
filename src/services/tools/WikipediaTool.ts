/**
 * WikipediaTool
 * Fetches Wikipedia article summaries using MediaWiki API
 * No API key required. Tries REST summary first, then legacy action=query.
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

interface WikiSummary {
    title: string;
    extract: string;
    description?: string;
    content_urls?: { desktop: { page: string }; mobile: { page: string } };
}

export class WikipediaTool implements Tool {
    definition: ToolDefinition = {
        name: 'wikipedia',
        description: 'Get a Wikipedia summary for a topic in English. Returns a brief extract, description, and link to the full article.',
        parameters: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'The topic to look up on Wikipedia'
                }
            },
            required: ['topic']
        }
    };

    async execute(params: { topic: string }): Promise<ToolResponse> {
        try {
            const { topic } = params;
            const language = 'en';
            const cleanTopic = topic.trim().replace(/\s+/g, '_');
            const encodedTopic = encodeURIComponent(cleanTopic);

            // Try REST API first
            const restUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodedTopic}`;
            const response = await fetch(restUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'KokoroTTSApp/1.0 (https://github.com/kokoro-tts; Mobile)'
                }
            });

            if (response.ok) {
                const data: WikiSummary = await response.json();
                const extract = data.extract || 'No summary available.';
                const articleUrl = data.content_urls?.mobile?.page || data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(cleanTopic)}`;

                let content = `**${data.title}**`;
                if (data.description) content += ` - ${data.description}`;
                content += `\n\n${extract}\n\n[Read more](${articleUrl})`;

                return {
                    type: 'definition',
                    content,
                    data: {
                        title: data.title,
                        description: data.description,
                        extract,
                        url: articleUrl,
                        language
                    }
                };
            }

            // Fallback: legacy action=query API (works when REST is blocked or fails)
            const legacyUrl = `https://${language}.wikipedia.org/w/api.php?action=query&titles=${encodedTopic}&prop=extracts|pageprops&exintro&explaintext&exsectionformat=plain&format=json&origin=*`;
            const legacyRes = await fetch(legacyUrl, {
                headers: { 'User-Agent': 'KokoroTTSApp/1.0 (https://github.com/kokoro-tts; Mobile)' }
            });

            if (!legacyRes.ok) {
                throw new Error(`Wikipedia API returned ${legacyRes.status}`);
            }

            const legacy = await legacyRes.json();
            const pages = legacy.query?.pages || {};
            const pageId = Object.keys(pages).find(id => id !== '-1');
            if (!pageId || pageId === '-1') {
                return {
                    type: 'error',
                    content: `No Wikipedia article found for "${topic}". Try a different search term.`,
                    data: { error: 'Not found', query: topic }
                };
            }

            const page = pages[pageId];
            const title = page.title || topic;
            const extract = (page.extract || '').trim() || 'No summary available.';
            const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

            let content = `**${title}**\n\n${extract}\n\n[Read more](${articleUrl})`;

            return {
                type: 'definition',
                content,
                data: {
                    title,
                    description: undefined,
                    extract,
                    url: articleUrl,
                    language
                }
            };

        } catch (error: any) {
            console.error('[WikipediaTool] Error:', error);
            return {
                type: 'error',
                content: `Failed to fetch Wikipedia: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
