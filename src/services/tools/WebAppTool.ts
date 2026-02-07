import { Tool, ToolDefinition, ToolResponse } from './types';
import { HeadlessScraperService } from '../HeadlessScraperService';
import { WebAppsService } from '../WebAppsService';
import { WebApp } from '../../types/webs';

type WebAction = 'read_page' | 'analyze_page' | 'save_selectors' | 'post_text' | 'reply_text' | 'read_multiple';

const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(16);
};

const buildAuthPayload = async (app: WebApp) => {
    const cookieEntry = app.authEntries.find(entry => entry.type === 'cookies');
    if (!cookieEntry) return undefined;
    const secret = await WebAppsService.getAuthSecret(cookieEntry.secretKeyId);
    if (!secret) return undefined;

    if (Array.isArray(secret)) {
        return { cookies: secret };
    }
    if (typeof secret === 'string') {
        return { cookies: [secret] };
    }
    if (typeof secret === 'object') {
        return {
            cookies: Array.isArray(secret.cookies) ? secret.cookies : [],
            localStorage: typeof secret.localStorage === 'object' ? secret.localStorage : undefined
        };
    }
    return undefined;
};

const buildPostScript = (text: string) => `
(function() {
    const payload = ${JSON.stringify(text)};
    function findInput() {
        return document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    }
    function setValue(el) {
        if (!el) return false;
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
            el.value = payload;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            el.innerText = payload;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: payload }));
        }
        return true;
    }
    function findActionButton() {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => /post|tweet|send|reply|publish/i.test(btn.innerText || ''));
    }
    const input = findInput();
    if (!input) return { ok: false, error: 'Input not found' };
    setValue(input);
    const actionBtn = findActionButton();
    if (!actionBtn) return { ok: false, error: 'Action button not found' };
    actionBtn.click();
    return { ok: true };
})();
`;

const isAllowedHost = (hostname: string, allowlist: string[]) => {
    const normalized = hostname.replace('www.', '').toLowerCase();
    return allowlist.some(entry => {
        const allowed = entry.replace('www.', '').toLowerCase();
        return normalized === allowed || normalized.endsWith(`.${allowed}`);
    });
};

const normalizeUrl = (input: string) => {
    try {
        const parsed = new URL(input);
        if (parsed.hostname.startsWith('www.')) {
            parsed.hostname = parsed.hostname.slice(4);
        }
        return parsed.toString();
    } catch {
        return input;
    }
};

const isBlockedContent = (content: string) => (
    /content not available|something went wrong|please sign in|please log in|access denied|403 forbidden/i.test(content) &&
    content.length < 500
);

