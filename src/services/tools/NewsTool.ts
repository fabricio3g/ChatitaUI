/**
 * NewsTool
 * Fetches news headlines using RSS feeds (no API key required)
 * Falls back to parsing Google News RSS
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

interface NewsItem {
    title: string;
    link: string;
    source?: string;
    pubDate?: string;
    description?: string;
}

export class NewsTool implements Tool {
    definition: ToolDefinition = {
        name: 'get_news',
        description: 'Get top news headlines by topic or category. Returns recent news articles with titles, sources, and links.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query or topic (e.g., "technology", "sports", "climate change")'
                },
                category: {
                    type: 'string',
                    description: 'News category (optional): "world", "business", "technology", "sports", "entertainment", "health", "science"',
                    enum: ['world', 'business', 'technology', 'sports', 'entertainment', 'health', 'science']
                },
                count: {
                    type: 'number',
                    description: 'Number of articles to return (default: 5, max: 10)'
                }
            },
            required: []
        }
    };

    // Google News RSS category URLs
    private categoryUrls: Record<string, string> = {
        world: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
        business: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
        technology: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB',
        sports: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB',
        entertainment: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB',
        health: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
        science: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB',
    };

    async execute(params: { query?: string; category?: string; count?: number }): Promise<ToolResponse> {
        try {
            const { query, category, count = 5 } = params;
            const maxCount = Math.min(count, 10);
            
            let rssUrl: string;
            let searchDescription: string;

            if (query) {
                // Search query - use Google News search RSS
                const encodedQuery = encodeURIComponent(query);
                rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
                searchDescription = `News about "${query}"`;
            } else if (category && this.categoryUrls[category]) {
                // Category feed
                rssUrl = this.categoryUrls[category];
                searchDescription = `Top ${category} news`;
            } else {
                // Default to top headlines
                rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
                searchDescription = 'Top headlines';
            }

            console.log('[NewsTool] Fetching RSS:', rssUrl);

            const response = await fetch(rssUrl, {
                headers: {
                    'User-Agent': 'KokoroTTSApp/1.0 (Mobile App)',
                    'Accept': 'application/rss+xml, application/xml, text/xml'
                }
            });

            if (!response.ok) {
                throw new Error(`RSS feed returned ${response.status}`);
            }

            const xml = await response.text();
            const items = this.parseRSS(xml, maxCount);

            if (items.length === 0) {
                return {
                    type: 'web_card',
                    content: `No news articles found for ${searchDescription}. Try a different query or category.`,
                    data: { articles: [], query, category }
                };
            }

            // Format for LLM context
            let content = `**${searchDescription}**\n\n`;
            items.forEach((item, index) => {
                content += `${index + 1}. **${item.title}**`;
                if (item.source) content += ` (${item.source})`;
                content += `\n`;
                if (item.description) {
                    const shortDesc = item.description.length > 150 
                        ? item.description.slice(0, 150) + '...' 
                        : item.description;
                    content += `   ${shortDesc}\n`;
                }
                content += `   [Read more](${item.link})\n\n`;
            });

            // Shape for WebSearchWidget: results array with url + title (widget expects .url, .title)
            const results = items.map((item) => ({
                title: item.title,
                url: item.link,
                source: item.source
            }));

            return {
                type: 'web_card',
                content,
                data: {
                    title: searchDescription,
                    query: query || searchDescription,
                    results,
                    searchDescription,
                    category: category || null,
                    articles: items,
                    count: items.length
                }
            };

        } catch (error: any) {
            console.error('[NewsTool] Error:', error);
            return {
                type: 'error',
                content: `Failed to fetch news: ${error.message}. Try again or use a different query.`,
                data: { error: error.message }
            };
        }
    }

    /**
     * Simple RSS XML parser (no external dependencies)
     */
    private parseRSS(xml: string, maxItems: number): NewsItem[] {
        const items: NewsItem[] = [];
        
        // Extract <item> blocks
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
            const itemXml = match[1];
            
            const title = this.extractTag(itemXml, 'title');
            const link = this.extractTag(itemXml, 'link');
            const pubDate = this.extractTag(itemXml, 'pubDate');
            const description = this.extractTag(itemXml, 'description');
            const source = this.extractTag(itemXml, 'source');

            if (title && link) {
                items.push({
                    title: this.cleanHtml(title),
                    link: link.trim(),
                    source: source ? this.cleanHtml(source) : undefined,
                    pubDate,
                    description: description ? this.cleanHtml(description).slice(0, 200) : undefined
                });
            }
        }

        return items;
    }

    private extractTag(xml: string, tag: string): string | undefined {
        // Handle CDATA
        const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
        const cdataMatch = xml.match(cdataRegex);
        if (cdataMatch) return cdataMatch[1];

        // Handle regular tags
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : undefined;
    }

    private cleanHtml(text: string): string {
        return text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
    }
}
