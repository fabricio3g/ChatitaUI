/**
 * Welcome Screen - Minimal design
 * Time-based greeting with persona name
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface WelcomeScreenProps {
    userName?: string;
    onSuggestionPress?: (text: string) => void;
}

const SUGGESTIONS = [
    'Explain quantum physics',
    'Help me write an email',
    'Summarize this topic',
    'Give me creative ideas',
];

const getGreetingInfo = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
        return {
            greeting: 'Good morning',
            subGreeting: 'How can I help you start your day?',
            icon: 'sun' as const,
        };
    } else if (hour < 17) {
        return {
            greeting: 'Good afternoon',
            subGreeting: 'What would you like to explore?',
            icon: 'sun' as const,
        };
    } else if (hour < 21) {
        return {
            greeting: 'Good evening',
            subGreeting: 'What can I help you with?',
            icon: 'moon' as const,
        };
    } else {
        return {
            greeting: 'Good night',
            subGreeting: 'Working late? How can I assist?',
            icon: 'moon' as const,
        };
    }
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    userName,
    onSuggestionPress,
}) => {
    const { theme } = useTheme();
    // Always derive from current time so greeting is correct (e.g. after app was in background)
    const { greeting, icon, subGreeting } = getGreetingInfo();

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const sunAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entry animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Sun-only subtle animation (gentle pulse + slow rotation)
    useEffect(() => {
        if (icon !== 'sun') return;
        const spin = Animated.loop(
            Animated.timing(sunAnim, {
                toValue: 1,
                duration: 8000,
                useNativeDriver: true,
            }),
            { resetBeforeIteration: true }
        );
        spin.start();
        return () => spin.stop();
    }, [icon]);

    const sunRotation = sunAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
    const sunScale = sunAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.08, 1],
    });

    const displayName = userName?.trim() || 'there';

    return (
        <View style={styles.container}>
            {/* Minimal Greeting */}
            <Animated.View
                style={[
                    styles.greetingContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    }
                ]}
            >
                <View style={styles.iconRow}>
                    <Animated.View style={{ transform: icon === 'sun' ? [{ rotate: sunRotation }, { scale: sunScale }] : [{ scale: 1 }] }}>
                        <Feather name={icon as any} size={20} color={theme.colors.textSecondary} />
                    </Animated.View>
                    <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
                        {greeting}, {displayName}
                    </Text>
                </View>
                <Text style={[styles.subGreeting, { color: theme.colors.textTertiary }]}>
                    {subGreeting}
                </Text>
            </Animated.View>

            {/* Simple Suggestions - no button-like press style */}
            <Animated.View
                style={[
                    styles.suggestionsContainer,
                    { opacity: fadeAnim }
                ]}
            >
                {SUGGESTIONS.map((text, index) => (
                    <Pressable
                        key={index}
                        style={styles.suggestion}
                        onPress={() => onSuggestionPress?.(text)}
                    >
                        <Text style={[styles.suggestionText, { color: theme.colors.textSecondary }]}>
                            {text}
                        </Text>
                    </Pressable>
                ))}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 20,
    },
    greetingContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    greeting: {
        fontSize: 20,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    subGreeting: {
        fontSize: 14,
        fontWeight: '400',
    },
    suggestionsContainer: {
        width: '100%',
        gap: 8,
    },
    suggestion: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    suggestionText: {
        fontSize: 14,
        fontWeight: '400',
    },
});

export default WelcomeScreen;
