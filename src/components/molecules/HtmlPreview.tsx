/**
 * HtmlPreview - Renders HTML as a previewable website
 * Shows code block by default, with preview button to render in WebView
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';

interface HtmlPreviewProps {
    html: string;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html }) => {
    const { theme } = useTheme();
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const webViewRef = useRef<WebView>(null);

    const handleCopy = async () => {
        await Clipboard.setStringAsync(html);
    };

    const handlePreviewPress = () => {
        setShowPreview(true);
        setIsLoading(true);
    };

    const handleClosePreview = () => {
        setShowPreview(false);
    };

    const handleLoadEnd = () => {
        setIsLoading(false);
    };

    const handleNavigationStateChange = (navState: WebViewNavigation) => {
        setCanGoBack(navState.canGoBack);
        setCanGoForward(navState.canGoForward);
    };

    const handleGoBack = () => {
        webViewRef.current?.goBack();
    };

    const handleGoForward = () => {
        webViewRef.current?.goForward();
    };

    const handleReload = () => {
        webViewRef.current?.reload();
    };

    const handleOpenInBrowser = () => {
        Alert.alert(
            'Open in Browser',
            'This will open the content in your default browser. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open',
                    onPress: () => {
                        // Create a data URL and open it
                        const blob = new Blob([html], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        Linking.openURL(url).catch(() => {
                            Alert.alert('Error', 'Could not open browser');
                        });
                    },
                },
            ]
        );
    };

    // Prepare HTML content (ensure it's a complete document)
    const prepareHtml = (content: string): string => {
        const trimmed = content.trim();
        
        // If already a complete document, return as-is
        if (trimmed.toLowerCase().includes('<!doctype html') || 
            trimmed.toLowerCase().includes('<html')) {
            return trimmed;
        }
        
        // Wrap in a complete HTML document
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Preview</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    ${trimmed}
</body>
</html>`;
    };

    const htmlContent = prepareHtml(html);

    return (
        <>
            {/* Code Block Header with Preview Button */}
            <View style={[
                styles.container,
                { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border }
            ]}>
                <View style={[
                    styles.header,
                    { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }
                ]}>
                    <Text style={[styles.languageText, { color: theme.colors.textSecondary }]}>
                        HTML
                    </Text>
                    <View style={styles.headerActions}>
                        <Pressable onPress={handlePreviewPress} style={styles.actionButton}>
                            <Feather name="eye" size={14} color={theme.colors.primary} />
                            <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                                Preview
                            </Text>
                        </Pressable>
                        <View style={styles.divider} />
                        <Pressable onPress={handleCopy} style={styles.actionButton}>
                            <Feather name="copy" size={14} color={theme.colors.textSecondary} />
                            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
                                Copy
                            </Text>
                        </Pressable>
                    </View>
                </View>
                
                {/* Code Preview (first few lines) */}
                <View style={styles.codePreview}>
                    <Text 
                        style={[styles.codeText, { color: theme.colors.text }]} 
                        numberOfLines={8}
                        ellipsizeMode="tail"
                    >
                        {html.trim()}
                    </Text>
                </View>
            </View>

            {/* Full Screen Preview Modal */}
            <Modal
                visible={showPreview}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleClosePreview}
            >
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
                    {/* Modal Header */}
                    <View style={[
                        styles.modalHeader,
                        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }
                    ]}>
                        <Pressable onPress={handleClosePreview} style={styles.closeButton}>
                            <Feather name="x" size={24} color={theme.colors.text} />
                        </Pressable>
                        
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                            HTML Preview
                        </Text>
                        
                        <Pressable onPress={handleOpenInBrowser} style={styles.browserButton}>
                            <Feather name="external-link" size={20} color={theme.colors.primary} />
                        </Pressable>
                    </View>

                    {/* Navigation Bar */}
                    <View style={[
                        styles.navBar,
                        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }
                    ]}>
                        <Pressable 
                            onPress={handleGoBack} 
                            disabled={!canGoBack}
                            style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
                        >
                            <Feather 
                                name="arrow-left" 
                                size={20} 
                                color={canGoBack ? theme.colors.text : theme.colors.border} 
                            />
                        </Pressable>
                        <Pressable 
                            onPress={handleGoForward} 
                            disabled={!canGoForward}
                            style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
                        >
                            <Feather 
                                name="arrow-right" 
                                size={20} 
                                color={canGoForward ? theme.colors.text : theme.colors.border} 
                            />
                        </Pressable>
                        <Pressable onPress={handleReload} style={styles.navButton}>
                            <Feather name="refresh-cw" size={18} color={theme.colors.text} />
                        </Pressable>
                    </View>

                    {/* WebView */}
                    <View style={styles.webviewContainer}>
                        {isLoading && (
                            <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.background }]}>
                                <ActivityIndicator size="large" color={theme.colors.primary} />
                                <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                                    Loading preview...
                                </Text>
                            </View>
                        )}
                        <WebView
                            ref={webViewRef}
                            source={{ html: htmlContent }}
                            style={styles.webview}
                            onLoadEnd={handleLoadEnd}
                            onNavigationStateChange={handleNavigationStateChange}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            cacheEnabled={true}
                            allowsFullscreenVideo={false}
                            allowsInlineMediaPlayback={true}
                            mediaPlaybackRequiresUserAction={true}
                            originWhitelist={['*']}
                            // Security settings
                            allowFileAccess={false}
                            allowUniversalAccessFromFileURLs={false}
                            // Performance
                            androidLayerType="hardware"
                        />
                    </View>

                    {/* Security Warning Footer */}
                    <View style={[
                        styles.securityFooter,
                        { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }
                    ]}>
                        <Feather name="shield" size={14} color={theme.colors.textSecondary} />
                        <Text style={[styles.securityText, { color: theme.colors.textSecondary }]}>
                            Running in sandboxed preview
                        </Text>
                    </View>
                </SafeAreaView>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(128, 128, 128, 0.3)',
    },
    languageText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    codePreview: {
        padding: 12,
        maxHeight: 200,
    },
    codeText: {
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 20,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    closeButton: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    browserButton: {
        padding: 4,
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        gap: 4,
    },
    navButton: {
        padding: 8,
        borderRadius: 8,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    webviewContainer: {
        flex: 1,
        position: 'relative',
    },
    webview: {
        flex: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    securityFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    securityText: {
        fontSize: 12,
    },
});

export default HtmlPreview;
