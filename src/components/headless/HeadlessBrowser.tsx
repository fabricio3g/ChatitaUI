/**
 * Concurrent Headless Browser Component
 * Manages multiple WebView instances for parallel scraping
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { HeadlessScraperService, ScrapeRequest } from '../../services/HeadlessScraperService';

interface ActiveRequest {
    id: string;
    request: ScrapeRequest;
}

const MAX_WEBVIEWS = 3; // Match CONCURRENCY_LIMIT in service

export const HeadlessBrowser: React.FC = () => {
    const [activeRequests, setActiveRequests] = useState<ActiveRequest[]>([]);
    const activeRequestsRef = useRef<ActiveRequest[]>([]);
    const warnedCookieModuleRef = useRef<boolean>(false);

    // Keep ref in sync with state
    useEffect(() => {
        activeRequestsRef.current = activeRequests;
    }, [activeRequests]);

    useEffect(() => {
        // Register this component as the active browser
        HeadlessScraperService.registerBrowser((req) => {
            console.log(`[HeadlessBrowser] Received request: ${req.url} (id: ${req.id})`);

            setActiveRequests(prev => {
                // Don't add if already exists
                if (prev.some(r => r.id === req.id)) return prev;

                const next = [...prev, { id: req.id, request: req }];
                console.log(`[HeadlessBrowser] Active requests: ${next.length}/${MAX_WEBVIEWS}`);
                return next.slice(0, MAX_WEBVIEWS);
            });
        });

        return () => {
            HeadlessScraperService.unregisterBrowser();
            // Clear any active requests on unmount
            setActiveRequests([]);
        };
    }, []);

    const normalizeCookieString = (cookie: Record<string, any>) => {
        if (!cookie?.name || typeof cookie.value === 'undefined') return null;
        const parts = [`${cookie.name}=${cookie.value}`];
        if (cookie.domain) parts.push(`domain=${cookie.domain}`);
        if (cookie.path) parts.push(`path=${cookie.path}`);
        if (cookie.expires) parts.push(`expires=${cookie.expires}`);
        if (cookie.secure) parts.push('secure');
        if (cookie.httpOnly) parts.push('httponly');
        return parts.join('; ');
    };

    const normalizeAuth = (req: ScrapeRequest) => {
        const rawCookies = (req.auth as any)?.cookies ?? [];
        const cookieStrings: string[] = [];

        if (typeof rawCookies === 'string') {
            cookieStrings.push(rawCookies);
        } else if (Array.isArray(rawCookies)) {
            rawCookies.forEach(cookie => {
                if (typeof cookie === 'string') {
                    cookieStrings.push(cookie);
                } else if (cookie && typeof cookie === 'object') {
                    const normalized = normalizeCookieString(cookie);
                    if (normalized) cookieStrings.push(normalized);
                }
            });
        }

        const localStorage = typeof (req.auth as any)?.localStorage === 'object'
            ? (req.auth as any).localStorage
            : undefined;

        return { cookieStrings, localStorage };
    };

    const getAuthScript = (req: ScrapeRequest) => {
        const { cookieStrings, localStorage } = normalizeAuth(req);
        return `
        (function() {
            try {
                const cookies = ${JSON.stringify(cookieStrings)};
                cookies.forEach((cookie) => { document.cookie = cookie; });
                const localStorageData = ${JSON.stringify(localStorage || {})};
                Object.keys(localStorageData).forEach((key) => {
                    try { window.localStorage.setItem(key, localStorageData[key]); } catch (e) {}
                });
            } catch (e) {}
        })();
        true;
        `;
    };

    const getInjectedScript = (req: ScrapeRequest) => {
        const waitForSelector = req.waitForSelector
            ? `
            function waitForSelector(selector, cb) {
                const start = Date.now();
                const timer = setInterval(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        clearInterval(timer);
                        setTimeout(cb, 2000);
                    } else if (Date.now() - start > 12000) {
                        clearInterval(timer);
                        cb();
                    }
                }, 300);
            }
            `
            : '';

        const contentScript = `
        function getContent() {
            try {
                const title = document.title;
                let content = "";

                if ("${req.type}" === 'raw_html') {
                    content = document.documentElement.outerHTML;
                } else {
                    // Try to find main content first
                    let contentElement = document.querySelector('main') || 
                                        document.querySelector('article') || 
                                        document.querySelector('[class*="content"]') ||
                                        document.querySelector('[class*="article"]') ||
                                        document.body;
                    
                    // Clone to avoid modifying the actual page
                    const clone = contentElement.cloneNode(true);
                    
                    // Remove non-content elements
                    clone.querySelectorAll('script, style, noscript, nav, header, footer, aside, menu, iframe, svg, canvas').forEach(el => el.remove());
                    
                    // Remove ad and tracking elements
                    clone.querySelectorAll('[class*="ad"], [class*="advertisement"], [class*="banner"], [class*="popup"], [class*="modal"], [class*="cookie"], [class*="newsletter"], [id*="ad"], [id*="advertisement"], [id*="banner"], [id*="popup"], [id*="modal"]').forEach(el => el.remove());
                    
                    // Get text content
                    content = clone.innerText || clone.textContent || '';
                    
                    // Clean up the text
                    content = content
                        .replace(/\\s+/g, ' ')
                        .replace(/\\n\\s*\\n\\s*\\n/g, '\\n\\n')
                        .trim()
                        .substring(0, 15000);
                }

                const pageInfo = {
                    url: window.location.href,
                    title: title,
                    hasArticles: document.querySelectorAll('article').length,
                    hasMain: !!document.querySelector('main'),
                    hasFeed: !!document.querySelector('[role="feed"]'),
                    hasTimeline: !!document.querySelector('[aria-label*="Timeline"]'),
                    dataTestIds: Array.from(new Set(
                        Array.from(document.querySelectorAll('[data-testid]'))
                            .map(el => el.getAttribute('data-testid'))
                            .filter(Boolean)
                    )).slice(0, 20),
                    ariaLabels: Array.from(new Set(
                        Array.from(document.querySelectorAll('[aria-label]'))
                            .map(el => el.getAttribute('aria-label'))
                            .filter(Boolean)
                    )).slice(0, 15)
                };

                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'success',
                    data: {
                        url: window.location.href,
                        title: title,
                        content: content,
                        pageInfo: pageInfo
                    }
                }));
            } catch (err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    message: err.toString()
                }));
            }
        }
        `;

        const customScript = `
        (function() {
            const safePost = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            const runCustom = () => {
                try {
                    const result = (function() { ${req.script} })();
                    if (result && typeof result.then === 'function') {
                        result.then((data) => safePost({ type: 'success', data: { url: window.location.href, title: document.title, content: '', result: data } }))
                            .catch((err) => safePost({ type: 'error', message: err.toString() }));
                    } else {
                        safePost({ type: 'success', data: { url: window.location.href, title: document.title, content: '', result: result } });
                    }
                } catch (err) {
                    safePost({ type: 'error', message: err.toString() });
                }
            };

            ${req.waitForSelector
                ? `waitForSelector(${JSON.stringify(req.waitForSelector)}, runCustom);`
                : `if (document.readyState === 'complete') { setTimeout(runCustom, 1000); } else { window.addEventListener('load', () => setTimeout(runCustom, 1000)); }`}
        })();
        `;

        const payloadScript = req.script ? customScript : contentScript;
        const triggerScript = req.waitForSelector
            ? `waitForSelector(${JSON.stringify(req.waitForSelector)}, getContent);`
            : `if (document.readyState === 'complete') { setTimeout(getContent, 1000); } else { window.addEventListener('load', () => setTimeout(getContent, 1000)); }`;

        return `
        (function() {
            ${waitForSelector}
            ${payloadScript}
            ${req.script ? '' : triggerScript}
        })();
        true;
        `;
    };

    const applyCookies = async (req: ScrapeRequest) => {
        const { cookieStrings } = normalizeAuth(req);
        try {
            const { NativeModules } = require('react-native');
            const hasNativeCookieManager = !!(
                NativeModules?.RNCookieManager ||
                NativeModules?.RNCookieManagerIOS ||
                NativeModules?.RNCookieManagerAndroid
            );

            if (!hasNativeCookieManager) {
                if (!warnedCookieModuleRef.current) {
                    console.warn('[HeadlessBrowser] Native CookieManager not linked; skipping pre-load cookies');
                    warnedCookieModuleRef.current = true;
                }
            } else {
                const CookieManager = require('@react-native-cookies/cookies').default;
                const targetUrl = req.url;
                for (const cookie of cookieStrings) {
                    try {
                        await CookieManager.setFromResponse(targetUrl, cookie);
                    } catch {
                        // Ignore individual cookie failures
                    }
                }
                if (cookieStrings.length > 0) {
                    console.log('[HeadlessBrowser] Applied cookies for', req.url, ':', cookieStrings.length);
                }
            }
        } catch (e) {
            console.warn('[HeadlessBrowser] CookieManager unavailable or failed', e);
        }
    };

    const handleMessage = useCallback((requestId: string) => (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'success') {
                HeadlessScraperService.completeRequest(requestId, data.data);
            } else {
                HeadlessScraperService.failRequest(requestId, data.message || 'Unknown error');
            }
        } catch (e) {
            HeadlessScraperService.failRequest(requestId, 'Failed to parse WebView message');
        } finally {
            setActiveRequests(prev => prev.filter(r => r.id !== requestId));
        }
    }, []);

    const handleError = useCallback((requestId: string) => (e: any) => {
        HeadlessScraperService.failRequest(requestId, `WebView Error: ${e.nativeEvent.description}`);
        setActiveRequests(prev => prev.filter(r => r.id !== requestId));
    }, []);

    const handleLoadStart = useCallback((req: ScrapeRequest) => () => {
        applyCookies(req);
    }, []);

    return (
        <View style={styles.container}>
            {activeRequests.map(({ id, request }) => (
                <View key={id} style={styles.webviewWrapper}>
                    <WebView
                        source={{ uri: request.url }}
                        style={styles.webview}
                        onMessage={handleMessage(id)}
                        onLoadStart={handleLoadStart(request)}
                        injectedJavaScript={getInjectedScript(request)}
                        injectedJavaScriptBeforeContentLoaded={getAuthScript(request)}
                        onError={handleError(id)}
                        onHttpError={handleError(id)}
                        onRenderProcessGone={handleError(id)}
                        userAgent="Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        sharedCookiesEnabled={true}
                        thirdPartyCookiesEnabled={true}
                        cacheEnabled={false} // Disable caching to ensure fresh content
                        incognito={true} // Private mode to avoid persistent storage issues
                    />
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        zIndex: -999,
        pointerEvents: 'none'
    },
    webviewWrapper: {
        width: 1,
        height: 1,
        overflow: 'hidden'
    },
    webview: {
        width: 100,
        height: 100
    }
});
