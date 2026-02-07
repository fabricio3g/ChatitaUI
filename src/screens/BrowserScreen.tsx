/**
 * In-App Browser Screen
 * WebView-based browser for viewing sources without leaving the app
 */

import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Pressable,
    ActivityIndicator,
    Platform,
    Share,
    TextInput,
    Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { WebAppsService } from '../services/WebAppsService';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';

type BrowserRouteParams = {
    Browser: {
        url: string;
        title?: string;
        webAppId?: string;
    };
};

export const BrowserScreen: React.FC = () => {
    const route = useRoute<RouteProp<BrowserRouteParams, 'Browser'>>();
    const navigation = useNavigation();
    const webViewRef = useRef<WebView>(null);
    const { theme } = useTheme();

    const { url, title, webAppId } = route.params;

    const [isLoading, setIsLoading] = useState(true);
    const [currentUrl, setCurrentUrl] = useState(url);
    const [pageTitle, setPageTitle] = useState(title || '');
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [progress, setProgress] = useState(0);
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [assistantPrompt, setAssistantPrompt] = useState('');
    const [authScript, setAuthScript] = useState<string | undefined>(undefined);
    const [webAppName, setWebAppName] = useState<string | undefined>(undefined);
    const [webAppReadOnly, setWebAppReadOnly] = useState<boolean | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    useEffect(() => {
        const loadWebAppAuth = async () => {
            if (!webAppId) return;
            const app = await WebAppsService.getWebApp(webAppId);
            if (!app) return;
            setWebAppName(app.name);
            setWebAppReadOnly(app.readOnlyDefault);

            const cookieEntry = app.authEntries.find(entry => entry.type === 'cookies');
            if (!cookieEntry) return;
            const secret = await WebAppsService.getAuthSecret(cookieEntry.secretKeyId);
            const cookies = Array.isArray(secret)
                ? secret
                : typeof secret === 'string'
                    ? [secret]
                    : Array.isArray(secret?.cookies)
                        ? secret.cookies
                        : [];
            const localStorageData = typeof secret === 'object' && secret?.localStorage ? secret.localStorage : {};

            const script = `
            (function() {
                try {
                    const cookies = ${JSON.stringify(cookies)};
                    cookies.forEach((cookie) => { document.cookie = cookie; });
                    const localStorageData = ${JSON.stringify(localStorageData)};
                    Object.keys(localStorageData || {}).forEach((key) => {
                        try { window.localStorage.setItem(key, localStorageData[key]); } catch (e) {}
                    });
                } catch (e) {}
            })();
            true;
            `;
            setAuthScript(script);
        };
        loadWebAppAuth();
    }, [webAppId]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: currentUrl,
                title: pageTitle,
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };


    const handleCaptureSession = () => {
        if (!webAppId || !webViewRef.current) return;
        setIsCapturing(true);
        const script = `
        (function() {
            try {
                const cookies = document.cookie || '';
                const localStorageData = {};
                for (let i = 0; i < window.localStorage.length; i += 1) {
                    const key = window.localStorage.key(i);
                    if (key) localStorageData[key] = window.localStorage.getItem(key);
                }
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'auth_capture',
                    cookies,
                    localStorage: localStorageData
                }));
            } catch (e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'auth_capture_error',
                    error: e.toString()
                }));
            }
        })();
        true;
        `;
        webViewRef.current.injectJavaScript(script);
    };

    const captureNativeCookies = async () => {
        if (Constants.appOwnership === 'expo') {
            return;
        }
        try {
            const CookieManager = require('@react-native-cookies/cookies').default;
            const cookies = await CookieManager.get(currentUrl);
            const cookieList = Object.keys(cookies).map(key => {
                const cookie = cookies[key];
                const value = cookie?.value || '';
                return `${key}=${value}`;
            });

            await WebAppsService.upsertAuthEntry(webAppId!, {
                id: 'cookies_native',
                label: 'Native cookies',
                type: 'cookies',
                secret: {
                    cookies: cookieList,
                    localStorage: {}
                },
                notes: 'Captured via native cookie manager'
            });
        } catch (e) {
            console.warn('Failed to capture native cookies', e);
        }
    };

    const handleWebMessage = async (event: any) => {
        if (!webAppId) return;
        try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'auth_capture') {
                const cookieString = payload.cookies || '';
                const cookieList = cookieString
                    .split(';')
                    .map((c: string) => c.trim())
                    .filter(Boolean);

                await WebAppsService.addAuthEntry(webAppId, {
                    label: `Session ${new Date().toLocaleString()}`,
                    type: 'cookies',
                    secret: {
                        cookies: cookieList,
                        localStorage: payload.localStorage || {}
                    },
                    notes: 'Captured from WebView session'
                });

                await captureNativeCookies();

                Alert.alert('Session saved', 'Auth session captured and stored securely.');
            }
            if (payload.type === 'auth_capture_error') {
                Alert.alert('Capture failed', payload.error || 'Unable to capture session.');
            }
            if (payload.type === 'selector_event' && payload.selector) {
                await WebAppsService.addSelectorMemory(webAppId, payload.selector, payload.action || 'click');
            }
        } catch (e) {
            console.warn('Failed to handle WebView message', e);
        } finally {
            setIsCapturing(false);
        }
    };

    const ToolbarContainer = ({ children }: { children: React.ReactNode }) => (
        Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint="dark" style={[styles.toolbar, { borderTopColor: theme.colors.border }]}>
                {children}
            </BlurView>
        ) : (
            <View style={[styles.toolbar, styles.toolbarAndroid, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                {children}
            </View>
        )
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
                <Pressable
                    style={styles.headerButton}
                    onPress={() => navigation.goBack()}
                >
                    <Feather name="x" size={24} color="#FFF" />
                </Pressable>

                <View style={[styles.urlContainer, { backgroundColor: theme.colors.surfaceHighlight }]}>
                    <Feather name="lock" size={12} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={[styles.urlText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {new URL(currentUrl).hostname.replace('www.', '')}
                    </Text>
                    {webAppReadOnly !== null && (
                        <View style={[styles.modeBadge, webAppReadOnly ? styles.modeBadgeRead : styles.modeBadgeWrite]}>
                            <Text style={styles.modeBadgeText}>{webAppReadOnly ? 'Read-only' : 'Write'}</Text>
                        </View>
                    )}
                </View>

                {webAppId && (
                    <Pressable
                        style={styles.headerButton}
                        onPress={handleCaptureSession}
                        disabled={isCapturing}
                    >
                        <Feather name="key" size={20} color={isCapturing ? '#52525B' : '#FFF'} />
                    </Pressable>
                )}

                <Pressable style={styles.headerButton} onPress={handleShare}>
                    <Feather name="share" size={20} color="#FFF" />
                </Pressable>
            </View>

            {/* Progress Bar */}
            {isLoading && (
                <View style={[styles.progressContainer, { backgroundColor: theme.colors.border }]}>
                    <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: theme.colors.success }]} />
                </View>
            )}

            {/* WebView */}
            <WebView
                ref={webViewRef}
                source={{ uri: url }}
                style={styles.webview}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
                onNavigationStateChange={(navState) => {
                    setCurrentUrl(navState.url);
                    setPageTitle(navState.title || '');
                    setCanGoBack(navState.canGoBack);
                    setCanGoForward(navState.canGoForward);
                }}
                onMessage={handleWebMessage}
                injectedJavaScriptBeforeContentLoaded={authScript}
                injectedJavaScript={`
                    (function() {
                        function getSelector(el) {
                            if (!el) return '';
                            if (el.id) return '#' + el.id;
                            const parts = [];
                            while (el && el.nodeType === 1 && parts.length < 4) {
                                let part = el.tagName.toLowerCase();
                                if (el.className) {
                                    const cls = el.className.toString().split(' ').filter(Boolean).slice(0, 2);
                                    if (cls.length) part += '.' + cls.join('.');
                                }
                                parts.unshift(part);
                                el = el.parentElement;
                            }
                            return parts.join(' > ');
                        }
                        document.addEventListener('click', function(evt) {
                            const selector = getSelector(evt.target);
                            if (!selector) return;
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'selector_event',
                                action: 'click',
                                selector: selector
                            }));
                        }, true);
                    })();
                    true;
                `}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#10B981" />
                    </View>
                )}
            />

            {webAppId && (
                <Pressable style={styles.assistantDot} onPress={() => setAssistantOpen(prev => !prev)}>
                    <View style={styles.assistantDotInner} />
                </Pressable>
            )}

            {assistantOpen && (
                <View style={styles.assistantPanel}>
                    <View style={styles.assistantHeader}>
                        <Text style={styles.assistantTitle}>Web Assistant</Text>
                        <Text style={styles.assistantSubtitle}>{webAppName || 'Active site'}</Text>
                    </View>
                    <TextInput
                        style={styles.assistantInput}
                        placeholder="Ask about this page or request an action..."
                        placeholderTextColor="#6B7280"
                        value={assistantPrompt}
                        onChangeText={setAssistantPrompt}
                        multiline
                    />
                    <View style={styles.assistantActions}>
                        <Pressable
                            style={styles.assistantBtnGhost}
                            onPress={() => setAssistantOpen(false)}
                        >
                            <Text style={styles.assistantBtnGhostText}>Close</Text>
                        </Pressable>
                        <Pressable
                            style={styles.assistantBtn}
                            onPress={async () => {
                                if (!assistantPrompt.trim()) return;
                                if (webAppId) {
                                    await WebAppsService.setActiveWebAppId(webAppId);
                                }
                                (navigation as any).navigate('MainTabs', {
                                    screen: 'Chat',
                                    params: { initialPrompt: assistantPrompt.trim(), webAppId }
                                });
                                setAssistantPrompt('');
                                setAssistantOpen(false);
                            }}
                        >
                            <Text style={styles.assistantBtnText}>Send to Chat</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Bottom Toolbar */}
            <ToolbarContainer>
                <Pressable
                    style={[styles.toolbarButton, !canGoBack && styles.toolbarButtonDisabled]}
                    onPress={() => webViewRef.current?.goBack()}
                    disabled={!canGoBack}
                >
                    <Feather name="chevron-left" size={24} color={canGoBack ? theme.colors.text : theme.colors.textSecondary} />
                </Pressable>

                <Pressable
                    style={[styles.toolbarButton, !canGoForward && styles.toolbarButtonDisabled]}
                    onPress={() => webViewRef.current?.goForward()}
                    disabled={!canGoForward}
                >
                    <Feather name="chevron-right" size={24} color={canGoForward ? theme.colors.text : theme.colors.textSecondary} />
                </Pressable>

                <View style={{ flex: 1 }} />

                <Pressable
                    style={styles.toolbarButton}
                    onPress={() => webViewRef.current?.reload()}
                >
                    <Feather name="refresh-cw" size={20} color={theme.colors.text} />
                </Pressable>

                <Pressable
                    style={styles.toolbarButton}
                    onPress={() => {
                        // Open in external browser
                        const { Linking } = require('react-native');
                        Linking.openURL(currentUrl);
                    }}
                >
                    <Feather name="external-link" size={20} color={theme.colors.text} />
                </Pressable>
            </ToolbarContainer>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 10,
        paddingBottom: 10,
        paddingHorizontal: 8,
        backgroundColor: '#09090B',
        borderBottomWidth: 1,
        borderBottomColor: '#27272A',
    },
    headerButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    urlContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#18181B',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 8,
    },
    urlText: {
        color: '#A1A1AA',
        fontSize: 14,
        fontWeight: '500',
    },
    modeBadge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        borderWidth: 1,
    },
    modeBadgeRead: {
        borderColor: 'rgba(59, 130, 246, 0.4)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)'
    },
    modeBadgeWrite: {
        borderColor: 'rgba(16, 185, 129, 0.4)',
        backgroundColor: 'rgba(16, 185, 129, 0.2)'
    },
    modeBadgeText: {
        color: '#E5E7EB',
        fontSize: 10,
        fontWeight: '600'
    },
    progressContainer: {
        height: 2,
        backgroundColor: '#27272A',
    },
    progressBar: {
        height: 2,
        backgroundColor: '#10B981',
    },
    webview: {
        flex: 1,
        backgroundColor: '#09090B',
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#09090B',
    },
    assistantDot: {
        position: 'absolute',
        right: 18,
        bottom: 92,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    assistantDotInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#10B981',
    },
    assistantPanel: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 92,
        backgroundColor: '#0F1115',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 14,
        gap: 10
    },
    assistantHeader: {
        gap: 2
    },
    assistantTitle: {
        color: '#F3F4F6',
        fontWeight: '600'
    },
    assistantSubtitle: {
        color: '#9CA3AF',
        fontSize: 12
    },
    assistantInput: {
        minHeight: 70,
        maxHeight: 140,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#F3F4F6',
        textAlignVertical: 'top'
    },
    assistantActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10
    },
    assistantBtn: {
        backgroundColor: '#10B981',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10
    },
    assistantBtnText: {
        color: '#0B0B0F',
        fontWeight: '600',
        fontSize: 12
    },
    assistantBtnGhost: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)'
    },
    assistantBtnGhostText: {
        color: '#E5E7EB',
        fontWeight: '600',
        fontSize: 12
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 10,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#27272A',
    },
    toolbarAndroid: {
        backgroundColor: '#09090B',
    },
    toolbarButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbarButtonDisabled: {
        opacity: 0.5,
    },
});
