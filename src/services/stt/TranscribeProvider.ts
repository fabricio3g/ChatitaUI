import React, { createRef } from 'react';
import TranscribeWebView, { TranscribeWebViewRef } from '../../components/TranscribeWebView';

/**
 * TranscribeProvider - Uses Transcribe.js (whisper.cpp WASM) for speech recognition
 * Runs entirely offline in a WebView
 */
class TranscribeProviderClass {
  private webViewRef = createRef<TranscribeWebViewRef>();
  private isInitialized = false;
  private isReady = false;

  /**
   * Get the WebView component to render in your screen
   * This should be placed in your main screen component
   */
  getWebViewComponent(): React.ReactElement {
    return React.createElement(TranscribeWebView, {
      ref: this.webViewRef,
      onReady: () => {
        this.isReady = true;
        console.log('[TranscribeProvider] Ready');
      },
      onError: (error: string) => {
        console.error('[TranscribeProvider] Error:', error);
        this.isReady = false;
      },
      onTranscribing: () => {
        console.log('[TranscribeProvider] Transcribing...');
      }
    });
  }

  /**
   * Initialize the provider - waits for WebView to be ready
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    
    // Wait for WebView to be ready (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 300; // 30 seconds
    
    while (!this.isReady && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    
    if (!this.isReady) {
      throw new Error('Transcribe provider failed to initialize within 30 seconds');
    }
    
    console.log('[TranscribeProvider] Initialized successfully');
  }

  /**
   * Transcribe audio file to text
   * @param audioUri - URI to audio file (file://...)
   * @returns Transcribed text
   */
  async transcribe(audioUri: string): Promise<string> {
    if (!this.isReady) {
      await this.initialize();
    }

    if (!this.webViewRef.current) {
      throw new Error('WebView not mounted');
    }

    console.log('[TranscribeProvider] Transcribing:', audioUri);
    return this.webViewRef.current.transcribe(audioUri);
  }

  /**
   * Check if provider is ready
   */
  isProviderReady(): boolean {
    return this.isReady;
  }
}

// Singleton instance
export const TranscribeProvider = new TranscribeProviderClass();
