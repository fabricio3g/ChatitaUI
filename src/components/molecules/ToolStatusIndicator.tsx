/**
 * Tool Status Indicator - Modern floating pill
 * Shows active tool execution with animated icon
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ToolStatusIndicatorProps {
    status: string;
}

const getToolConfig = (status: string): { icon: string; color: string; bgColor: string } => {
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('search') || lowerStatus.includes('web')) {
        return { icon: 'globe', color: '#3B82F6', bgColor: '#3B82F620' };
    } else if (lowerStatus.includes('weather')) {
        return { icon: 'cloud', color: '#3B82F6', bgColor: '#3B82F620' };
    } else if (lowerStatus.includes('calculat')) {
        return { icon: 'percent', color: '#F59E0B', bgColor: '#F59E0B20' };
    } else if (lowerStatus.includes('timer') || lowerStatus.includes('countdown')) {
        return { icon: 'clock', color: '#EF4444', bgColor: '#EF444420' };
    } else if (lowerStatus.includes('translat')) {
        return { icon: 'type', color: '#8B5CF6', bgColor: '#8B5CF620' };
    } else if (lowerStatus.includes('note') || lowerStatus.includes('todo')) {
        return { icon: 'check-square', color: '#F97316', bgColor: '#F9731620' };
    } else if (lowerStatus.includes('defin')) {
        return { icon: 'book', color: '#A855F7', bgColor: '#A855F720' };
    } else if (lowerStatus.includes('convert') || lowerStatus.includes('currenc')) {
        return { icon: 'repeat', color: '#14B8A6', bgColor: '#14B8A620' };
    } else if (lowerStatus.includes('random') || lowerStatus.includes('pick') || lowerStatus.includes('roll')) {
        return { icon: 'shuffle', color: '#F472B6', bgColor: '#F472B620' };
    } else if (lowerStatus.includes('image') || lowerStatus.includes('generate')) {
        return { icon: 'image', color: '#0EA5E9', bgColor: '#0EA5E920' };
    } else if (lowerStatus.includes('finance') || lowerStatus.includes('stock') || lowerStatus.includes('crypto')) {
        return { icon: 'trending-up', color: '#22C55E', bgColor: '#22C55E20' };
    } else if (lowerStatus.includes('date') || lowerStatus.includes('time')) {
        return { icon: 'calendar', color: '#6366F1', bgColor: '#6366F120' };
    } else if (lowerStatus.includes('media') || lowerStatus.includes('music') || lowerStatus.includes('video')) {
        return { icon: 'play-circle', color: '#E11D48', bgColor: '#E11D4820' };
    }

    return { icon: 'zap', color: '#3B82F6', bgColor: '#3B82F620' };
};

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({ status }) => {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    const config = getToolConfig(status);

    useEffect(() => {
        // Entry animation
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animation for the icon background
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        // Spin animation for loader
        const spin = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spin.start();

        return () => {
            pulse.stop();
            spin.stop();
        };
    }, []);

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Clean up status text
    const displayStatus = status
        .replace(/\.{3,}/g, '')
        .replace(/^\s+|\s+$/g, '')
        .trim() || 'Working...';

    return (
        <Animated.View style={[
            styles.container,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
        ]}>
            <View style={[
                styles.card,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border }
            ]}>
                {/* Animated spinner */}
                <Animated.View style={[styles.spinner, { transform: [{ rotate: spinInterpolate }] }]}>
                    <View style={[styles.spinnerTrack, { borderColor: theme.colors.border }]} />
                    <View style={[styles.spinnerHead, { borderTopColor: config.color }]} />
                </Animated.View>

                {/* Icon with animated background */}
                <Animated.View style={[
                    styles.iconContainer,
                    { backgroundColor: config.bgColor, transform: [{ scale: pulseAnim }] }
                ]}>
                    <Feather name={config.icon as any} size={18} color={config.color} />
                </Animated.View>

                {/* Text content */}
                <View style={styles.textContainer}>
                    <Text style={[styles.statusText, { color: theme.colors.text }]} numberOfLines={1}>
                        {displayStatus}
                    </Text>
                    <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
                        Using tool
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 110,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        pointerEvents: 'none',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 24,
        borderWidth: 1,
        gap: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    spinner: {
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerTrack: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        opacity: 0.3,
    },
    spinnerHead: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    subText: {
        fontSize: 11,
        marginTop: 1,
    },
});

export default ToolStatusIndicator;
