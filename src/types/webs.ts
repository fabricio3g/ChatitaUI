export type WebAuthType = 'api_token' | 'cookies' | 'oauth' | 'basic';

export interface WebAuthEntry {
    id: string;
    label: string;
    type: WebAuthType;
    secretKeyId: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
}

export interface WebAppCache {
    lastUrl?: string;
    lastTitle?: string;
    lastContentHash?: string;
    lastSummary?: string;
    sectionHashes?: Record<string, string>;
    updatedAt?: string;
}

export interface WebSelectorMemory {
    readSelectors?: string[];
    writeSelectors?: string[];
    byAction?: Record<string, string[]>;
}

export interface WebNavigationNode {
    id: string;
    label: string;
    urlPattern: string;
    next?: string[];
}

export interface WebNavigationMap {
    nodes: Record<string, WebNavigationNode>;
    lastNodeId?: string;
}

export interface WebAppPermissions {
    read: boolean;
    post: boolean;
    reply: boolean;
    follow: boolean;
    dm: boolean;
}

export interface WebAppRateLimits {
    maxPerHour?: number;
    maxPerDay?: number;
}

export interface WebApp {
    id: string;
    name: string;
    baseUrl: string;
    allowlistDomains: string[];
    authEntries: WebAuthEntry[];
    lastUsed?: string;
    readOnlyDefault: boolean;
    isEnabled?: boolean;
    permissions?: WebAppPermissions;
    rateLimits?: WebAppRateLimits;
    cache?: WebAppCache;
    selectors?: WebSelectorMemory;
    navigationMap?: WebNavigationMap;
}

