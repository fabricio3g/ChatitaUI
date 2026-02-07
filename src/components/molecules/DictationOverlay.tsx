import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Feather } from '@expo/vector-icons';

interface DictationOverlayProps {
    visible: boolean;
    level: number; // Metering level in dB (-160 to 0)
    provider?: 'system' | 'expo_speech' | 'api' | 'whisper_local';
    elapsedMs?: number;
}

export const DictationOverlay: React.FC<DictationOverlayProps> = ({ visible, level, provider, elapsedMs }) => {
    const { theme } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Waveform bars
    const bar1 = useRef(new Animated.Value(30)).current;
    const bar2 = useRef(new Animated.Value(30)).current;
    const bar3 = useRef(new Animated.Value(30)).current;
    const bar4 = useRef(new Animated.Value(30)).current;
    const bar5 = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    useEffect(() => {
        if (!visible) return;

        // Normalize level (-60dB to 0dB range effective for speech)
        // -160 is silence. -30 is loud.
        const normalized = Math.max(0, (level + 60) / 60); // 0 to 1

        // Randomize slightly for organic feel
        const targetHeight = 30 + (normalized * 50);

        const animateBar = (anim: Animated.Value, delay: number) => {
            Animated.timing(anim, {
                toValue: targetHeight * (0.5 + Math.random() * 0.5),
                duration: 100,
                useNativeDriver: false, // Layout prop
                easing: Easing.linear
            }).start();
        };

        animateBar(bar1, 0);
        animateBar(bar2, 10);
        animateBar(bar3, 20);
        animateBar(bar4, 30);
        animateBar(bar5, 40);

    }, [level, visible]);

    if (!visible) return null;

    const formatElapsed = (ms?: number) => {
        const total = Math.max(0, Math.floor((ms || 0) / 1000));
        const m = Math.floor(total / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <Animated.View style={[
            styles.container,
            { opacity: fadeAnim }
        ]}>
            <View style={[
                styles.bubble,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    shadowColor: theme.colors.text
                }
            ]}>
                <View style={styles.headerRow}>
                    <View style={[
                        styles.iconContainer,
                        { backgroundColor: theme.colors.text }
                    ]}>
                        <Feather name="mic" size={20} color={theme.colors.background} />
                    </View>
                    <View style={styles.headerTextCol}>
                        <Text style={[styles.text, { color: theme.colors.text }]}>Recording</Text>
                        <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
                            {formatElapsed(elapsedMs)}
                        </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: theme.colors.surfaceHighlight, borderColor: theme.colors.border }]}>
                        <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>
                            {(provider || 'stt').toString().replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                <View style={styles.waveform}>
                    {[bar1, bar2, bar3, bar4, bar5].map((anim, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.bar,
                                {
                                    height: anim,
                                    backgroundColor: theme.colors.text
                                }
                            ]}
                        />
                    ))}
                </View>

                <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
                    Speak clearly and close to the mic
                </Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100, // Above chat input
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        pointerEvents: 'none', // Allow clicks through? No, usually not needed
    },
    bubble: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 160,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
        gap: 10,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextCol: {
        flex: 1,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 80,
        marginBottom: 8,
    },
    bar: {
        width: 6,
        borderRadius: 3,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
    },
    subText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