export class WebAppTool implements Tool {
    definition: ToolDefinition = {
        name: 'web_app_action',
        description: 'Autonomously browse and interact with configured websites. Start with read_page on base URL to learn how the site works, then navigate based on what you discover in the content.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'read_page: get content from single URL. read_multiple: scrape multiple URLs concurrently (faster). analyze_page: get raw HTML when content is empty. save_selectors: remember discovered CSS selectors. post_text/reply_text: write content.',
                    enum: ['read_page', 'read_multiple', 'analyze_page', 'save_selectors', 'post_text', 'reply_text']
                },
                url: {
                    type: 'string',
                    description: 'URL to navigate. For read_multiple, use urls array instead.'
                },
                urls: {
                    type: 'array',
                    description: 'Array of URLs for read_multiple action (concurrent scraping). Much faster than sequential reads.'
                },
                text: {
                    type: 'string',
                    description: 'Text content for post_text/reply_text'
                },
                selectors: {
                    type: 'object',
                    description: 'For save_selectors: CSS selectors you discovered that extract useful content from this site'
                },
                confirm: {
                    type: 'boolean',
                    description: 'Set true to execute write actions'
                },
                web_app_id: {
                    type: 'string',
                    description: 'Web app ID from the configured apps list'
                }
            },
            required: ['action']
        }
    };

    async execute(params: {
        action: WebAction;
        url?: string;
        urls?: string[];
        text?: string;
        selectors?: Record<string, string>;
        confirm?: boolean;
        web_app_id?: string
    }): Promise<ToolResponse | any> {
        // Find the web app
        let app = params.web_app_id
            ? await WebAppsService.getWebApp(params.web_app_id)
            : null;

        // Auto-detect from URL domain
        if (!app && params.url) {
            try {
                const urlHost = new URL(params.url).hostname.replace('www.', '').toLowerCase();
                const allApps = await WebAppsService.listWebApps();
                app = allApps.find(a => {
                    const baseHost = new URL(a.baseUrl).hostname.replace('www.', '').toLowerCase();
                    return urlHost === baseHost || urlHost.endsWith(`.${baseHost}`) ||
                           (a.allowlistDomains || []).some(d =>
                               urlHost === d.replace('www.', '').toLowerCase() ||
                               urlHost.endsWith(`.${d.replace('www.', '').toLowerCase()}`)
                           );
                });
                if (app) {
                    console.log(`[WebAppTool] Auto-detected web app "${app.name}" from URL`);
                }
            } catch (e) {
                console.log('[WebAppTool] Could not auto-detect web app from URL');
            }
        }

        // Fallback to active web app
        if (!app) {
            app = await WebAppsService.getActiveWebApp();
        }

        if (!app) {
            const allApps = await WebAppsService.listWebApps();
            const appList = allApps.map(a => `"${a.name}" (id: ${a.id}, url: ${a.baseUrl})`).join(', ');
            return {
                type: 'error',
                content: `No web app found. Available: ${appList || 'none'}. Pass web_app_id parameter.`,
                data: { error: 'No web app', availableApps: allApps.map(a => ({ id: a.id, name: a.name, baseUrl: a.baseUrl })) }
            };
        }

        const targetUrl = normalizeUrl(params.url || app.baseUrl);
        let hostname = '';
        try {
            hostname = new URL(targetUrl).hostname;
        } catch {
            return { type: 'error', content: 'Invalid URL', data: { error: 'Invalid URL' } };
        }

        if (app.allowlistDomains?.length && !isAllowedHost(hostname, app.allowlistDomains)) {
            return { type: 'error', content: `Domain not in allowlist: ${app.allowlistDomains.join(', ')}`, data: { error: 'Domain not allowed' } };
        }

        const auth = await buildAuthPayload(app);
        const authMeta = {
            cookieCount: Array.isArray(auth?.cookies) ? auth?.cookies.length : 0,
            hasLocalStorage: !!auth?.localStorage
        };
        console.log('[WebAppTool] Auth payload:', authMeta);

        // SAVE SELECTORS - LLM discovered useful selectors
        if (params.action === 'save_selectors' && params.selectors) {
            console.log(`[WebAppTool] Saving selectors for ${app.name}:`, params.selectors);
            const currentSelectors = app.selectors || {};
            const newReadSelectors = [
                ...(currentSelectors.readSelectors || []),
                ...Object.values(params.selectors)
            ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20) as string[];

            // Convert single selectors to arrays for byAction
            const newByAction: Record<string, string[]> = { ...currentSelectors.byAction };
            for (const [key, val] of Object.entries(params.selectors)) {
                newByAction[key] = [...(newByAction[key] || []), val].filter((v, i, a) => a.indexOf(v) === i);
            }

            await WebAppsService.updateSelectorMemory(app.id, {
                readSelectors: newReadSelectors,
                byAction: newByAction
            });

            return {
                type: 'web_app',
                content: `Saved selectors for ${app.name}. Will use these for future page reads.`,
                data: { saved: params.selectors, appId: app.id }
            };
        }

        // ANALYZE PAGE - Get raw HTML for LLM to learn structure
        if (params.action === 'analyze_page') {
            console.log(`[WebAppTool] Analyzing page structure: ${targetUrl}`);

            const result = await HeadlessScraperService.scrapePage(targetUrl, 'raw_html', { auth });

            // Return HTML + structure hints
            const html = (result.content || '').substring(0, 20000);

            return {
                type: 'web_app',
                content: `Raw HTML from ${hostname}. Analyze this to find useful selectors (data-testid, aria-label, class names, etc). Then use save_selectors to remember them.`,
                data: {
                    url: result.url || targetUrl,
                    title: result.title,
                    html: html,
                    savedSelectors: app.selectors || {}
                }
            };
        }

        // READ PAGE - Get content
        if (params.action === 'read_page') {
            if (app.permissions?.read === false) {
                return { type: 'web_app', content: 'Read not permitted for this web app.', data: { url: targetUrl, title: app.name, error: 'Read permission is disabled for this web app.' } };
            }

            // Use saved selectors if available for waitFor
            const savedSelectors = app.selectors?.readSelectors || [];
            const waitForSelector = savedSelectors.length > 0 ? savedSelectors[0] : 'main, article, [role="main"]';

            console.log(`[WebAppTool] Reading ${targetUrl} with auth:`, !!auth, 'waitFor:', waitForSelector);

            const result = await HeadlessScraperService.scrapePage(targetUrl, 'content', {
                auth,
                waitForSelector
            });

            const content = (result.content || '').trim();
            const pageInfo = (result as any).pageInfo || {};

            console.log('[WebAppTool] Scrape result:', {
                url: result.url,
                title: result.title,
                contentLength: content.length,
                pageInfo
            });

            if (!content || isBlockedContent(content)) {
                // Still return web_app type so widget shows with error info
                return {
                    type: 'web_app',
                    content: `Could not extract content from ${hostname}. The page loaded but content may be dynamically rendered or require different authentication.`,
                    data: {
                        url: result.url || targetUrl,
                        title: result.title || hostname,
                        content: '', // Empty content
                        error: 'Content could not be extracted. Try using analyze_page to inspect the page structure.',
                        pageInfo
                    }
                };
            }

            // Update cache
            await WebAppsService.updateCache(app.id, {
                lastUrl: result.url,
                lastTitle: result.title,
                lastContentHash: hashString(content),
                lastSummary: content.substring(0, 800)
            });

            return {
                type: 'web_app',
                content: `Web content from ${hostname}.`,
                data: {
                    url: result.url || targetUrl,
                    title: result.title || hostname,
                    content: content.substring(0, 8000),
                    pageInfo
                }
            };
        }

        // READ MULTIPLE - Concurrent scraping of multiple URLs
        if (params.action === 'read_multiple') {
            if (app.permissions?.read === false) {
                return {
                    type: 'web_app',
                    content: 'Read not permitted for this web app.',
                    data: { error: 'Read permission is disabled for this web app.' }
                };
            }

            const urls = params.urls || (params.url ? [params.url] : []);
            if (urls.length === 0) {
                return { type: 'error', content: 'No URLs provided for read_multiple.', data: { error: 'No URLs' } };
            }

            // Validate all URLs against allowlist
            const validUrls: string[] = [];
            for (const url of urls) {
                try {
                    const urlHost = new URL(url).hostname;
                    if (!app.allowlistDomains?.length || isAllowedHost(urlHost, app.allowlistDomains)) {
                        validUrls.push(normalizeUrl(url));
                    }
                } catch {
                    console.log('[WebAppTool] Invalid URL skipped:', url);
                }
            }

            if (validUrls.length === 0) {
                return { type: 'error', content: 'No valid URLs to scrape.', data: { error: 'No valid URLs' } };
            }

            const savedSelectors = app.selectors?.readSelectors || [];
            const waitForSelector = savedSelectors.length > 0 ? savedSelectors[0] : 'main, article, [role="main"]';

            console.log(`[WebAppTool] Starting concurrent scrape of ${validUrls.length} URLs...`);
            const startTime = Date.now();

            // Use concurrent scraping
            const results = await HeadlessScraperService.scrapeMultiple(validUrls, 'content', {
                auth,
                waitForSelector
            });

            const duration = Date.now() - startTime;
            const successCount = results.filter(r => !r.error && r.content?.length > 0).length;

            console.log(`[WebAppTool] Concurrent scrape complete: ${successCount}/${results.length} succeeded in ${duration}ms`);

            // Combine results for LLM
            const combinedContent = results
                .filter(r => !r.error && r.content?.length > 0)
                .map(r => `[${r.title}]\n${r.content?.substring(0, 3000) || ''}`)
                .join('\n\n---\n\n');

            return {
                type: 'web_app',
                content: `Scraped ${successCount}/${validUrls.length} pages concurrently in ${duration}ms. Content combined below.`,
                data: {
                    totalUrls: validUrls.length,
                    successCount,
                    duration,
                    combinedContent: combinedContent.substring(0, 15000),
                    results: results.map(r => ({
                        url: r.url,
                        title: r.title,
                        success: !r.error && r.content?.length > 0,
                        contentLength: r.content?.length || 0,
                        error: r.error
                    }))
                }
            };
        }

        // WRITE ACTIONS
        if (app.readOnlyDefault && !params.confirm) {
            return {
                type: 'error',
                content: `Write actions require confirm:true for ${app.name}.`,
                data: { error: 'Confirmation required' }
            };
        }

        if (params.action === 'post_text' || params.action === 'reply_text') {
            if (!params.text) {
                return { type: 'error', content: 'Text required for post/reply.', data: { error: 'Text required' } };
            }
            if (app.permissions?.post === false && params.action === 'post_text') {
                return { type: 'error', content: 'Posting not permitted.', data: { error: 'Post not permitted' } };
            }
            if (app.permissions?.reply === false && params.action === 'reply_text') {
                return { type: 'error', content: 'Replying not permitted.', data: { error: 'Reply not permitted' } };
            }

            const script = buildPostScript(params.text);
            const result = await HeadlessScraperService.scrapePage(targetUrl, 'content', {
                auth,
                script,
                waitForSelector: 'textarea, [contenteditable]'
            });

            return {
                type: 'web_app',
                content: result.result?.ok ? `Posted to ${hostname}.` : `Post failed: ${result.result?.error || 'Unknown error'}`,
                data: { url: result.url, result: result.result }
            };
        }

        return { type: 'error', content: `Unknown action: ${params.action}`, data: { error: 'Unknown action' } };
    }
}
