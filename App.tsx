/**
 * Root Application Component
 * ChatGPT-inspired clean design
 */

import './global.css';

import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from '@expo-google-fonts/urbanist';
import { AppNavigator } from './src/navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundaryWrapper } from './src/components/ErrorBoundary';
import { AudioDecoderWebView } from './src/components/AudioDecoderWebView';
import { PdfExtractorWebView } from './src/components/PdfExtractorWebView';
import { LOCAL_INFERENCE_ENABLED } from './src/config/localInference';

const applyGlobalFontDefaults = () => {
  if (Text.defaultProps == null) {
    Text.defaultProps = {};
  }
  if (TextInput.defaultProps == null) {
    TextInput.defaultProps = {};
  }

  const defaultTextStyle = [{ fontFamily: 'Urbanist-Regular' }, Text.defaultProps.style].flat();
  const defaultInputStyle = [{ fontFamily: 'Urbanist-Regular' }, TextInput.defaultProps.style].flat();

  Text.defaultProps.style = defaultTextStyle;
  TextInput.defaultProps.style = defaultInputStyle;
};

export default function App() {
  const [fontsLoaded] = useFonts({
    'Urbanist-Regular': Urbanist_400Regular,
    'Urbanist-Medium': Urbanist_500Medium,
    'Urbanist-SemiBold': Urbanist_600SemiBold,
    'Urbanist-Bold': Urbanist_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      applyGlobalFontDefaults();
    }
    const onUnhandledRejection = (event: unknown) => {
      const reason = typeof event === 'object' && event !== null && 'reason' in event
        ? (event as { reason: unknown }).reason
        : event;
      const message = reason instanceof Error ? reason.message : String(reason);
      Alert.alert('Something went wrong', message || 'An unexpected error occurred.');
    };
    (global as any).onunhandledrejection = onUnhandledRejection;
    return () => {
      delete (global as any).onunhandledrejection;
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundaryWrapper>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppNavigator />
        <StatusBar style="dark" />
        {/* Hidden WebView for audio decoding (required for Whisper STT) */}
        {LOCAL_INFERENCE_ENABLED.STT && <AudioDecoderWebView />}
        {/* Hidden WebView for PDF text extraction (PDF.js) */}
        <PdfExtractorWebView />
      </GestureHandlerRootView>
    </ErrorBoundaryWrapper>
  );
}
