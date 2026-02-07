/**
 * Report Preview Card Component
 * Shows a compact preview of the research report with expand animation
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ReportPreviewCardProps {
    queryCount: number;
    sourceCount: number;
    onExpand: () => void;
}

export const ReportPreviewCard: React.FC<ReportPreviewCardProps> = ({
    queryCount,
    sourceCount,
    onExpand,
}) => {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entry animation
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handlePress = () => {
        // Press animation
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.98,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onExpand();
        });
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.pressable,
                    pressed && { opacity: 0.9 },
                ]}
            >
                {/* Main Content Row */}
                <View style={styles.contentRow}>
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Feather name="file-text" size={22} color={theme.colors.primary} />
                    </View>
                    
                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Generate Research Report
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            {queryCount} queries • {sourceCount} sources analyzed
                        </Text>
                    </View>

                    {/* Arrow */}
                    <Feather name="chevron-right" size={20} color={theme.colors.textTertiary} />
                </View>

                {/* Token Warning */}
                <View style={[styles.warningContainer, { backgroundColor: theme.colors.warning + '10' }]}>
                    <Feather name="alert-circle" size={14} color={theme.colors.warning} />
                    <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                        Will use additional AI tokens to generate
                    </Text>
                </View>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 0,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    pressable: {
        padding: 14,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 3,
    },
    subtitle: {
        fontSize: 13,
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    warningText: {
        fontSize: 12,
        fontWeight: '500',
    },
});