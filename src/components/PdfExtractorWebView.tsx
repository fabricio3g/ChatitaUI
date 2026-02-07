/**
 * PDF Extractor WebView Component
 * Hidden WebView that provides PDF.js for on-device text extraction
 */

import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getPdfExtractorHTML, setPdfExtractorWebView, handlePdfExtractorMessage } from '../utils/pdfExtractor';
import { Asset } from 'expo-asset';

export const PdfExtractorWebView: React.FC = () => {
    const webViewRef = useRef<WebView>(null);
    const [html, setHtml] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        if (webViewRef.current) {
            setPdfExtractorWebView(webViewRef.current);
        }
        (async () => {
            try {
                const pdfAsset = Asset.fromModule(require('../../assets/pdfjs/pdf.min.js'));
                const workerAsset = Asset.fromModule(require('../../assets/pdfjs/pdf.worker.min.js'));
                await pdfAsset.downloadAsync();
                await workerAsset.downloadAsync();
                if (!mounted) return;
                const pdfUri = pdfAsset.localUri || pdfAsset.uri;
                const workerUri = workerAsset.localUri || workerAsset.uri;
                setHtml(getPdfExtractorHTML(pdfUri, workerUri));
            } catch (e) {
                console.error('[PdfExtractorWebView] Failed to load PDF.js assets:', e);
                if (mounted) {
                    setHtml(getPdfExtractorHTML('', ''));
                }
            }
        })();
        return () => setPdfExtractorWebView(null);
    }, []);

    return (
        <View style={styles.container}>
            {html ? (
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html }}
                    onMessage={handlePdfExtractorMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowFileAccess={true}
                    allowUniversalAccessFromFileURLs={true}
                    mixedContentMode="always"
                    style={styles.webview}
                />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
    },
    webview: {
        width: 1,
        height: 1,
    },
});

export default PdfExtractorWebView;
