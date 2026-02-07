/**
 * Audio Decoder WebView Component
 * Hidden WebView that provides Web Audio API for decoding audio files
 * Required for Whisper STT transcription
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { getAudioDecoderHTML, setAudioDecoderWebView, handleAudioDecoderMessage } from '../utils/audioDecoder';

export const AudioDecoderWebView: React.FC = () => {
    const webViewRef = useRef<WebView>(null);
    
    useEffect(() => {
        if (webViewRef.current) {
            setAudioDecoderWebView(webViewRef.current);
        }
        
        return () => {
            setAudioDecoderWebView(null);
        };
    }, []);
    
    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: getAudioDecoderHTML() }}
                onMessage={handleAudioDecoderMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                mixedContentMode="always"
                style={styles.webview}
            />
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
