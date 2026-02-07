/**
 * Main Navigation Container
 * Clean navigation with sidebar
 */

import React from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ConversationProvider } from '../context/ConversationContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ConfigService } from '../services/ConfigService';
import { NativeWindThemeBridge } from '../components/NativeWindThemeBridge';

// Screens
import { NormalChatScreen } from '../screens/NormalChatScreen';
import { SearchHomeScreen } from '../screens/SearchHomeScreen';

import { BrowserScreen } from '../screens/BrowserScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { HeadlessBrowser } from '../components/headless/HeadlessBrowser';
import { setStatusBarHidden } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';



const Stack = createNativeStackNavigator();

// Root Stack Navigator
export const AppNavigator: React.FC = () => {
    React.useEffect(() => { ConfigService.loadSettings(); }, []);
    return <AuthProvider><ThemeProvider><AppContent /></ThemeProvider></AuthProvider>;
};

// App Content
const AppContent: React.FC = () => {
    const { isLoading } = useAuth();
    const { theme } = useTheme();
    const [onboardingReady, setOnboardingReady] = React.useState(false);
    const [onboardingComplete, setOnboardingComplete] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const flag = await AsyncStorage.getItem('onboarding_completed');
                if (mounted) {
                    setOnboardingComplete(flag === 'true');
                    setOnboardingReady(true);
                }
            } catch {
                if (mounted) {
                    setOnboardingComplete(false);
                    setOnboardingReady(true);
                }
            }
        })();
        return () => { mounted = false; };
    }, []);

    if (isLoading || !onboardingReady) {
        return (
            <View className="flex-1 items-center justify-center bg-bg">
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <NativeWindThemeBridge>
            <ConversationProvider>
                <ToastProvider>
                    <NavigationContainer>
                        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={onboardingComplete ? 'Chat' : 'Setup'}>
                            <Stack.Screen name="Setup" component={SetupScreen} />
                            <Stack.Screen name="Chat" component={NormalChatScreen} />
                            <Stack.Screen name="Search" component={SearchHomeScreen} />
                            <Stack.Screen name="Browser" component={BrowserScreen} options={{ presentation: 'modal', gestureEnabled: true }} />
                            <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
                        </Stack.Navigator>
                        <HeadlessBrowser />
                    </NavigationContainer>
                </ToastProvider>
            </ConversationProvider>
        </NativeWindThemeBridge>
    );
};

const styles = StyleSheet.create({});
