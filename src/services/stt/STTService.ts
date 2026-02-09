import { Audio } from 'expo-av';
import { SystemSTTProvider } from './SystemSTTProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_INFERENCE_ENABLED } from '../../config/localInference';
import { decodeAudioFile } from '../../utils/audioDecoder';

export type STTProviderType = 'api' | 'whisper_local' | 'system';

export interface STTConfig {
    provider: STTProviderType;
    baseUrl: string;
    apiKey?: string;
    model?: string;
}

// Lazy load WhisperSTT only when local inference is enabled
let WhisperSTT: any = null;
const getWhisperSTT = async () => {
    if (!LOCAL_INFERENCE_ENABLED.STT) {
        return null;
    }
    if (!WhisperSTT) {
        try {
            const module = await require('./WhisperProvider');
            WhisperSTT = module.WhisperSTT;
        } catch (e) {
            console.warn('[STTService] Failed to load WhisperSTT:', e);
            return null;
        }
    }
    return WhisperSTT;
};

class STTServiceClass {
    private recording: Audio.Recording | null = null;
    private isStartingRecording = false;
    private config: STTConfig = {
        provider: 'system', // Default: system speech recognition
        baseUrl: 'https://api.openai.com/v1',
        model: 'whisper-1',
    };
    private initialized = false;

    private async getPreferredWhisperModel(downloaded: string[]): Promise<string | null> {
        if (downloaded.length === 0) return null;
        if (this.config.model && downloaded.includes(this.config.model)) {
            return this.config.model;
        }
        try {
            const saved = await AsyncStorage.getItem('settings_whisper_model');
            if (saved && downloaded.includes(saved)) {
                return saved;
            }
        } catch {
            // Ignore and fall back to first downloaded model
        }
        return downloaded[0] ?? null;
    }

    /**
     * Initialize the STT service - auto-detects available providers
     * Priority: whisper_local (if downloaded and enabled) > system > api
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Load saved settings
            const [savedProvider, savedBaseUrl, savedApiKey, savedWhisperModel] = await AsyncStorage.multiGet([
                'settings_sttProvider',
                'settings_sttBaseUrl',
                'settings_sttApiKey',
                'settings_whisper_model',
            ]);

            if (savedProvider[1]) {
                let provider = savedProvider[1] as STTProviderType;
                // If local inference is disabled and whisper_local was selected, fallback
                if (provider === 'whisper_local' && !LOCAL_INFERENCE_ENABLED.STT) {
                    provider = 'system';
                    console.log('[STTService] Whisper local unavailable, falling back to:', provider);
                }
                // Handle legacy expo_speech setting
                if ((provider as string) === 'expo_speech') {
                    provider = 'system';
                }
                this.config.provider = provider;
            } else {
                // Auto-detect best provider
                if (LOCAL_INFERENCE_ENABLED.STT) {
                    // Only check for Whisper local if local inference is enabled
                    const whisper = await getWhisperSTT();
                    if (whisper) {
                        const whisperModels = await whisper.getDownloadedModels();
                        if (whisperModels.length > 0) {
                            this.config.provider = 'whisper_local';
                            console.log('[STTService] Auto-selected whisper_local as default');
                        } else {
                            this.config.provider = 'system';
                            console.log('[STTService] Auto-selected system as default');
                        }
                    } else {
                        this.config.provider = 'system';
                        console.log('[STTService] Auto-selected system as default (no whisper)');
                    }
                } else {
                    this.config.provider = 'system';
                    console.log('[STTService] Auto-selected system as default (local STT disabled)');
                }
            }

            if (savedBaseUrl[1]) {
                this.config.baseUrl = savedBaseUrl[1];
            }
            if (savedApiKey[1]) {
                this.config.apiKey = savedApiKey[1];
            }
            if (savedWhisperModel[1]) {
                this.config.model = savedWhisperModel[1];
            }

            // If provider is whisper_local, check if models are actually available AND local inference is enabled
            if (this.config.provider === 'whisper_local') {
                if (!LOCAL_INFERENCE_ENABLED.STT) {
                    console.log('[STTService] Whisper local selected but local inference disabled, falling back to system');
                    this.config.provider = 'system';
                } else {
                    const whisper = await getWhisperSTT();
                    if (!whisper) {
                        console.log('[STTService] Whisper not available, falling back to system');
                        this.config.provider = 'system';
                    } else {
                        const whisperModels = await whisper.getDownloadedModels();
                        if (whisperModels.length === 0) {
                            console.log('[STTService] Whisper local selected but no models found, falling back to system');
                            this.config.provider = 'system';
                        } else {
                            const preferredModel = await this.getPreferredWhisperModel(whisperModels);
                            if (preferredModel) {
                                console.log('[STTService] Pre-loading Whisper model:', preferredModel);
                                await whisper.loadModel(preferredModel as any);
                            }
                        }
                    }
                }
            }

            console.log('[STTService] Initialized with provider:', this.config.provider);
        } catch (e) {
            console.warn('[STTService] Failed to initialize:', e);
            this.config.provider = 'system';
        }

        this.initialized = true;
    }

    setConfig(config: Partial<STTConfig>) {
        this.config = { ...this.config, ...config };
        console.log('[STTService] Config updated:', { provider: this.config.provider, baseUrl: this.config.baseUrl });
    }

    getConfig(): STTConfig {
        return { ...this.config };
    }

    getProvider(): STTProviderType {
        return this.config.provider;
    }

    /**
     * Check if whisper_local is available (models downloaded AND local inference enabled)
     */
    async isWhisperLocalAvailable(): Promise<boolean> {
        if (!LOCAL_INFERENCE_ENABLED.STT) {
            return false;
        }
        try {
            const whisper = await getWhisperSTT();
            if (!whisper) return false;
            const models = await whisper.getDownloadedModels();
            return models.length > 0;
        } catch {
            return false;
        }
    }

