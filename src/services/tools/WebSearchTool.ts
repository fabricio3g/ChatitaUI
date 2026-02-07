import { Tool, ToolDefinition, ToolResponse } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const CACHE_KEY = 'web_search_cache_v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ScrapedResult {
    title: string;
    url: string;
    content: string;
    cachedAt?: number;
}

/**
 * Simple HTML entity decoder for React Native
 */
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
        '&hellip;': '...',
        '&ndash;': '-',
        '&mdash;': '-',
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&lsquo;': "'",
        '&rsquo;': "'",
    };
    
    return text.replace(/&[^;]+;/g, (match) => entities[match] || match);
}

/**
 * Extract text content from HTML using regex (React Native compatible)
 */
function extractTextFromHtml(html: string): string {
    if (!html) return '';
    // Remove script and style tags with content
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
    
    // Replace common block elements with newlines
    text = text
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = decodeHtmlEntities(text);
    
    // Clean up whitespace
    text = text
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    
    return text;
}

export class WebSearchTool implements Tool {
    definition: ToolDefinition = {
        name: 'web_search',
        description: 'Search the internet for current information. Results are cached for 24 hours.',
        renderType: 'web_card',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to find information about'
                },
                num_results: {
                    type: 'number',
                    description: 'Number of results to return (default: 5, max: 10)'
                }
            },
            required: ['query']
        }
    };

    private async getCacheKey(query: string, localeKey?: string, providerKey?: string): Promise<string> {
        const normalizedQuery = query.toLowerCase().trim();
        const normalizedLocale = (localeKey || 'global').toLowerCase().trim().replace(/\s+/g, '_');
        const normalizedProvider = (providerKey || 'headless').toLowerCase().trim().replace(/\s+/g, '_');
        return `${CACHE_KEY}_${normalizedProvider}_${normalizedLocale}_${normalizedQuery.replace(/\s+/g, '_')}`;
    }

    private async getCachedResult(cacheKey: string): Promise<ScrapedResult[] | null> {
        try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (!cached) return null;

            const parsed = JSON.parse(cached);

            // Check if cache is expired
            if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) {
                await AsyncStorage.removeItem(cacheKey);
                return null;
            }

            console.log(`[WebSearchTool] Cache hit for: ${cacheKey}`);
            return parsed.results as ScrapedResult[];
        } catch (e) {
            console.error('[WebSearchTool] Cache read error:', e);
            return null;
        }
    }

    private async cacheResults(cacheKey: string, results: ScrapedResult[]): Promise<void> {
        try {
            const data = {
                cachedAt: Date.now(),
                results
            };
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
            console.log(`[WebSearchTool] Cached ${results.length} results for: ${cacheKey}`);
        } catch (e) {
            console.error('[WebSearchTool] Cache write error:', e);
        }
    }

    async execute(params: {
        query: string;
        num_results?: number;
        onProgress?: (
            status: string,
            currentStep?: number,
            totalSteps?: number,
            meta?: { action?: string; url?: string; domain?: string; tool?: string }
        ) => void;
    }): Promise<ToolResponse> {
        const limit = Math.min(params.num_results || 5, 10);
        const onProgress = params.onProgress;
        const locale = await this.getSearchLocale(onProgress);
        const localeKey = locale.ddg || locale.google?.gl || 'global';
        const providerConfig = await this.getProviderConfig();
        const providerKey = providerConfig.provider || 'headless';
        const cacheKey = await this.getCacheKey(params.query, localeKey, providerKey);

        // Check cache first
        const cachedResults = await this.getCachedResult(cacheKey);
        if (cachedResults) {
            onProgress?.(`Using cached results for "${params.query}"`, 1, 3, { action: 'cache_hit', tool: 'web_search' });
            const summary = cachedResults.length > 0
                ? cachedResults.slice(0, limit).map(r => `[${r.title}](${r.url}): ${r.content.substring(0, 150)}...`).join('\n\n')
                : "No results found.";

            return {
                type: 'web_card',
                content: `Search results for "${params.query}" (from cache):\n${summary}`,
                data: {
                    query: params.query,
                    results: cachedResults.slice(0, limit),
                    cached: true
                }
            };
        }

        console.log(`[WebSearchTool] Cache miss, fetching fresh results for: ${params.query}`);

        try {
            onProgress?.(`Searching for "${params.query}"...`, 1, 4, { action: 'search_start', tool: 'web_search' });

            let results: ScrapedResult[] = [];

            if (providerConfig.provider === 'searxng' && providerConfig.baseUrl) {
                onProgress?.('Querying SearXNG…', 1, 4, { action: 'searxng', tool: 'web_search' });
                results = await this.searchSearxng(params.query, limit, providerConfig, locale);
            } else if (providerConfig.provider === 'duckduckgo' && providerConfig.baseUrl) {
                onProgress?.('Querying DuckDuckGo…', 1, 4, { action: 'duckduckgo_api', tool: 'web_search' });
                results = await this.searchDuckDuckGoApi(params.query, limit, providerConfig);
            } else if (providerConfig.provider === 'brave' && providerConfig.baseUrl && providerConfig.apiKey) {
                onProgress?.('Querying Brave Search…', 1, 4, { action: 'brave_api', tool: 'web_search' });
                results = await this.searchBraveApi(params.query, limit, providerConfig, locale);
            }

            // Default: headless search first (avoid DDG fetch hang)
            if (results.length === 0) {
                results = await this.scrapeWithHeadless(params.query, limit, locale.ddg);
            }
            if (results.length === 0) {
                onProgress?.('Trying Google fallback...', 3, 4, { action: 'fallback_google', tool: 'web_search' });
                console.log('[WebSearchTool] Headless DDG returned 0 results, trying Google...');
                results = await this.scrapeGoogleHeadless(params.query, limit, locale.google);
            }

            onProgress?.(`Found ${results.length} result${results.length === 1 ? '' : 's'}`, 4, 4, { action: 'complete', tool: 'web_search' });

            if (results.length > 0) {
                await this.cacheResults(cacheKey, results);
            }

            const summary = results.length > 0
                ? results.map((r: ScrapedResult) => `[${r.title}](${r.url}): ${r.content.substring(0, 150)}...`).join('\n\n')
                : "No results found.";

            return {
                type: 'web_card',
                content: `Search results for "${params.query}":\n${summary}`,
                data: {
                    query: params.query,
                    results,
                    cached: false
                }
            };
        } catch (e) {
            console.error('[WebSearchTool] Search failed:', e);
            onProgress?.('Primary search failed, trying fallback sources...', 3, 4, { action: 'fallback_jina', tool: 'web_search' });

            let fallbackResults: ScrapedResult[] = [];
            if (providerConfig.provider === 'searxng' && providerConfig.baseUrl) {
                fallbackResults = await this.searchSearxng(params.query, limit, providerConfig, locale);
            } else if (providerConfig.provider === 'duckduckgo' && providerConfig.baseUrl) {
                fallbackResults = await this.searchDuckDuckGoApi(params.query, limit, providerConfig);
            } else if (providerConfig.provider === 'brave' && providerConfig.baseUrl && providerConfig.apiKey) {
                fallbackResults = await this.searchBraveApi(params.query, limit, providerConfig, locale);
            }
            if (fallbackResults.length === 0) {
                fallbackResults = await this.scrapeGoogleHeadless(params.query, limit, locale.google);
            }
            if (fallbackResults.length === 0) {
                fallbackResults = await this.scrapeWithJina(params.query, limit);
            }

            if (fallbackResults.length > 0) {
                await this.cacheResults(cacheKey, fallbackResults);
            }

            const summary = fallbackResults.length > 0
                ? fallbackResults.map((r: ScrapedResult) => `[${r.title}](${r.url}): ${r.content.substring(0, 150)}...`).join('\n\n')
                : "No results found.";

            return {
                type: 'web_card',
                content: `Search results for "${params.query}" (via Jina fallback):\n${summary}`,
                data: {
                    query: params.query,
                    results: fallbackResults,
                    cached: false,
                    fallback: true,
                    error: "Network/Parsing Error - showing fallback results if available"
                }
            };
        }
    }

    private async scrapeDuckDuckGo(query: string, limit: number, kl?: string): Promise<ScrapedResult[]> {
        const localeParam = kl ? `&kl=${encodeURIComponent(kl)}` : '';
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}${localeParam}`;
        console.log('[WebSearchTool] Scraping DuckDuckGo (Fetch):', url);

        const response = await this.fetchWithTimeout(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        }, 8000);

        if (!response.ok) {
            throw new Error(`DuckDuckGo request failed: ${response.status}`);
        }

        const html = await response.text();
        return this.parseDuckDuckGoHTML(html, limit);
    }

    private async scrapeWithHeadless(query: string, limit: number, kl?: string): Promise<ScrapedResult[]> {
        try {
            const localeParam = kl ? `&kl=${encodeURIComponent(kl)}` : '';
            const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}${localeParam}`;
            console.log('[WebSearchTool] Scraping DuckDuckGo (Headless):', url);

            // Import dynamically to be safe (though static works too if no cycle)
            const { HeadlessScraperService } = require('../HeadlessScraperService');

            const result = await HeadlessScraperService.scrapePage(url, 'raw_html');
            if (result.content) {
                return this.parseDuckDuckGoHTML(result.content, limit);
            }
            return [];
        } catch (e) {
            console.error('[WebSearchTool] Headless search failed:', e);
            return [];
        }
    }

    private async scrapeGoogleHeadless(query: string, limit: number, googleLocale?: { hl?: string; gl?: string }): Promise<ScrapedResult[]> {
        try {
            const hl = googleLocale?.hl ? `&hl=${encodeURIComponent(googleLocale.hl)}` : '';
            const gl = googleLocale?.gl ? `&gl=${encodeURIComponent(googleLocale.gl)}` : '';
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}${hl}${gl}`;
            console.log('[WebSearchTool] Scraping Google (Headless):', url);
            const { HeadlessScraperService } = require('../HeadlessScraperService');
            const result = await HeadlessScraperService.scrapePage(url, 'raw_html');
            if (result.content) {
                return this.parseGoogleHTML(result.content, limit);
            }
            return [];
        } catch (e) {
            console.error('[WebSearchTool] Google headless search failed:', e);
            return [];
        }
    }

    private async getProviderConfig(): Promise<{ provider: 'headless' | 'searxng' | 'duckduckgo' | 'brave'; baseUrl?: string; apiKey?: string }> {
        const provider = (await AsyncStorage.getItem('settings_searchProvider')) as 'headless' | 'searxng' | 'duckduckgo' | 'brave' | null;
        const baseUrl = await AsyncStorage.getItem('settings_searchBaseUrl');
        const apiKey = await AsyncStorage.getItem('settings_searchApiKey');
        const ddgBaseUrl = await AsyncStorage.getItem('settings_ddgBaseUrl');
        const ddgApiKey = await AsyncStorage.getItem('settings_ddgApiKey');
        const braveBaseUrl = await AsyncStorage.getItem('settings_braveBaseUrl');
        const braveApiKey = await AsyncStorage.getItem('settings_braveApiKey');
        if (provider === 'duckduckgo') {
            return { provider, baseUrl: ddgBaseUrl || undefined, apiKey: ddgApiKey || undefined };
        }
        if (provider === 'brave') {
            return { provider, baseUrl: braveBaseUrl || undefined, apiKey: braveApiKey || undefined };
        }
        return {
            provider: provider || 'headless',
            baseUrl: baseUrl || undefined,
            apiKey: apiKey || undefined,
        };
    }

    private async getSearchLocale(
        onProgress?: (status: string, currentStep?: number, totalSteps?: number, meta?: { action?: string; url?: string; domain?: string; tool?: string }) => void
    ): Promise<{ ddg?: string; google?: { hl?: string; gl?: string } }> {
        try {
            const useGpsSetting = await AsyncStorage.getItem('settings_useGpsForSearch');
            const useGps = useGpsSetting === null ? true : useGpsSetting === 'true';
            if (!useGps) {
                return {};
            }

            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                onProgress?.('Location permission denied; using global search', 1, 4, { action: 'gps_denied', tool: 'web_search' });
                return {};
            }

            const location = await Location.getCurrentPositionAsync({});
            const [place] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            const country = (place?.isoCountryCode || '').toLowerCase();
            const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
            const language = locale.split('-')[0] || 'en';

            if (country) {
                const ddg = `${country}-${language}`;
                return { ddg, google: { gl: country, hl: language } };
            }
        } catch (e) {
            console.warn('[WebSearchTool] GPS locale lookup failed:', e);
        }

        return {};
    }

    private async searchSearxng(
        query: string,
        limit: number,
        config: { baseUrl?: string; apiKey?: string },
        locale: { ddg?: string; google?: { hl?: string; gl?: string } }
    ): Promise<ScrapedResult[]> {
        try {
            if (!config.baseUrl) return [];
            const base = config.baseUrl.replace(/\/$/, '');
            const language = locale.google?.hl || Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0] || 'en';
            const url = `${base}/search?format=json&q=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&safesearch=0&categories=general`;

            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };
            if (config.apiKey) {
                headers['X-API-Key'] = config.apiKey;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) {
                return [];
            }

            const json = await response.json();
            const results = Array.isArray(json?.results) ? json.results : [];
            return results.slice(0, limit).map((r: any) => ({
                title: r.title || r.url || 'Result',
                url: r.url,
                content: r.content || r.snippet || r.summary || '',
            })).filter((r: ScrapedResult) => !!r.url);
        } catch (e) {
            console.error('[WebSearchTool] SearXNG search failed:', e);
            return [];
        }
    }

    private async searchDuckDuckGoApi(
        query: string,
        limit: number,
        config: { baseUrl?: string; apiKey?: string }
    ): Promise<ScrapedResult[]> {
        try {
            const base = (config.baseUrl || 'https://api.duckduckgo.com').replace(/\/$/, '');
            const url = `${base}/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
            const headers: Record<string, string> = { 'Accept': 'application/json' };
            if (config.apiKey) headers['X-API-Key'] = config.apiKey;
            const res = await this.fetchWithTimeout(url, { headers }, 8000);
            if (!res.ok) return [];
            const json = await res.json();
            const results: ScrapedResult[] = [];
            const addTopic = (t: any) => {
                if (t?.FirstURL && t?.Text) {
                    results.push({ title: t.Text, url: t.FirstURL, content: t.Text });
                }
            };
            if (Array.isArray(json?.RelatedTopics)) {
                json.RelatedTopics.forEach((t: any) => {
                    if (t?.Topics && Array.isArray(t.Topics)) {
                        t.Topics.forEach(addTopic);
                    } else {
                        addTopic(t);
                    }
                });
            }
            if (json?.AbstractURL && json?.AbstractText) {
                results.unshift({ title: json.Heading || 'DuckDuckGo', url: json.AbstractURL, content: json.AbstractText });
            }
            return results.slice(0, limit);
        } catch (e) {
            console.error('[WebSearchTool] DuckDuckGo API failed:', e);
            return [];
        }
    }

    private async searchBraveApi(
        query: string,
        limit: number,
        config: { baseUrl?: string; apiKey?: string },
        locale: { ddg?: string; google?: { hl?: string; gl?: string } }
    ): Promise<ScrapedResult[]> {
        try {
            if (!config.baseUrl || !config.apiKey) return [];
            const base = config.baseUrl.replace(/\/$/, '');
            const country = locale.google?.gl || 'us';
            const lang = locale.google?.hl || 'en';
            const url = `${base}?q=${encodeURIComponent(query)}&count=${Math.min(limit, 10)}&country=${encodeURIComponent(country)}&search_lang=${encodeURIComponent(lang)}`;
            const headers: Record<string, string> = {
                'Accept': 'application/json',
                'X-Subscription-Token': config.apiKey,
            };
            const res = await this.fetchWithTimeout(url, { headers }, 8000);
            if (!res.ok) return [];
            const json = await res.json();
            const items = json?.web?.results || [];
            return items.slice(0, limit).map((r: any) => ({
                title: r.title || r.url || 'Result',
                url: r.url,
                content: r.description || r.snippet || '',
            })).filter((r: ScrapedResult) => !!r.url);
        } catch (e) {
            console.error('[WebSearchTool] Brave API failed:', e);
            return [];
        }
    }

    private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(id);
        }
    }

    private parseGoogleHTML(html: string, limit: number): ScrapedResult[] {
        const results: ScrapedResult[] = [];
        
        // Regex-based parsing for React Native compatibility
        // Google result blocks are typically in div.g containers
        const resultBlocks = html.match(/<div class="[^"]*g[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?=<div class="[^"]*g[^"]*"|<\/div>\s*<\/div>)/g) || [];
        
        for (const block of resultBlocks.slice(0, limit)) {
            // Extract title from h3 tag
            const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/i);
            const title = titleMatch ? extractTextFromHtml(titleMatch[1]) : '';
            
            // Extract URL from anchor tag
            const linkMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
            let url = linkMatch ? linkMatch[1] : '';
            
            // Decode Google redirect URLs
            if (url.startsWith('/url?q=')) {
                try {
                    url = decodeURIComponent(url.replace('/url?q=', '').split('&')[0]);
                } catch (e) {
                    // Keep original if decode fails
                }
            }
            
            // Extract snippet from various possible containers
            const snippetMatch = block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || 
                                block.match(/<span[^>]*class="[^"]*aCOpRe[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
            const content = snippetMatch ? extractTextFromHtml(snippetMatch[1]) : '';
            
            if (title && url.startsWith('http')) {
                results.push({ title, url, content });
            }
        }
        
        return results;
    }

    private parseDuckDuckGoHTML(html: string, limit: number): ScrapedResult[] {
        const results: ScrapedResult[] = [];
        
        // Regex-based parsing for React Native compatibility
        // Find all result blocks
        const resultBlocks = html.match(/<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<\/div>\s*(?=<div[^>]*class="[^"]*result[^"]*"|$)/g) || [];
        console.log(`[WebSearchTool] Found ${resultBlocks.length} raw results`);
        
        for (const block of resultBlocks.slice(0, limit)) {
            // Extract title and URL from result__a
            const linkMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i);
            
            if (linkMatch) {
                let url = linkMatch[1];
                const title = extractTextFromHtml(linkMatch[2]);
                
                // Decode DDG redirect URLs
                if (url.includes('uddg=')) {
                    try {
                        const match = url.match(/uddg=([^&]+)/);
                        if (match && match[1]) {
                            url = decodeURIComponent(match[1]);
                        }
                    } catch (e) {
                        // Keep original URL if decode fails
                    }
                }
                
                // Extract snippet from result__snippet
                const snippetMatch = block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                                    block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
                const content = snippetMatch ? extractTextFromHtml(snippetMatch[1]) : 'No description available.';
                
                // Skip internal DDG links (ads or related searches)
                if (!url.includes('duckduckgo.com') && title) {
                    results.push({
                        title: title,
                        url: url,
                        content: content
                    });
                }
            }
        }
        
        console.log(`[WebSearchTool] Parsed ${results.length} valid results`);
        return results;
    }



    private async scrapeWithJina(query: string, limit: number): Promise<ScrapedResult[]> {
        try {
            const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const jinaUrl = `https://r.jina.ai/${encodeURIComponent(ddgUrl)}`;
            const response = await fetch(jinaUrl);

            if (!response.ok) return [];

            const markdown = await response.text();
            return this.parseJinaMarkdown(markdown, limit);
        } catch (e) {
            console.error('[WebSearchTool] Jina fallback error:', e);
            return [];
        }
    }

    private parseJinaMarkdown(markdown: string, limit: number): ScrapedResult[] {
        const results: ScrapedResult[] = [];
        const lines = markdown.split('\n');
        const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/;

        let currentLink: ScrapedResult | null = null;
        let currentContent: string[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(linkRegex);
            if (match) {
                // Save previous result
                if (currentLink) {
                    currentLink.content = currentContent.join(' ').substring(0, 300);
                    results.push(currentLink);
                }

                const title = match[1];
                const url = match[2];

                // Skip DuckDuckGo internal links
                if (!url.includes('duckduckgo.com') && !title.toLowerCase().includes('duckduckgo')) {
                    currentLink = {
                        title: title.trim(),
                        url: url.trim(),
                        content: ''
                    };
                    currentContent = [];
                } else {
                    currentLink = null;
                }
            } else if (currentLink) {
                currentContent.push(trimmedLine);
            }

            if (results.length >= limit) break;
        }

        // Save last result
        if (currentLink) {
            currentLink.content = currentContent.join(' ').substring(0, 300);
            results.push(currentLink);
        }

        return results;
    }

    async clearCache(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY));
            await AsyncStorage.multiRemove(cacheKeys);
            console.log('[WebSearchTool] Cache cleared');
        } catch (e) {
            console.error('[WebSearchTool] Cache clear error:', e);
        }
    }

    async getCacheStats(): Promise<{ size: number; oldestEntry?: number }> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY));

            if (cacheKeys.length === 0) {
                return { size: 0 };
            }

            const entries = await AsyncStorage.multiGet(cacheKeys);
            let oldestTimestamp = Infinity;

            for (const [_, value] of entries) {
                if (value) {
                    try {
                        const parsed = JSON.parse(value);
                        if (parsed.cachedAt && parsed.cachedAt < oldestTimestamp) {
                            oldestTimestamp = parsed.cachedAt;
                        }
                    } catch (e) {
                        // Skip invalid entries
                    }
                }
            }

            return {
                size: cacheKeys.length,
                oldestEntry: oldestTimestamp === Infinity ? undefined : oldestTimestamp
            };
        } catch (e) {
            console.error('[WebSearchTool] Cache stats error:', e);
            return { size: 0 };
        }
    }
}
