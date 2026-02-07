
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import { Platform, PermissionsAndroid } from 'react-native';

class SystemSTTProviderClass {
    private isListening = false;
    private lastResult = "";
    private resolveRecognition: ((text: string) => void) | null = null;
    private rejectRecognition: ((error: Error) => void) | null = null;

    constructor() {
        this.setupVoiceListeners();
    }

    private setupVoiceListeners() {
        try {
            Voice.onSpeechResults = this.onSpeechResults.bind(this);
            Voice.onSpeechError = this.onSpeechError.bind(this);
            Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
            Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
        } catch (e) {
            console.error("[SystemSTT] Failed to setup voice listeners:", e);
        }
    }

    private onSpeechResults(e: SpeechResultsEvent) {
        if (e.value && e.value.length > 0) {
            this.lastResult = e.value[0];
            console.log("[SystemSTT] Final result:", this.lastResult);
        }
    }

    private onSpeechPartialResults(e: SpeechResultsEvent) {
        if (e.value && e.value.length > 0) {
            this.lastResult = e.value[0];
            console.log("[SystemSTT] Partial result:", this.lastResult);
        }
    }

    private onSpeechEnd(e: any) {
        console.log("[SystemSTT] Speech end event");
        this.isListening = false;
        // Resolve the promise if we're waiting
        if (this.resolveRecognition) {
            this.resolveRecognition(this.lastResult);
            this.resolveRecognition = null;
            this.rejectRecognition = null;
        }
    }

    private onSpeechError(e: SpeechErrorEvent) {
        console.error("[SystemSTT] Error:", e.error);
        this.isListening = false;
        
        // Don't treat "no speech" as a fatal error
        if (e.error?.message?.includes('7') || e.error?.message?.includes('No match')) {
            console.log("[SystemSTT] No speech detected, returning empty result");
            if (this.resolveRecognition) {
                this.resolveRecognition(this.lastResult || "");
                this.resolveRecognition = null;
                this.rejectRecognition = null;
            }
            return;
        }
        
        // Reject the promise for other errors
        if (this.rejectRecognition) {
            this.rejectRecognition(new Error(e.error?.message || 'Speech recognition error'));
            this.resolveRecognition = null;
            this.rejectRecognition = null;
        }
    }

    private async requestAndroidPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;
        
        try {
            const audioGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                    title: 'Microphone Permission',
                    message: 'This app needs microphone access for speech recognition',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            
            return audioGranted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn("[SystemSTT] Permission request error:", err);
            return false;
        }
    }

    async start(locale: string = 'en-US'): Promise<void> {
        this.lastResult = "";
        this.isListening = true;
        
        try {
            // Check if native module is available
            const available = await this.isAvailable();
            if (!available) {
                throw new Error(
                    "System Voice is not available. " +
                    "This requires a native development build (not Expo Go). " +
                    "Please run: npx expo run:android"
                );
            }

            // Request permissions on Android
            if (Platform.OS === 'android') {
                const hasPermission = await this.requestAndroidPermissions();
                if (!hasPermission) {
                    throw new Error("Microphone permission denied");
                }
            }

            await Voice.start(locale);
            console.log("[SystemSTT] Started listening with locale:", locale);
            
        } catch (e: any) {
            this.isListening = false;
            console.error("[SystemSTT] Start error:", e);
            
            // Provide helpful error messages
            if (e instanceof TypeError && e.message?.includes('null')) {
                throw new Error(
                    "Native Voice Module not linked. " +
                    "Please rebuild the native app: npx expo run:android --clean"
                );
            }
            
            if (e.message?.includes('Activity') || e.message?.includes('permissions')) {
                throw new Error(
                    "Speech recognition requires microphone permission. " +
                    "Please grant permission in Android settings."
                );
            }
            
            throw e;
        }
    }

    async stop(): Promise<string> {
        try {
            if (this.isListening) {
                await Voice.stop();
                this.isListening = false;
            }
            // Give a small delay for final results
            await new Promise(r => setTimeout(r, 200));
            return this.lastResult;
        } catch (e) {
            console.error("[SystemSTT] Stop error:", e);
            return this.lastResult;
        }
    }

    async cancel() {
        try {
            if (this.isListening) {
                await Voice.cancel();
                this.isListening = false;
            }
        } catch (e) {
            console.error("[SystemSTT] Cancel error:", e);
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Check if Voice module is properly linked
            if (!Voice || typeof Voice.isAvailable !== 'function') {
                console.warn("[SystemSTT] Voice module not properly linked");
                return false;
            }
            const avail = await Voice.isAvailable();
            return !!avail;
        } catch (e) {
            console.warn("[SystemSTT] Availability check failed:", e);
            return false;
        }
    }

    isModuleLinked(): boolean {
        try {
            return !!Voice && typeof Voice.start === 'function';
        } catch {
            return false;
        }
    }

    /**
     * Get a detailed status of why voice might not be available
     */
    async getStatus(): Promise<{
        available: boolean;
        moduleLinked: boolean;
        hasPermission: boolean;
        message: string;
    }> {
        const status = {
            available: false,
            moduleLinked: false,
            hasPermission: true,
            message: "",
        };

        // Check module linking
        try {
            if (Voice && typeof Voice.isAvailable === 'function') {
                status.moduleLinked = true;
            } else {
                status.message = "Native module not linked. Rebuild required.";
                return status;
            }
        } catch (e) {
            status.message = "Native module not found. Rebuild required.";
            return status;
        }

        // Check platform availability
        try {
            const avail = await Voice.isAvailable();
            if (!avail) {
                status.message = "Speech recognition not available on this device.";
                return status;
            }
        } catch (e) {
            status.message = "Error checking voice availability.";
            return status;
        }

        // Check permissions on Android
        if (Platform.OS === 'android') {
            try {
                const hasAudio = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
                );
                status.hasPermission = hasAudio;
                if (!hasAudio) {
                    status.message = "Microphone permission required.";
                    return status;
                }
            } catch (e) {
                status.hasPermission = false;
                status.message = "Could not verify permissions.";
                return status;
            }
        }

        status.available = true;
        status.message = "Speech recognition is available.";
        return status;
    }

    /**
     * Destroy the voice instance (call on app unmount)
     */
    async destroy() {
        try {
            await Voice.destroy();
        } catch (e) {
            console.error("[SystemSTT] Destroy error:", e);
        }
    }
}

export const SystemSTTProvider = new SystemSTTProviderClass();