    private listeners: ((status: Audio.RecordingStatus) => void)[] = [];

    addListener(listener: (status: Audio.RecordingStatus) => void) {
        this.listeners.push(listener);
    }

    removeListener(listener: (status: Audio.RecordingStatus) => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    async startRecording(): Promise<void> {
        // Ensure initialized
        if (!this.initialized) {
            await this.initialize();
        }

        // System uses its own streaming logic (no expo-av Recording)
        if (this.config.provider === 'system') {
            await SystemSTTProvider.start();
            return;
        }

        // API & Whisper Local use File Recording - ensure no previous recording exists
        if (this.isStartingRecording) {
            console.warn('[STTService] Ignoring concurrent startRecording');
            return;
        }
        this.isStartingRecording = true;
        try {
            await this.ensureNoActiveRecording();

            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') throw new Error('Microphone permission not granted');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                (status) => {
                    this.listeners.forEach(l => l(status));
                },
                100 // Update every 100ms
            );
            this.recording = recording;
            console.log('[STTService] Recording started (File Mode)');
        } catch (err) {
            console.error('[STTService] Failed to start recording', err);
            throw err;
        } finally {
            this.isStartingRecording = false;
        }
    }

    private async ensureNoActiveRecording(): Promise<void> {
        if (!this.recording) return;
        try {
            await this.recording.stopAndUnloadAsync();
        } catch (e) {
            console.warn('[STTService] Cleanup previous recording:', e);
        }
        this.recording = null;
    }

    async stopRecording(): Promise<string | null> {
        if (this.config.provider === 'system') {
            const result = await SystemSTTProvider.stop();
            return result ? `system://${encodeURIComponent(result)}` : null;
        }


        if (!this.recording) return null;

        try {
            await this.recording.stopAndUnloadAsync();
            const uri = this.recording.getURI();
            this.recording = null;
            console.log('[STTService] Recording stopped, URI:', uri);
            return uri;
        } catch (err) {
            console.error('[STTService] Failed to stop recording', err);
            return null;
        }
    }

    async transcribe(audioUri: string): Promise<string> {
        // Ensure initialized
        if (!this.initialized) {
            await this.initialize();
        }

        // Handle System Result (encoded in URI)
        if (audioUri.startsWith('system://')) {
            const decoded = decodeURIComponent(audioUri.replace('system://', ''));
            return decoded;
        }

        // Whisper Local - prioritize this if available
        if (this.config.provider === 'whisper_local') {
            if (!LOCAL_INFERENCE_ENABLED.STT) {
                throw new Error('Voice recognition unavailable. Local STT is disabled.');
            }
            try {
                const whisper = await getWhisperSTT();
                if (!whisper) {
                    throw new Error('Voice recognition unavailable. Whisper module not loaded.');
                }

                const downloaded = await whisper.getDownloadedModels();
                const preferredModel = await this.getPreferredWhisperModel(downloaded);
                if (preferredModel) {
                    await whisper.loadModel(preferredModel as any);
                }

                // Prefer file-based transcription when provider supports it (expo-whisper)
                if (typeof whisper.transcribeFile === 'function') {
                    const fileText = await whisper.transcribeFile(audioUri, 'en');
                    if (fileText && fileText.trim().length > 0) {
                        return fileText.trim();
                    }
                }

                // Decode audio file to Float32Array waveform at 16kHz
                console.log('[STTService] Decoding audio for Whisper...');
                const waveform = await decodeAudioFile(audioUri);
                console.log('[STTService] Audio decoded, samples:', waveform.length);

                // Transcribe using Whisper
                const result = await whisper.transcribe(waveform, 'en');
                return result;
            } catch (e: any) {
                console.error('[STTService] Whisper local failed:', e);
                if (e.message?.includes('WebView not initialized')) {
                    throw new Error('Whisper STT requires AudioDecoderWebView. Please ensure it is mounted in your app.');
                }
                // Fall through to try API as backup if configured
                if (!this.config.apiKey) {
                    throw new Error(`Local Whisper failed: ${e.message || 'Unknown error'}`);
                }
            }
        }

        // API Provider
        if (this.config.provider === 'api') {
            return await this.transcribeApi(audioUri);
        }

        // If we get here, nothing worked
        throw new Error('Voice recognition unavailable. Please configure a provider in Settings.');
    }

    private async transcribeApi(audioUri: string): Promise<string> {
        // If no API key is configured, don't even try
        if (!this.config.apiKey) {
            console.warn('[STTService] API provider selected but no API key configured');
            throw new Error('API not configured. Please add an API key in Settings > Speech to Text.');
        }

        try {
            // Support both Base URL (e.g. host:port) and Full Endpoint
            let url = this.config.baseUrl;
            if (!url.endsWith('/audio/transcriptions')) {
                url = url.replace(/\/$/, '');
                if (!url.includes('/audio/')) {
                    url = `${url}/audio/transcriptions`;
                }
            }

            const formData = new FormData();
            formData.append('file', {
                uri: audioUri,
                type: 'audio/m4a',
                name: 'recording.m4a',
            } as any);
            formData.append('model', this.config.model || 'whisper-1');

            const headers: any = {
                'Content-Type': 'multipart/form-data',
            };
            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            console.log('[STTService] Sending to API:', url);
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[STTService] API Error:', errorText);
                throw new Error(`STT API Error: ${response.status}`);
            }

            const result = await response.json();
            return result.text || '';

        } catch (error) {
            console.error('[STTService] Transcription error:', error);
            return 'Voice recognition failed. Please check your API configuration in Settings > Speech to Text.';
        }
    }

    /**
     * Check provider availability with fallback recommendations
     */
    async checkProviderAvailability(): Promise<{
        available: boolean;
        provider: STTProviderType;
        fallback?: STTProviderType;
        message?: string;
    }> {
        const currentProvider = this.config.provider;

        if (currentProvider === 'system') {
            const moduleLinked = SystemSTTProvider.isModuleLinked();
            if (!moduleLinked) {

                if (LOCAL_INFERENCE_ENABLED.STT) {
                    const whisper = await getWhisperSTT();
                    if (whisper) {
                        const whisperModels = await whisper.getDownloadedModels();
                        if (whisperModels.length > 0) {
                            return {
                                available: false,
                                provider: 'system',
                                fallback: 'whisper_local',
                                message: 'System speech module not linked. Switching to Whisper...'
                            };
                        }
                    }
                }
                return {
                    available: false,
                    provider: 'system',
                    fallback: 'api',
                    message: 'System speech module not linked. Using API transcription instead (configure API key in Settings > Speech to Text).'
                };
            }
        }



        if (currentProvider === 'whisper_local') {
            if (!LOCAL_INFERENCE_ENABLED.STT) {
                return {
                    available: false,
                    provider: 'whisper_local',
                    fallback: 'api',
                    message: 'Local Whisper is disabled. Using API transcription instead. Configure API key in Settings.'
                };
            }
            const whisper = await getWhisperSTT();
            if (!whisper) {
                return {
                    available: false,
                    provider: 'whisper_local',
                    fallback: 'api',
                    message: 'Whisper module not available. Using API transcription instead.'
                };
            }
            const whisperModels = await whisper.getDownloadedModels();
            if (whisperModels.length === 0) {
                return {
                    available: false,
                    provider: 'whisper_local',
                    fallback: 'api',
                    message: 'No Whisper models downloaded. Download one in Settings or use API transcription.'
                };
            }
        }

        return { available: true, provider: currentProvider };
    }

    /**
     * Switch to a specific provider
     */
    async switchProvider(provider: STTProviderType): Promise<boolean> {
        if (provider === 'whisper_local') {
            if (!LOCAL_INFERENCE_ENABLED.STT) {
                console.warn('[STTService] Cannot switch to whisper_local: local inference disabled');
                return false;
            }
            const available = await this.isWhisperLocalAvailable();
            if (!available) {
                console.warn('[STTService] Cannot switch to whisper_local: no models downloaded');
                return false;
            }

            const whisper = await getWhisperSTT();
            if (whisper) {
                const downloaded = await whisper.getDownloadedModels();
                const preferredModel = await this.getPreferredWhisperModel(downloaded);
                if (preferredModel) {
                    await whisper.loadModel(preferredModel as any);
                }
            }
        }

        this.config.provider = provider;
        await AsyncStorage.setItem('settings_sttProvider', provider);
        console.log('[STTService] Switched to provider:', provider);
        return true;
    }
}

export const STTService = new STTServiceClass();
