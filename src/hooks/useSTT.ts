import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface UseSTTHookOptions {
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseSTTHookReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

/**
 * Simple STT Hook for press-and-hold dictation
 * Records audio while button is held, transcribes on release
 */
export function useSTT(
  transcribeFunction: (audioUri: string) => Promise<string>,
  options: UseSTTHookOptions = {}
): UseSTTHookReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(-160);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);

      // Monitor audio levels for waveform
      audioLevelIntervalRef.current = setInterval(async () => {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          // Convert metering to 0-100 range for waveform
          const level = status.metering !== undefined ? status.metering : -160;
          // Normalize: -160 (silent) to 0 (loud) -> 0 to 100
          const normalized = Math.max(0, Math.min(100, (level + 160) / 1.6));
          setAudioLevel(normalized);
        }
      }, 50);

    } catch (error: any) {
      console.error('[useSTT] Start recording error:', error);
      options.onError?.(error?.message || 'Failed to start recording');
    }
  }, [options]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      // Stop monitoring levels
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      setIsRecording(false);
      setIsTranscribing(true);
      options.onTranscriptionStart?.();

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No audio recorded');
      }

      // Transcribe
      const text = await transcribeFunction(uri);
      
      // Clean up temp file
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }

      setIsTranscribing(false);
      options.onTranscriptionEnd?.(text);

    } catch (error: any) {
      console.error('[useSTT] Stop recording error:', error);
      setIsTranscribing(false);
      setAudioLevel(-160);
      options.onError?.(error?.message || 'Transcription failed');
    }
  }, [transcribeFunction, options]);

  return {
    isRecording,
    isTranscribing,
    audioLevel,
    startRecording,
    stopRecording,
  };
}
