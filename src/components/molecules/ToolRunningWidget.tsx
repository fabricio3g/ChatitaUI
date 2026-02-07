/**
 * ToolRunningWidget – Monochrome minimal "tool in progress" indicator.
 * Shows spinner + status message. Designed to be unobtrusive but informative.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ToolRunningWidgetProps {
    message: string;
}

// Get icon based on message content
const getStatusIcon = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('search') || lower.includes('web') || lower.includes('internet')) return 'globe';
    if (lower.includes('weather') || lower.includes('forecast')) return 'cloud';
    if (lower.includes('calculat')) return 'percent';
    if (lower.includes('timer') || lower.includes('countdown')) return 'clock';
    if (lower.includes('translat')) return 'type';
    if (lower.includes('map') || lower.includes('location')) return 'map-pin';
    if (lower.includes('image') || lower.includes('generat')) return 'image';
    if (lower.includes('process')) return 'cpu';
    if (lower.includes('response') || lower.includes('result')) return 'message-circle';
    return 'zap';
};

export const ToolRunningWidget: React.FC<ToolRunningWidgetProps> = ({ message }) => {
    const { theme } = useTheme();
    const spinAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        // Pulse animation for icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.6,
                    duration: 600,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Spin animation for dots
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        return () => {
            pulseAnim.stopAnimation();
            spinAnim.stopAnimation();
        };
    }, []);

    const icon = getStatusIcon(message);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Animated.View style={[styles.iconWrap, { opacity: pulseAnim }]}>
                <Feather name={icon as any} size={16} color={theme.colors.textSecondary} />
            </Animated.View>
            <Text style={[styles.message, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {message}
            </Text>
            <View style={styles.dots}>
                {[0, 1, 2].map((i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.dot,
                            { backgroundColor: theme.colors.textTertiary },
                            {
                                opacity: spinAnim.interpolate({
                                    inputRange: [0, 0.33, 0.66, 1],
                                    outputRange: i === 0 ? [1, 0.3, 0.3, 1] : i === 1 ? [0.3, 1, 0.3, 0.3] : [0.3, 0.3, 1, 0.3],
                                }),
                            },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginHorizontal: 12,
        marginVertical: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    iconWrap: {
        marginRight: 10,
    },
    message: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginLeft: 8,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
});

export default ToolRunningWidget;
