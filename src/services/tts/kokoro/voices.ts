/**
 * Kokoro Voice Definitions
 * Voice data management for on-device TTS
 * Re-exports from models.ts for backward compatibility
 */

export {
    KOKORO_VOICES as VOICES,
    isVoiceDownloaded,
    downloadVoice,
    getVoiceData
} from './models';
export type { VoiceId } from './models';
