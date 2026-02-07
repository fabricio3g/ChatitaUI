/**
 * Type declarations for whisper.rn
 * https://github.com/mybigday/whisper.rn
 */

declare module 'whisper.rn' {
    export interface WhisperOptions {
        filePath: string;
    }

    export interface TranscribeOptions {
        language?: string;
        translate?: boolean;
        beamSize?: number;
        bestOf?: number;
        maxLen?: number;
        wordThold?: number;
        entropyThold?: number;
        logprobThold?: number;
        onNewSegments?: (segments: TranscribeSegment[]) => void;
    }

    export interface TranscribeSegment {
        t0: number;
        t1: number;
        text: string;
    }

    export interface TranscribeResult {
        result: string;
        segments: TranscribeSegment[];
    }

    export interface TranscribePromise {
        stop: () => void;
        promise: Promise<TranscribeResult>;
    }

    export interface WhisperContext {
        transcribe: (audioFilePath: string, options?: TranscribeOptions) => TranscribePromise;
        release: () => Promise<void>;
    }

    export function initWhisper(options: WhisperOptions): Promise<WhisperContext>;
    export function releaseAllWhisper(): Promise<void>;
}
