/**
 * Deep Search Tool
 * Performs web search then scrapes top results for detailed content
 * Automatically runs as background task
 */

import { Tool, ToolDefinition, ToolResponse } from './types';
import type { ScrapeResult } from '../HeadlessScraperService';
import { extractCleanText, getContentLimit } from '../../utils/contentExtraction';


export class DeepSearchTool implements Tool {
    definition: ToolDefinition = {
        name: 'deep_search',
        description: 'Perform a deep internet search with content scraping from top results. Use for complex research queries.',
        renderType: 'background_task', // NEW: Indicates this runs as background task
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query'
                },
                num_sources: {
                    type: 'number',
                    description: 'Number of sources to scrape (1-5, default: 3)'
                }
            },
            required: ['query']
        }
    };

    async execute(params: {
        query: string;
        num_sources?: number;
        depth?: string;
        conversationId?: string;
        onProgress?: (
            status: string,
            currentStep?: number,
            totalSteps?: number,
            meta?: { action?: string; url?: string; domain?: string; tool?: string }
        ) => void;
    }): Promise<ToolResponse> {
        const numSources = Math.min(params.num_sources || 4, 15);
        const depth = params.depth || 'normal';
        const onProgress = params.onProgress;

        interface DeepSearchResult {
            query: string;
            sources: Array<{
                title: string;
                url: string;
                content: string;
                method?: string;
            }>;
            wiki: {
                title: string;
                url: string;
                summary: string;
                thumbnail?: string;
            } | null;
            cached?: boolean;
        }

        const results: DeepSearchResult = {
            query: params.query,
            sources: [],
            wiki: null,
            cached: false
        };

        const numSteps = 5;
        let currentStep = 0;

        try {
            // Lazy load to avoid circular dependency
            const { ToolRegistry } = require('./ToolRegistry');
            const webSearchTool = ToolRegistry.getTool('web_search');

            let searchResults: any[] = [];
            let wikiResult: any = null;

            if (onProgress) onProgress('Checking Wikipedia...', 1, numSteps, { action: 'wiki_lookup', tool: 'deep_search' });
            currentStep = 1;

            if (!webSearchTool) {
                wikiResult = await this.searchWikipedia(params.query);
            } else {
                if (onProgress) onProgress('Searching the web...', currentStep, numSteps, { action: 'web_search', tool: 'deep_search' });
                const [toolResponse, wikiRes] = await Promise.all([
                    webSearchTool.execute({
                        query: params.query,
                        num_results: numSources + 2
                    }),
                    this.searchWikipedia(params.query)
                ]);
                currentStep = 2;

                searchResults = Array.isArray(toolResponse)
                    ? toolResponse
                    : (toolResponse.data?.results || []);

                wikiResult = wikiRes;

                if (toolResponse.data?.cached) {
                    results.cached = true;
                }
            }

            if (wikiResult) {
                results.wiki = wikiResult;
            }

            if (!Array.isArray(searchResults) || searchResults.length === 0) {
                if (wikiResult) {
                    return {
                        type: 'web_card',
                        content: `Deep Search for "${params.query}": Found 1 source (Wikipedia).`,
                        data: results
                    };
                }
                return {
                    type: 'error',
                    content: 'No search results found for your query.',
                    data: { error: 'No results found' }
                };
            }

            const urlsToScrape = searchResults
                .filter((r: any) => !r.url.includes('wikipedia.org'))
                .slice(0, numSources);

            onProgress?.(`Found ${urlsToScrape.length} sources to analyze...`, 3, numSteps, { action: 'select_sources', tool: 'deep_search' });

            // Use concurrent scraping for faster results
            const scrapedContent = await this.scrapeMultipleUrls(
                urlsToScrape.map((r: any) => ({ url: r.url, title: r.title, snippet: r.content })),
                onProgress,
                3,
                numSteps,
                depth
            );
            currentStep = 4;

            results.sources = scrapedContent;

            const totalSources = results.sources.length + (results.wiki ? 1 : 0);

            if (totalSources === 0) {
                return {
                    type: 'error',
                    content: 'No information found from Deep Search.',
                    data: { error: 'Both Wikipedia and Web Search returned no results.' }
                };
            }

            const cacheStatus = results.cached ? ' (from cache)' : '';

            // Return simple summary for LLM (not raw data - avoids slow rendering)
            // Full content available in data for widget display
            const sourceList = results.sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
            const wikiLine = results.wiki ? `\nWikipedia: ${results.wiki.title}` : '';

            const llmContent = `Deep Research completed for "${params.query}" (${totalSources} source${totalSources > 1 ? 's' : ''}${cacheStatus}).\n\nSources:\n${sourceList}${wikiLine}\n\nPlease provide a comprehensive summary based on these sources.`;

            return {
                type: 'background_task',
                content: llmContent,
                data: {
                    ...results,
                    title: 'DEEP RESEARCH RESULTS',
                    query: params.query,
                }
            };

        } catch (error: any) {
            console.error('[DeepSearchTool] Error:', error);
            return {
                type: 'error',
                content: 'Deep search failed',
                data: { error: error.message }
            };
        }
    }



    private async searchWikipedia(query: string): Promise<{ title: string; url: string; summary: string; thumbnail?: string } | null> {
        try {
            const headers = { 'User-Agent': 'Kokoro-TTS-Go/1.0 (contact@example.com)' };
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
            const searchRes = await fetch(searchUrl, { headers });

            if (!searchRes.ok) throw new Error(`Wiki Search failed: ${searchRes.status}`);
            const searchData = await searchRes.json();

            if (!searchData[1] || searchData[1].length === 0) return null;

            const title = searchData[1][0];
            const url = searchData[3][0];

            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
            const summaryRes = await fetch(summaryUrl, { headers });

            if (!summaryRes.ok) {
                // 404 is common if title mismatch
                return null;
            }

            // Verify content type
            const contentType = summaryRes.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // Not JSON (maybe HTML error page)
                const text = await summaryRes.text();
                // console.log('[DeepSearchTool] Wiki returned non-JSON:', text.substring(0, 100));
                return null;
            }

            const summaryData = await summaryRes.json();

            if (summaryData.title && summaryData.extract) {
                return {
                    title: summaryData.title,
                    url: url,
                    summary: summaryData.extract,
                    thumbnail: summaryData.thumbnail?.source
                };
            }
            return null;
        } catch (e) {
            console.error('[DeepSearchTool] Wiki failed:', e);
            return null;
        }
    }

    private async scrapeMultipleUrls(
        urls: Array<{ url: string; title: string; snippet?: string }>,
        onProgress?: (
            status: string,
            currentStep?: number,
            totalSteps?: number,
            meta?: { action?: string; url?: string; domain?: string; tool?: string }
        ) => void,
        startStep?: number,
        totalSteps?: number,
        depth?: string
    ): Promise<Array<{ title: string; url: string; content: string; method?: string }>> {
        try {
            console.log(`[DeepSearchTool] Starting concurrent scrape of ${urls.length} URLs`);
            const startTime = Date.now();
            
            onProgress?.(`Scraping ${urls.length} sources concurrently...`, startStep || 3, totalSteps, { action: 'scrape_concurrent', tool: 'deep_search' });
            for (const source of urls) {
                try {
                    const domain = new URL(source.url).hostname.replace('www.', '');
                    onProgress?.(`Queued source ${domain}`, startStep || 3, totalSteps, {
                        action: 'queue_source',
                        url: source.url,
                        domain,
                        tool: 'deep_search',
                    });
                } catch {
                    // Ignore invalid URL format
                }
            }

            // Dynamic import to avoid cycles
            const { HeadlessScraperService } = require('../HeadlessScraperService');
            
            const results = await HeadlessScraperService.scrapeMultiple(
                urls.map(u => u.url),
                'content'
            );

            const duration = Date.now() - startTime;
            console.log(`[DeepSearchTool] Concurrent scrape complete: ${results.length} sources in ${duration}ms`);
            
            onProgress?.(`Processing ${results.length} sources...`, (startStep || 3) + 1, totalSteps, { action: 'process_sources', tool: 'deep_search' });

            const scrapedContent: Array<{ title: string; url: string; content: string; method?: string }> = [];
            const contentLimit = getContentLimit(depth || 'normal');

            results.forEach((result: ScrapeResult, index: number) => {
                const source = urls[index];
                if (result.content && result.content.length > 50 && !result.error) {
                    // Clean the content to remove HTML and extract raw text
                    const cleanContent = extractCleanText(result.content);
                    scrapedContent.push({
                        title: source.title,
                        url: source.url,
                        content: cleanContent.substring(0, contentLimit),
                        method: 'direct'
                    });
                } else if (source.snippet) {
                    scrapedContent.push({
                        title: source.title,
                        url: source.url,
                        content: `[Snippet] ${source.snippet}`,
                        method: 'snippet'
                    });
                }
            });

            return scrapedContent;
        } catch (error) {
            console.error('[DeepSearchTool] Concurrent scraping failed, falling back to sequential:', error);
            // Fallback to sequential scraping
            return this.scrapeUrlsSequential(urls, onProgress, depth);
        }
    }

    private async scrapeUrlsSequential(
        urls: Array<{ url: string; title: string; snippet?: string }>,
        onProgress?: (
            status: string,
            currentStep?: number,
            totalSteps?: number,
            meta?: { action?: string; url?: string; domain?: string; tool?: string }
        ) => void,
        depth?: string
    ): Promise<Array<{ title: string; url: string; content: string; method?: string }>> {
        const scrapedContent: Array<{ title: string; url: string; content: string; method?: string }> = [];
        const contentLimit = getContentLimit(depth || 'normal');

        for (const source of urls) {
            if (onProgress) {
                const domain = new URL(source.url).hostname.replace('www.', '');
                onProgress(`Reading ${domain}...`, undefined, undefined, {
                    action: 'read_source',
                    url: source.url,
                    domain,
                    tool: 'deep_search',
                });
            }

            try {
                const content = await this.scrapeUrl(source.url);
                if (content && content.length > 50) {
                    // Clean the content to remove HTML and extract raw text
                    const cleanContent = extractCleanText(content);
                    scrapedContent.push({
                        title: source.title,
                        url: source.url,
                        content: cleanContent.substring(0, contentLimit),
                        method: 'direct'
                    });
                } else if (source.snippet) {
                    scrapedContent.push({
                        title: source.title,
                        url: source.url,
                        content: `[Snippet] ${source.snippet}`,
                        method: 'snippet'
                    });
                }
            } catch (e) {
                if (source.snippet) {
                    scrapedContent.push({
                        title: source.title,
                        url: source.url,
                        content: `[Snippet] ${source.snippet}`,
                        method: 'snippet'
                    });
                }
            }
        }

        return scrapedContent;
    }

    private async scrapeUrl(url: string): Promise<string | null> {
        return this.scrapeWithHeadless(url);
    }

    private async scrapeWithHeadless(url: string): Promise<string | null> {
        try {
            console.log(`[DeepSearchTool] Scraping via Headless Browser: ${url}`);
            // Dynamic import to avoid cycles or load issues
            const { HeadlessScraperService } = require('../HeadlessScraperService');

            const result = await HeadlessScraperService.scrapePage(url, 'content');

            if (result.content && result.content.length > 50) {
                return result.content;
            } else {
                console.log(`[DeepSearchTool] Headless content empty/short.`);
                return this.scrapeWithJina(url);
            }
        } catch (error) {
            console.log(`[DeepSearchTool] Headless scraping failed:`, error);
            return this.scrapeWithJina(url);
        }
    }

    private async scrapeWithJina(url: string): Promise<string | null> {
        try {
            console.log(`[DeepSearchTool] Scraping via Jina Reader: ${url}`);
            const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
            const response = await fetch(jinaUrl);

            if (!response.ok) return null;

            const text = await response.text();
            if (!text || text.length < 50 || text.includes('Jina Reader') || text.includes('404')) {
                return null;
            }
            return text;
        } catch (e) {
            console.error('[DeepSearchTool] Jina fallback failed', e);
            return null;
        }
    }
}
