/**
 * Expo Speech Recognition Provider
 * Uses expo-speech-recognition (iOS SFSpeechRecognizer, Android SpeechRecognizer)
 * Alternative to @react-native-voice - requires development build after adding plugin
 * @see https://github.com/jamsch/expo-speech-recognition
 */

let ExpoSpeechRecognitionModule: any = null;
let expoSpeechAvailable: boolean | null = null;

function getModule(): any {
  if (ExpoSpeechRecognitionModule !== null) return ExpoSpeechRecognitionModule;
  try {
    ExpoSpeechRecognitionModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    ExpoSpeechRecognitionModule = false;
  }
  return ExpoSpeechRecognitionModule;
}

function isExpoSpeechAvailable(): boolean {
  if (expoSpeechAvailable !== null) return expoSpeechAvailable;
  try {
    const mod = getModule();
    expoSpeechAvailable = !!mod && typeof mod.start === 'function';
  } catch {
    expoSpeechAvailable = false;
  }
  return expoSpeechAvailable;
}

class ExpoSpeechProviderClass {
  private lastResult = '';
  private resultListener: { remove: () => void } | null = null;

  async start(locale: string = 'en-US'): Promise<void> {
    this.lastResult = '';
    this.cleanup();

    if (!isExpoSpeechAvailable()) {
      throw new Error('expo-speech-recognition is not available');
    }

    const mod = getModule();
    if (!mod) throw new Error('expo-speech-recognition not available');
    const result = await mod.requestPermissionsAsync();
    if (!result.granted) {
      throw new Error('Microphone and speech recognition permissions not granted');
    }

    this.resultListener = mod.addListener('result', (event: any) => {
      const transcript =
        event?.results?.[0]?.transcript ||
        event?.results?.[0]?.text ||
        event?.transcript ||
        event?.text ||
        (Array.isArray(event?.value) ? event.value[0] : event?.value);
      if (typeof transcript === 'string' && transcript.trim().length > 0) {
        this.lastResult = transcript;
      }
    });

    mod.start({
      lang: locale,
      interimResults: true,
      continuous: false,
    });
  }

  async stop(): Promise<string> {
    const mod = getModule();
    if (!mod) return this.lastResult;

    try {
      mod.stop();
      await new Promise(r => setTimeout(r, 300));
      return this.lastResult;
    } catch (e) {
      console.warn('[ExpoSpeech] Stop error:', e);
      return this.lastResult;
    } finally {
      this.cleanup();
    }
  }

  async abort(): Promise<void> {
    const mod = getModule();
    if (!mod) return;
    try {
      mod.abort();
    } catch (e) {
      console.warn('[ExpoSpeech] Abort error:', e);
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.resultListener?.remove();
    this.resultListener = null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!isExpoSpeechAvailable()) return false;
      const mod = getModule();
      return mod?.isRecognitionAvailable?.() !== false;
    } catch {
      return false;
    }
  }

  isModuleLinked(): boolean {
    try {
      const mod = getModule();
      return !!mod && typeof mod.start === 'function';
    } catch {
      return false;
    }
  }
}

export const ExpoSpeechProvider = new ExpoSpeechProviderClass();
