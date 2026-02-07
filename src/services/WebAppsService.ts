import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
    WebApp,
    WebAppCache,
    WebAuthEntry,
    WebAuthType,
    WebNavigationNode,
    WebSelectorMemory
} from '../types/webs';

const WEB_APPS_KEY = 'web_apps_v1';
const WEB_APPS_ACTIVE_KEY = 'web_apps_active_v1';
const SECRET_PREFIX = 'webapp_secret';

const nowIso = () => new Date().toISOString();

const sanitizeKeyPart = (value: string) =>
    value.replace(/[^a-zA-Z0-9._-]/g, '_');

const buildSecretKeyId = (appId: string, entryId: string) => {
    const safeApp = sanitizeKeyPart(appId);
    const safeEntry = sanitizeKeyPart(entryId);
    return `${SECRET_PREFIX}_${safeApp}_${safeEntry}`;
};

class WebAppsServiceClass {
    private async loadAll(): Promise<WebApp[]> {
        const stored = await AsyncStorage.getItem(WEB_APPS_KEY);
        if (!stored) return [];
        try {
            return JSON.parse(stored) as WebApp[];
        } catch {
            return [];
        }
    }

    private async saveAll(apps: WebApp[]) {
        await AsyncStorage.setItem(WEB_APPS_KEY, JSON.stringify(apps));
    }

    async listWebApps(): Promise<WebApp[]> {
        return this.loadAll();
    }

    async getWebApp(appId: string): Promise<WebApp | undefined> {
        const apps = await this.loadAll();
        return apps.find(app => app.id === appId);
    }

    async saveWebApp(app: WebApp): Promise<WebApp> {
        const apps = await this.loadAll();
        const index = apps.findIndex(item => item.id === app.id);
        if (index >= 0) {
            apps[index] = app;
        } else {
            apps.unshift(app);
        }
        await this.saveAll(apps);
        return app;
    }

    async deleteWebApp(appId: string) {
        const apps = await this.loadAll();
        const target = apps.find(app => app.id === appId);
        if (target) {
            await Promise.all(
                target.authEntries.map(entry =>
                    SecureStore.deleteItemAsync(entry.secretKeyId)
                )
            );
        }
        const updated = apps.filter(app => app.id !== appId);
        await this.saveAll(updated);
    }

    async setActiveWebAppId(appId: string | null) {
        if (!appId) {
            await AsyncStorage.removeItem(WEB_APPS_ACTIVE_KEY);
            return;
        }
        await AsyncStorage.setItem(WEB_APPS_ACTIVE_KEY, appId);
    }

    async getActiveWebAppId(): Promise<string | null> {
        return await AsyncStorage.getItem(WEB_APPS_ACTIVE_KEY);
    }

    async getActiveWebApp(): Promise<WebApp | undefined> {
        const id = await this.getActiveWebAppId();
        if (!id) return undefined;
        return this.getWebApp(id);
    }

    async addAuthEntry(
        appId: string,
        input: { label: string; type: WebAuthType; secret: any; notes?: string; entryId?: string }
    ): Promise<WebAuthEntry> {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');

        const entryId = input.entryId || `auth_${Date.now()}`;
        const secretKeyId = buildSecretKeyId(appId, entryId);

        await SecureStore.setItemAsync(secretKeyId, JSON.stringify(input.secret));

        const entry: WebAuthEntry = {
            id: entryId,
            label: input.label,
            type: input.type,
            secretKeyId,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            notes: input.notes
        };

        app.authEntries = [entry, ...app.authEntries];
        await this.saveWebApp(app);
        return entry;
    }

    async getAuthSecret(secretKeyId: string): Promise<any | null> {
        const stored = await SecureStore.getItemAsync(secretKeyId);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch {
            return stored;
        }
    }

    async updateAuthEntrySecret(appId: string, entryId: string, secret: any) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');

        const entry = app.authEntries.find(item => item.id === entryId);
        if (!entry) throw new Error('Auth entry not found');

        await SecureStore.setItemAsync(entry.secretKeyId, JSON.stringify(secret));
        entry.updatedAt = nowIso();
        await this.saveWebApp(app);
    }

    async upsertAuthEntry(
        appId: string,
        input: { id: string; label: string; type: WebAuthType; secret: any; notes?: string }
    ) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');

        const existing = app.authEntries.find(item => item.id === input.id);
        if (existing) {
            await SecureStore.setItemAsync(existing.secretKeyId, JSON.stringify(input.secret));
            existing.label = input.label;
            existing.type = input.type;
            existing.notes = input.notes;
            existing.updatedAt = nowIso();
            await this.saveWebApp(app);
            return existing;
        }

        return await this.addAuthEntry(appId, {
            label: input.label,
            type: input.type,
            secret: input.secret,
            notes: input.notes,
            entryId: input.id
        });
    }

    async removeAuthEntry(appId: string, entryId: string) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');

        const entry = app.authEntries.find(item => item.id === entryId);
        if (entry) {
            await SecureStore.deleteItemAsync(entry.secretKeyId);
        }
        app.authEntries = app.authEntries.filter(item => item.id !== entryId);
        await this.saveWebApp(app);
    }

    async updateCache(appId: string, cache: Partial<WebAppCache>) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');
        app.cache = { ...(app.cache || {}), ...cache, updatedAt: nowIso() };
        await this.saveWebApp(app);
    }

    async updateSelectorMemory(appId: string, updates: Partial<WebSelectorMemory>) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');
        app.selectors = { ...(app.selectors || {}), ...updates };
        await this.saveWebApp(app);
    }

    async addSelectorMemory(appId: string, selector: string, action: string = 'click') {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');
        const current = app.selectors || {};
        const byAction = current.byAction || {};
        const existing = new Set(byAction[action] || []);
        existing.add(selector);
        const nextList = Array.from(existing).slice(0, 30);
        byAction[action] = nextList;
        app.selectors = {
            ...current,
            byAction,
            readSelectors: Array.from(new Set([...(current.readSelectors || []), selector])).slice(0, 50)
        };
        await this.saveWebApp(app);
    }

    async upsertNavigationNode(appId: string, node: WebNavigationNode) {
        const app = await this.getWebApp(appId);
        if (!app) throw new Error('Web app not found');

        const existing = app.navigationMap || { nodes: {} };
        const previousId = existing.lastNodeId;

        if (previousId && previousId !== node.id) {
            const previous = existing.nodes[previousId];
            if (previous) {
                const next = new Set(previous.next || []);
                next.add(node.id);
                previous.next = Array.from(next);
                existing.nodes[previousId] = previous;
            }
        }
        existing.nodes[node.id] = node;
        existing.lastNodeId = node.id;
        app.navigationMap = existing;
        await this.saveWebApp(app);
    }

    async setLastUsed(appId: string) {
        const app = await this.getWebApp(appId);
        if (!app) return;
        app.lastUsed = nowIso();
        await this.saveWebApp(app);
    }
}

export const WebAppsService = new WebAppsServiceClass();

