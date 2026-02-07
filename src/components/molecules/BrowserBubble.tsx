import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ActivityIndicator,
    Linking,
    Platform,
    Share,
    Animated,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface BrowserBubbleProps {
    url: string | null;
    onClose: () => void;
}

export const BrowserBubble: React.FC<BrowserBubbleProps> = ({ url, onClose }) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const webViewRef = useRef<WebView>(null);
    
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(url || '');
    const [title, setTitle] = useState('');
    
    const progressAnim = useRef(new Animated.Value(0)).current;

    const animateProgress = useCallback((toValue: number) => {
        Animated.timing(progressAnim, {
            toValue,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [progressAnim]);

    if (!url) return null;

    const handleExternalLink = () => {
        Linking.openURL(currentUrl || url);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                url: currentUrl || url,
                title: title || 'Shared Link',
            });
        } catch (error) {
            console.log('Share error:', error);
        }
    };

    const handleGoBack = () => {
        if (canGoBack) {
            webViewRef.current?.goBack();
        }
    };

    const handleGoForward = () => {
        if (canGoForward) {
            webViewRef.current?.goForward();
        }
    };

    const handleReload = () => {
        webViewRef.current?.reload();
    };

    const handleNavigationStateChange = (navState: WebViewNavigation) => {
        setCanGoBack(navState.canGoBack);
        setCanGoForward(navState.canGoForward);
        setCurrentUrl(navState.url);
        if (navState.title) {
            setTitle(navState.title);
        }
    };

    const getDisplayUrl = () => {
        const displayUrl = currentUrl || url;
        return displayUrl?.replace(/^https?:\/\//, '').replace(/^www\./, '') || '';
    };

    const isSecure = (currentUrl || url)?.startsWith('https://');

    const interpolatedProgress = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <Modal
            visible={!!url}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Header */}
                <BlurView 
                    intensity={Platform.OS === 'ios' ? 80 : 100} 
                    tint={theme.colors.text === '#FFFFFF' ? 'dark' : 'light'} 
                    style={[
                        styles.header, 
                        { 
                            paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8,
                            borderBottomColor: theme.colors.border,
                        }
                    ]}
                >
                    {/* Top Row: Close, URL, Actions */}
                    <View style={styles.headerTopRow}>
                        <Pressable 
                            onPress={onClose} 
                            style={[styles.iconButton, { backgroundColor: theme.colors.surfaceHighlight }]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="x" size={22} color={theme.colors.text} />
                        </Pressable>

                        <View style={[styles.urlContainer, { backgroundColor: theme.colors.surfaceHighlight }]}>
                            {isSecure && (
                                <Feather 
                                    name="lock" 
                                    size={12} 
                                    color={theme.colors.success} 
                                    style={styles.lockIcon} 
                                />
                            )}
                            <Text 
                                style={[styles.urlText, { color: theme.colors.textSecondary }]} 
                                numberOfLines={1}
                            >
                                {getDisplayUrl()}
                            </Text>
                        </View>

                        <View style={styles.headerActions}>
                            <Pressable 
                                onPress={handleShare} 
                                style={[styles.iconButtonSmall, { backgroundColor: theme.colors.surfaceHighlight }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="share-2" size={18} color={theme.colors.text} />
                            </Pressable>
                            <Pressable 
                                onPress={handleExternalLink} 
                                style={[styles.iconButtonSmall, { backgroundColor: theme.colors.surfaceHighlight }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="external-link" size={18} color={theme.colors.text} />
                            </Pressable>
                        </View>
                    </View>

                    {/* Bottom Row: Navigation Controls */}
                    <View style={styles.navigationRow}>
                        <Pressable 
                            onPress={handleGoBack} 
                            style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
                            disabled={!canGoBack}
                        >
                            <Feather 
                                name="arrow-left" 
                                size={20} 
                                color={canGoBack ? theme.colors.text : theme.colors.textTertiary} 
                            />
                        </Pressable>
                        <Pressable 
                            onPress={handleGoForward} 
                            style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
                            disabled={!canGoForward}
                        >
                            <Feather 
                                name="arrow-right" 
                                size={20} 
                                color={canGoForward ? theme.colors.text : theme.colors.textTertiary} 
                            />
                        </Pressable>
                        <Pressable 
                            onPress={handleReload} 
                            style={styles.navButton}
                        >
                            <Feather 
                                name="refresh-cw" 
                                size={18} 
                                color={theme.colors.text} 
                            />
                        </Pressable>
                    </View>

                    {/* Progress Bar */}
                    {loading && (
                        <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
                            <Animated.View 
                                style={[
                                    styles.progressBar, 
                                    { 
                                        backgroundColor: theme.colors.primary,
                                        width: interpolatedProgress,
                                    }
                                ]} 
                            />
                        </View>
                    )}
                </BlurView>

                {/* WebView */}
                <View style={[
                    styles.webviewContainer, 
                    { marginTop: Platform.OS === 'ios' ? 100 + insets.top : 108 + insets.top }
                ]}>
                    <WebView
                        ref={webViewRef}
                        source={{ uri: url }}
                        style={styles.webview}
                        onLoadStart={() => {
                            setLoading(true);
                            animateProgress(0.3);
                        }}
                        onLoadProgress={({ nativeEvent }) => {
                            animateProgress(nativeEvent.progress);
                        }}
                        onLoadEnd={() => {
                            setLoading(false);
                            animateProgress(1);
                        }}
                        onNavigationStateChange={handleNavigationStateChange}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background }]}>
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                            </View>
                        )}
                    />
                </View>

                {/* Loading Overlay */}
                {loading && (
                    <View style={[
                        styles.floatingLoader,
                        { 
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                        }
                    ]}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingBottom: 8,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 10,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconButtonSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 6,
    },
    urlContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    lockIcon: {
        marginRight: 6,
    },
    urlText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    navigationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        gap: 24,
    },
    navButton: {
        padding: 8,
        borderRadius: 8,
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    progressBarContainer: {
        height: 2,
        marginTop: 8,
        marginHorizontal: 16,
        borderRadius: 1,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 1,
    },
    webviewContainer: {
        flex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingLoader: {
        position: 'absolute',
        top: 120,
        alignSelf: 'center',
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
        zIndex: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
});

export default BrowserBubble;
