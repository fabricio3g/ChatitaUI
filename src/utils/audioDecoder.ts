/**
 * Audio Decoder Utility
 * Converts audio files to Float32Array waveform at 16kHz for Whisper STT
 * Uses Web Audio API via a hidden WebView for cross-platform compatibility
 */

import * as FileSystem from 'expo-file-system/legacy';

// Audio decoder HTML page that runs in WebView
const AUDIO_DECODER_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audio Decoder</title>
    <style>
        body { margin: 0; padding: 10px; font-family: monospace; font-size: 12px; }
        #status { color: #666; }
        #error { color: red; }
    </style>
</head>
<body>
    <div id="status">Ready</div>
    <div id="error"></div>
    <script>
        const TARGET_SAMPLE_RATE = 16000;
        
        async function decodeAudioFromUri(audioUri) {
            try {
                document.getElementById('status').textContent = 'Fetching audio...';
                
                // Fetch the audio file
                const response = await fetch(audioUri);
                if (!response.ok) {
                    throw new Error('Failed to fetch audio: ' + response.status);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                document.getElementById('status').textContent = 'Decoding audio...';
                
                // Create audio context
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Decode audio
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                document.getElementById('status').textContent = 'Resampling to 16kHz...';
                
                // Get audio data from first channel
                const audioData = audioBuffer.getChannelData(0);
                const originalSampleRate = audioBuffer.sampleRate;
                
                // Resample to 16kHz if needed
                let resampledData;
                if (originalSampleRate === TARGET_SAMPLE_RATE) {
                    resampledData = audioData;
                } else {
                    const ratio = TARGET_SAMPLE_RATE / originalSampleRate;
                    const newLength = Math.round(audioData.length * ratio);
                    resampledData = new Float32Array(newLength);
                    
                    // Simple linear interpolation
                    for (let i = 0; i < newLength; i++) {
                        const position = i / ratio;
                        const index = Math.floor(position);
                        const fraction = position - index;
                        
                        if (index >= audioData.length - 1) {
                            resampledData[i] = audioData[audioData.length - 1];
                        } else {
                            resampledData[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
                        }
                    }
                }
                
                document.getElementById('status').textContent = 'Encoding result...';
                
                // Convert to base64 for transfer
                const base64Data = arrayBufferToBase64(resampledData.buffer);
                
                document.getElementById('status').textContent = 'Done!';
                
                // Send result back to React Native
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'success',
                    data: base64Data,
                    sampleRate: TARGET_SAMPLE_RATE,
                    length: resampledData.length
                }));
                
            } catch (error) {
                document.getElementById('error').textContent = 'Error: ' + error.message;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    error: error.message
                }));
            }
        }

        function base64ToArrayBuffer(base64) {
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        async function decodeAudioFromBase64(base64) {
            try {
                document.getElementById('status').textContent = 'Decoding audio...';
                const arrayBuffer = base64ToArrayBuffer(base64);

                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                document.getElementById('status').textContent = 'Resampling to 16kHz...';

                const audioData = audioBuffer.getChannelData(0);
                const originalSampleRate = audioBuffer.sampleRate;

                let resampledData;
                if (originalSampleRate === TARGET_SAMPLE_RATE) {
                    resampledData = audioData;
                } else {
                    const ratio = TARGET_SAMPLE_RATE / originalSampleRate;
                    const newLength = Math.round(audioData.length * ratio);
                    resampledData = new Float32Array(newLength);

                    for (let i = 0; i < newLength; i++) {
                        const position = i / ratio;
                        const index = Math.floor(position);
                        const fraction = position - index;

                        if (index >= audioData.length - 1) {
                            resampledData[i] = audioData[audioData.length - 1];
                        } else {
                            resampledData[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
                        }
                    }
                }

                document.getElementById('status').textContent = 'Encoding result...';

                const base64Data = arrayBufferToBase64(resampledData.buffer);

                document.getElementById('status').textContent = 'Done!';

                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'success',
                    data: base64Data,
                    sampleRate: TARGET_SAMPLE_RATE,
                    length: resampledData.length
                }));
            } catch (error) {
                document.getElementById('error').textContent = 'Error: ' + error.message;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    error: error.message
                }));
            }
        }
        
        function arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
        
        // Listen for decode requests
        document.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'decode') {
                decodeAudioFromUri(data.audioUri);
            } else if (data.type === 'decode_base64') {
                decodeAudioFromBase64(data.base64);
            }
        });
        
        // Also support window.postMessage for iOS
        window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'decode') {
                decodeAudioFromUri(data.audioUri);
            } else if (data.type === 'decode_base64') {
                decodeAudioFromBase64(data.base64);
            }
        });
    </script>
</body>
</html>
`;

// Singleton WebView reference
let decoderWebView: any = null;
let pendingResolve: ((value: Float32Array) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

/**
 * Set the WebView reference for audio decoding
 * Call this from your component that renders the WebView
 */
export function setAudioDecoderWebView(webView: any): void {
    decoderWebView = webView;
}

/**
 * Handle messages from the decoder WebView
 * Call this from your WebView's onMessage handler
 */
export function handleAudioDecoderMessage(event: any): void {
    try {
        const data = JSON.parse(event.nativeEvent.data);
        
        if (data.type === 'success') {
            // Decode base64 back to Float32Array
            const binaryString = atob(data.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const floatArray = new Float32Array(bytes.buffer);
            
            pendingResolve?.(floatArray);
        } else if (data.type === 'error') {
            pendingReject?.(new Error(data.error));
        }
    } catch (e) {
        pendingReject?.(new Error('Failed to parse decoder response'));
    } finally {
        pendingResolve = null;
        pendingReject = null;
    }
}

/**
 * Get the HTML content for the audio decoder WebView
 */
export function getAudioDecoderHTML(): string {
    return AUDIO_DECODER_HTML;
}

/**
 * Decode an audio file to Float32Array at 16kHz
 * Requires AudioDecoderWebView to be mounted in your component tree
 */
export async function decodeAudioFile(audioUri: string): Promise<Float32Array> {
    if (!decoderWebView) {
        throw new Error('Audio decoder WebView not initialized. Make sure AudioDecoderWebView is mounted.');
    }
    
    return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;
        
        (async () => {
            try {
                // Prefer base64 to avoid WebView file:// fetch issues
                const fileInfo = await FileSystem.getInfoAsync(audioUri);
                if (!fileInfo.exists) {
                    throw new Error('Audio file not found');
                }
                const base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
                const message = JSON.stringify({
                    type: 'decode_base64',
                    base64
                });
                decoderWebView.postMessage(message);
            } catch (e: any) {
                // Fallback to URI-based fetch if base64 fails
                const message = JSON.stringify({
                    type: 'decode',
                    audioUri
                });
                decoderWebView.postMessage(message);
            }
        })();
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (pendingReject) {
                pendingReject(new Error('Audio decoding timeout'));
                pendingResolve = null;
                pendingReject = null;
            }
        }, 30000);
    });
}

/**
 * Alternative: Decode using native module if available
 * Falls back to WebView method
 */
export async function decodeAudioFileNative(audioUri: string): Promise<Float32Array> {
    // For now, always use WebView method
    // In the future, could implement native module for better performance
    return decodeAudioFile(audioUri);
}
