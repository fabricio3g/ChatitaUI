import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { WebView } from 'react-native-webview';
import { View, StyleSheet } from 'react-native';

interface TranscribeWebViewProps {
  onReady?: () => void;
  onError?: (error: string) => void;
  onTranscribing?: () => void;
  onResult?: (text: string) => void;
}

export interface TranscribeWebViewRef {
  transcribe: (audioUri: string) => Promise<string>;
  isReady: () => boolean;
}

const TranscribeWebView = forwardRef<TranscribeWebViewRef, TranscribeWebViewProps>(
  ({ onReady, onError, onTranscribing, onResult }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const pendingPromises = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map());
    const isReadyRef = useRef(false);

    const getHTMLContent = () => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
        <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
        <style>
          body { margin: 0; background: transparent; }
        </style>
      </head>
      <body>
        <script type="module">
          import createModule from 'https://cdn.jsdelivr.net/npm/@transcribe/shout@latest/src/shout/shout.wasm.js';
          import { FileTranscriber } from 'https://cdn.jsdelivr.net/npm/@transcribe/transcriber@latest/src/index.js';

          let transcriber = null;
          let isReady = false;

          function sendToRN(type, data) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
          }

          async function initTranscriber() {
            try {
              const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin';
              
              transcriber = new FileTranscriber({
                createModule,
                model: modelUrl,
              });
              
              await transcriber.init();
              isReady = true;
              sendToRN('ready', { message: 'Ready' });
            } catch (error) {
              console.error('Init error:', error);
              sendToRN('error', { error: error.message });
            }
          }

          async function transcribe(audioUrl) {
            if (!isReady) {
              sendToRN('error', { error: 'Transcriber not initialized' });
              return;
            }
            
            try {
              sendToRN('transcribing', {});
              
              const result = await transcriber.transcribe(audioUrl);
              const text = result.transcription.map(t => t.text).join(' ').trim();
              
              sendToRN('result', { 
                text: text,
                language: result.result.language 
              });
            } catch (error) {
              console.error('Transcription error:', error);
              sendToRN('error', { error: error.message });
            }
          }

          document.addEventListener('message', async (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.action === 'transcribe') {
                await transcribe(data.audioUrl);
              }
            } catch (e) {
              console.error('Message handler error:', e);
              sendToRN('error', { error: 'Failed to process message' });
            }
          });

          initTranscriber();
        </script>
      </body>
      </html>
    `;

    const handleMessage = useCallback((event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        
        switch (data.type) {
          case 'ready':
            isReadyRef.current = true;
            console.log('[TranscribeWebView] Ready');
            onReady?.();
            break;
            
          case 'transcribing':
            onTranscribing?.();
            break;
            
          case 'result':
            onResult?.(data.text);
            const promise = pendingPromises.current.get('transcribe');
            if (promise) {
              promise.resolve(data.text);
              pendingPromises.current.delete('transcribe');
            }
            break;
            
          case 'error':
            console.error('[TranscribeWebView] Error:', data.error);
            const errorPromise = pendingPromises.current.get('transcribe');
            if (errorPromise) {
              errorPromise.reject(new Error(data.error));
              pendingPromises.current.delete('transcribe');
            }
            onError?.(data.error);
            break;
        }
      } catch (e) {
        console.error('[TranscribeWebView] Message parse error:', e);
      }
    }, [onReady, onError, onTranscribing, onResult]);

    useImperativeHandle(ref, () => ({
      transcribe: (audioUri: string) => {
        return new Promise((resolve, reject) => {
          pendingPromises.current.set('transcribe', { resolve, reject });
          
          webViewRef.current?.postMessage(JSON.stringify({
            action: 'transcribe',
            audioUrl: audioUri
          }));
          
          setTimeout(() => {
            if (pendingPromises.current.has('transcribe')) {
              pendingPromises.current.delete('transcribe');
              reject(new Error('Transcription timeout'));
            }
          }, 60000);
        });
      },
      
      isReady: () => isReadyRef.current,
    }));

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: getHTMLContent() }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          style={styles.webview}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -1000,
  },
  webview: {
    width: 1,
    height: 1,
  },
});

export default TranscribeWebView;
