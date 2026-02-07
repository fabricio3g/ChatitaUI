/**
 * Kokoro ONNX TTS Engine
 * On-device text-to-speech using ONNX Runtime
 * Based on https://github.com/isaiahbjork/expo-kokoro-onnx
 *
 * @deprecated This provider is deprecated. Use ExecutorchTTSProvider instead.
 * The onnxruntime-react-native package has been replaced with react-native-executorch.
 * This file is kept for reference. See ExecutorchTTSProvider.ts for the new implementation.
 *
 * Lazy-loads onnxruntime-react-native to allow Expo Go to start (native module unavailable there).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { isExpoGo } from '../../../utils/isExpoGo';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import {
    MODELS,
    KOKORO_VOICES,
    ModelId,
    VoiceId,
    isModelDownloaded,
    isVoiceDownloaded,
    downloadVoice,
    getVoiceData
} from './models';

// Lazy-load onnxruntime to avoid "install of null" crash in Expo Go
// In Expo Go, native modules like onnxruntime are null and crash when accessed
let onnxModule: { InferenceSession: any; Tensor: any } | null | undefined = undefined;
function getOnnx(): { InferenceSession: any; Tensor: any } | any {
    if (onnxModule !== undefined) return onnxModule;
    if (isExpoGo()) {
        onnxModule = null;
        return null;
    }
    try {
        onnxModule = require('onnxruntime-react-native');
        return onnxModule;
    } catch (e) {
        console.warn('[Kokoro] onnxruntime-react-native not available');
        onnxModule = null;
        return null;
    }
}

// Constants
const SAMPLE_RATE = 24000;
const STYLE_DIM = 256;
const MAX_PHONEME_LENGTH = 510;

// Complete vocabulary from Python Kokoro implementation
const VOCAB = (() => {
    const _pad = "$";
    const _punctuation = ';:,.!?¡¿—…"«»"" ';
    const _letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";

    const symbols = [_pad, ..._punctuation.split(''), ..._letters.split(''), ..._letters_ipa.split('')];
    const dicts: Record<string, number> = {};

    for (let i = 0; i < symbols.length; i++) {
        dicts[symbols[i]] = i;
    }

    return dicts;
})();

// English phoneme mappings for basic phonemization
const ENGLISH_PHONEME_MAP: Record<string, string> = {
    'a': 'ə',
    'e': 'ɛ',
    'i': 'ɪ',
    'o': 'oʊ',
    'u': 'ʌ',
    'th': 'θ',
    'sh': 'ʃ',
    'ch': 'tʃ',
    'ng': 'ŋ',
    'j': 'dʒ',
    'r': 'ɹ',
    'er': 'ɝ',
    'ar': 'ɑɹ',
    'or': 'ɔɹ',
    'ir': 'ɪɹ',
    'ur': 'ʊɹ',
};

// Common word to phoneme mappings
const COMMON_WORD_PHONEMES: Record<string, string> = {
    'hello': 'hɛˈloʊ',
    'world': 'wˈɝld',
    'this': 'ðˈɪs',
    'is': 'ˈɪz',
    'a': 'ə',
    'test': 'tˈɛst',
    'of': 'ʌv',
    'the': 'ðə',
    'to': 'tˈuː',
    'and': 'ˈænd',
    'you': 'juː',
    'are': 'ɑːɹ',
    'how': 'haʊ',
    'kokoro': 'kˈoʊkəɹoʊ',
    'text': 'tˈɛkst',
    'speech': 'spˈiːtʃ',
    'system': 'sˈɪstəm',
    'running': 'ɹˈʌnɪŋ',
    'on': 'ˈɑːn',
    'expo': 'ˈɛkspoʊ',
    'with': 'wˈɪð',
    'onnx': 'ˈɑːnɛks',
    'runtime': 'ɹˈʌntaɪm',
};

class KokoroOnnxEngine {
    private session: any = null;
    private isModelLoaded = false;
    private currentModelId: ModelId | null = null;
    private isOnnxAvailable = true;

    get isReady(): boolean {
        return this.isModelLoaded && this.session !== null;
    }

    get isSupported(): boolean {
        try {
            const onnx = getOnnx();
            const InferenceSession = onnx?.InferenceSession;
            return !!InferenceSession && typeof InferenceSession.create === 'function';
        } catch (e) {
            return false;
        }
    }

    get loadedModelId(): ModelId | null {
        return this.currentModelId;
    }

    /**
     * Load a specific ONNX model
     */
    async loadModel(modelId: ModelId = 'model_q8f16.onnx'): Promise<boolean> {
        try {
            if (!this.isSupported) {
                console.error('[Kokoro] ONNX Runtime is not available on this platform');
                return false;
            }

            // Check if already loaded
            if (this.isModelLoaded && this.currentModelId === modelId && this.session) {
                console.log('[Kokoro] Model already loaded:', modelId);
                return true;
            }

            // Check if model is downloaded
            if (!await isModelDownloaded(modelId)) {
                console.error('[Kokoro] Model not downloaded:', modelId);
                return false;
            }

            const modelPath = FileSystem.cacheDirectory + modelId;
            console.log('[Kokoro] Loading ONNX model from:', modelPath);

            // Create inference session with options
            const options = {
                executionProviders: ['cpuexecutionprovider'],
                graphOptimizationLevel: 'all',
            };

            const { InferenceSession } = getOnnx() || {};
            if (!InferenceSession) {
                console.error('[Kokoro] ONNX InferenceSession not available');
                return false;
            }
            try {
                this.session = await InferenceSession.create(modelPath, options);
            } catch (optionsError) {
                console.warn('[Kokoro] Failed with options, trying without:', optionsError);
                this.session = await InferenceSession.create(modelPath);
            }

            if (!this.session) {
                console.error('[Kokoro] Failed to create inference session');
                return false;
            }

            this.isModelLoaded = true;
            this.currentModelId = modelId;
            console.log('[Kokoro] Model loaded successfully:', modelId);
            return true;

        } catch (error) {
            console.error('[Kokoro] Error loading model:', error);
            this.isModelLoaded = false;
            this.currentModelId = null;
            this.session = null;
            return false;
        }
    }

    /**
     * Ensure voice is downloaded
     */
    async ensureVoice(voiceId: VoiceId): Promise<boolean> {
        if (await isVoiceDownloaded(voiceId)) {
            return true;
        }

        console.log('[Kokoro] Downloading voice:', voiceId);
        const { promise } = downloadVoice(voiceId);
        return await promise;
    }

    /**
     * Normalize text for phonemization
     */
    private normalizeText(text: string): string {
        text = text.trim();
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
        text = text.replace(/…/g, '...');
        return text;
    }

    /**
     * Basic phonemization function
     */
    private phonemize(text: string): string {
        text = this.normalizeText(text);
        const words = text.split(/\s+/);

        const phonemizedWords = words.map(word => {
            const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');

            // Check for predefined phonemes
            if (COMMON_WORD_PHONEMES[cleanWord]) {
                return COMMON_WORD_PHONEMES[cleanWord];
            }

            // Character-by-character phonemization
            let phonemes = '';
            let i = 0;

            while (i < word.length) {
                // Check for digraphs
                if (i < word.length - 1) {
                    const digraph = word.substring(i, i + 2).toLowerCase();
                    if (ENGLISH_PHONEME_MAP[digraph]) {
                        phonemes += ENGLISH_PHONEME_MAP[digraph];
                        i += 2;
                        continue;
                    }
                }

                // Single character
                const char = word[i].toLowerCase();
                if (ENGLISH_PHONEME_MAP[char]) {
                    phonemes += ENGLISH_PHONEME_MAP[char];
                } else if (/[a-z]/.test(char)) {
                    phonemes += char;
                } else if (/[.,!?;:'"]/g.test(char)) {
                    phonemes += char;
                }
                i++;
            }

            // Add stress marker to first syllable for longer words
            if (phonemes.length > 2 && !/[.,!?;:'"]/g.test(phonemes)) {
                const firstVowelMatch = phonemes.match(/[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔoeiuaɑː]/);
                if (firstVowelMatch) {
                    const vowelIndex = firstVowelMatch.index || 0;
                    phonemes = phonemes.substring(0, vowelIndex) + 'ˈ' + phonemes.substring(vowelIndex);
                }
            }

            return phonemes;
        });

        return phonemizedWords.join(' ');
    }

    /**
     * Tokenize phonemized text
     */
    private tokenize(phonemes: string): number[] {
        // Auto-phonemize if input looks like regular text
        if (!/[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔˈˌː]/.test(phonemes)) {
            phonemes = this.phonemize(phonemes);
        }

        console.log('[Kokoro] Phonemized:', phonemes);

        const tokens: number[] = [0]; // Start token

        for (const char of phonemes) {
            if (VOCAB[char] !== undefined) {
                tokens.push(VOCAB[char]);
            } else {
                console.warn(`[Kokoro] Unknown character: "${char}" (code: ${char.charCodeAt(0)})`);
            }
        }

        tokens.push(0); // End token
        return tokens;
    }

    /**
     * Generate audio from text - returns audio URI for playback
     */
    async generateAudio(
        text: string,
        voiceId: VoiceId = 'af_bella',
        speed: number = 1.0
    ): Promise<{ audioUri: string; duration?: number }> {
        if (!this.isSupported) {
            throw new Error('ONNX Runtime is not available on this platform');
        }

        if (!this.session || !this.isModelLoaded) {
            throw new Error('Model not loaded. Call loadModel() first.');
        }

        // Ensure voice is downloaded
        const voiceReady = await this.ensureVoice(voiceId);
        if (!voiceReady) {
            throw new Error(`Failed to download voice: ${voiceId}`);
        }

        try {
            // 1. Tokenize input
            const tokens = this.tokenize(text);
            const numTokens = Math.min(Math.max(tokens.length - 2, 0), 509);

            // 2. Get voice style data
            const voiceData = await getVoiceData(voiceId);
            const offset = numTokens * STYLE_DIM;
            const styleData = voiceData.slice(offset, offset + STYLE_DIM);

            // 3. Prepare input tensors
            const { Tensor } = getOnnx() || {};
            if (!Tensor) throw new Error('ONNX Tensor not available');

            // Use BigInt64Array for int64 if available, fallback to regular array
            let inputIdsTensor: any;
            try {
                const bigIntArray = new BigInt64Array(tokens.map(t => BigInt(t)));
                inputIdsTensor = new Tensor('int64', bigIntArray, [1, tokens.length]);
            } catch (e) {
                console.warn('[Kokoro] BigInt64Array not available, using fallback');
                inputIdsTensor = new Tensor('int64', tokens, [1, tokens.length]);
            }

            const styleTensor = new Tensor('float32', new Float32Array(styleData), [1, STYLE_DIM]);
            const speedTensor = new Tensor('float32', new Float32Array([speed]), [1]);

            // 4. Run inference
            console.log('[Kokoro] Running inference...');
            const outputs = await this.session.run({
                'input_ids': inputIdsTensor,
                'style': styleTensor,
                'speed': speedTensor,
            });

            // 5. Process output - the model outputs 'waveform'
            const waveform = outputs['waveform']?.data as Float32Array;
            if (!waveform) {
                throw new Error('No waveform output from model');
            }

            console.log('[Kokoro] Generated waveform length:', waveform.length);

            // 6. Convert to audio file
            const audioUri = await this.floatArrayToAudioFile(waveform);

            // Calculate approximate duration
            const duration = waveform.length / SAMPLE_RATE;

            return { audioUri, duration };

        } catch (error) {
            console.error('[Kokoro] Audio generation error:', error);
            throw error;
        }
    }

    /**
     * Generate audio and create an Expo Audio Sound object
     */
    async generateSound(
        text: string,
        voiceId: VoiceId = 'af_bella',
        speed: number = 1.0
    ): Promise<Audio.Sound> {
        const { audioUri } = await this.generateAudio(text, voiceId, speed);

        const { sound } = await Audio.Sound.createAsync(
            { uri: audioUri },
            { shouldPlay: false }
        );

        return sound;
    }

    /**
     * Convert Float32Array to WAV audio file
     */
    private async floatArrayToAudioFile(floatArray: Float32Array): Promise<string> {
        try {
            // Convert to WAV
            const wavBuffer = this.floatArrayToWav(floatArray, SAMPLE_RATE);

            // Convert to base64
            const base64Data = this.arrayBufferToBase64(wavBuffer);

            // Save to temp file
            const tempFilePath = `${FileSystem.cacheDirectory}kokoro_${Date.now()}.wav`;
            await FileSystem.writeAsStringAsync(
                tempFilePath,
                base64Data,
                { encoding: FileSystem.EncodingType.Base64 }
            );

            console.log('[Kokoro] Audio saved to:', tempFilePath);
            return tempFilePath;

        } catch (error) {
            console.error('[Kokoro] Error converting audio:', error);
            throw error;
        }
    }

    /**
     * Convert ArrayBuffer to base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Float32Array to WAV format
     */
    private floatArrayToWav(floatArray: Float32Array, sampleRate: number): ArrayBuffer {
        const numSamples = floatArray.length;
        const int16Array = new Int16Array(numSamples);

        // Convert float [-1, 1] to int16
        for (let i = 0; i < numSamples; i++) {
            int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(floatArray[i] * 32767)));
        }

        // Create WAV header
        const headerLength = 44;
        const dataLength = int16Array.length * 2;
        const buffer = new ArrayBuffer(headerLength + dataLength);
        const view = new DataView(buffer);

        // RIFF chunk
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');

        // fmt subchunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true); // 16-bit

        // data subchunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write audio data
        for (let i = 0; i < numSamples; i++) {
            view.setInt16(headerLength + i * 2, int16Array[i], true);
        }

        return buffer;
    }

    private writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Release model resources
     */
    async release() {
        if (this.session) {
            this.session = null;
            this.isModelLoaded = false;
            this.currentModelId = null;
        }
    }
}

export const KokoroOnnx = new KokoroOnnxEngine();
