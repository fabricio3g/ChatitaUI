/**
 * Concurrent Headless Scraper Service
 * Supports multiple simultaneous scrape requests with a connection pool
 */

export interface ScrapeResult {
    url: string;
    title: string;
    content: string;
    html?: string;
    result?: any;
    error?: string;
    pageInfo?: {
        hasArticles?: number;
        hasMain?: boolean;
        hasFeed?: boolean;
        hasTimeline?: boolean;
        dataTestIds?: string[];
        ariaLabels?: string[];
    };
    debug?: {
        articleCount?: number;
        tweetTextCount?: number;
        mainExists?: boolean;
        timelineExists?: boolean;
        primaryColExists?: boolean;
        bodyTextLength?: number;
    };
}

export interface ScrapeRequest {
    id: string;
    url: string;
    type: 'content' | 'raw_html';
    waitForSelector?: string;
    script?: string;
    priority?: number; // Higher = process first
    auth?: {
        cookies?: string[];
        localStorage?: Record<string, string>;
    };
}

interface PendingRequest {
    request: ScrapeRequest;
    resolve: (val: ScrapeResult) => void;
    reject: (err: any) => void;
    timeout: NodeJS.Timeout;
}

const CONCURRENCY_LIMIT = 3; // Max 3 concurrent WebViews
const REQUEST_TIMEOUT = 30000; // 30s timeout per request

class HeadlessScraperServiceClass {
    private requestListener: ((req: ScrapeRequest) => void) | null = null;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private activeRequests: Map<string, PendingRequest> = new Map();
    private requestQueue: ScrapeRequest[] = [];
    private completedRequests: Map<string, ScrapeResult> = new Map(); // Cache recent results
    private maxCacheSize = 10;

    /**
     * Called by the HeadlessBrowser component to register itself.
     */
    registerBrowser(listener: (req: ScrapeRequest) => void) {
        this.requestListener = listener;
        console.log('[HeadlessScraper] Browser registered, concurrency limit:', CONCURRENCY_LIMIT);
    }

    /**
     * Unregister browser
     */
    unregisterBrowser() {
        this.requestListener = null;
    }

    /**
     * Scrape multiple URLs concurrently
     * Returns results in the same order as URLs
     */
    async scrapeMultiple(
        urls: string[],
        type: 'content' | 'raw_html' = 'content',
        options?: {
            waitForSelector?: string;
            auth?: ScrapeRequest['auth'];
            script?: string;
            priority?: number;
        }
    ): Promise<ScrapeResult[]> {
        console.log(`[HeadlessScraper] Starting concurrent scrape of ${urls.length} URLs`);
        const startTime = Date.now();

        // Start all scrapes concurrently
        const promises = urls.map((url, index) =>
            this.scrapePage(url, type, {
                ...options,
                priority: (options?.priority || 0) + (urls.length - index) // Higher priority for earlier URLs
            })
        );

        const results = await Promise.allSettled(promises);

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[HeadlessScraper] Concurrent scrape complete: ${successCount}/${urls.length} succeeded in ${duration}ms`);

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                url: urls[index],
                title: 'Error',
                content: '',
                error: result.reason?.message || 'Request failed'
            };
        });
    }

    /**
     * Queues a URL to be scraped by the Headless Browser.
     * Supports concurrent processing up to CONCURRENCY_LIMIT
     */
    async scrapePage(
        url: string,
        type: 'content' | 'raw_html' = 'content',
        options?: {
            waitForSelector?: string;
            auth?: ScrapeRequest['auth'];
            script?: string;
            priority?: number;
        }
    ): Promise<ScrapeResult> {
        if (!this.requestListener) {
            console.warn('[HeadlessScraper] No browser registered! Failing request.');
            throw new Error('Headless Browser not initialized');
        }

        // Check cache for recent identical requests
        const cacheKey = `${url}-${type}-${options?.script || ''}`;
        const cached = this.completedRequests.get(cacheKey);
        if (cached && !cached.error) {
            console.log('[HeadlessScraper] Cache hit for:', url);
            return cached;
        }

        const id = Math.random().toString(36).substring(7);
        const request: ScrapeRequest = {
            id,
            url,
            type,
            waitForSelector: options?.waitForSelector,
            auth: options?.auth,
            script: options?.script,
            priority: options?.priority || 0
        };

        return new Promise<ScrapeResult>((resolve, reject) => {
            // Set timeout
            const timeout = setTimeout(() => {
                this.cleanupRequest(id);
                reject(new Error('Scrape timeout (30s)'));
            }, REQUEST_TIMEOUT);

            const pending: PendingRequest = { request, resolve, reject, timeout };

            // If under concurrency limit, start immediately
            if (this.activeRequests.size < CONCURRENCY_LIMIT) {
                this.startRequest(pending);
            } else {
                // Queue for later
                this.insertIntoQueue(request);
                this.pendingRequests.set(id, pending);
                console.log(`[HeadlessScraper] Request ${id} queued. Active: ${this.activeRequests.size}, Queue: ${this.requestQueue.length}`);
            }
        });
    }

    /**
     * Insert request into queue sorted by priority
     */
    private insertIntoQueue(request: ScrapeRequest) {
        const index = this.requestQueue.findIndex(r => (r.priority || 0) < (request.priority || 0));
        if (index === -1) {
            this.requestQueue.push(request);
        } else {
            this.requestQueue.splice(index, 0, request);
        }
    }

    /**
     * Start processing a request
     */
    private startRequest(pending: PendingRequest) {
        const { request } = pending;
        this.pendingRequests.delete(request.id);
        this.activeRequests.set(request.id, pending);

        console.log(`[HeadlessScraper] Starting request ${request.id} (${this.activeRequests.size}/${CONCURRENCY_LIMIT} active)`);

        // Trigger browser
        this.requestListener?.(request);
    }

    /**
     * Process next request from queue if there's capacity
     */
    private processQueue() {
        while (this.activeRequests.size < CONCURRENCY_LIMIT && this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift()!;
            const pending = this.pendingRequests.get(nextRequest.id);
            if (pending) {
                this.startRequest(pending);
            }
        }
    }

    /**
     * Clean up request state
     */
    private cleanupRequest(id: string) {
        const pending = this.pendingRequests.get(id) || this.activeRequests.get(id);
        if (pending) {
            clearTimeout(pending.timeout);
        }
        this.pendingRequests.delete(id);
        this.activeRequests.delete(id);
        this.processQueue();
    }

    /**
     * Called by the HeadlessBrowser component when it finishes a job.
     */
    completeRequest(id: string, result: ScrapeResult) {
        const pending = this.activeRequests.get(id);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(result);

            // Cache successful results BEFORE cleanup (cleanup may process queue)
            const { request } = pending;
            const cacheKey = `${request.url}-${request.type}-${request.script || ''}`;
            if (!result.error && this.completedRequests.size < this.maxCacheSize) {
                this.completedRequests.set(cacheKey, result);
            }

            this.cleanupRequest(id);
            console.log(`[HeadlessScraper] Request ${id} completed. Active: ${this.activeRequests.size}`);
        }
    }

    /**
     * Called by the HeadlessBrowser component when a job fails.
     */
    failRequest(id: string, error: string) {
        const pending = this.activeRequests.get(id);
        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(error));
            this.cleanupRequest(id);
            console.log(`[HeadlessScraper] Request ${id} failed: ${error}`);
        }
    }

    /**
     * Get current status for debugging
     */
    getStatus() {
        return {
            active: this.activeRequests.size,
            queued: this.requestQueue.length,
            maxConcurrent: CONCURRENCY_LIMIT
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.completedRequests.clear();
    }
}

export const HeadlessScraperService = new HeadlessScraperServiceClass();
