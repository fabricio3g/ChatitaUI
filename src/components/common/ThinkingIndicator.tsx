/**
 * Thinking Indicator Component
 * Collapsible view for LLM reasoning with light theme
 */

import React, { useState, memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ThinkingIndicatorProps {
    content: string;
    isStreaming?: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
    content,
    isStreaming
}) => {
    const { theme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const lastContentRef = useRef(content);
    const lastStreamingRef = useRef(isStreaming);

    // Only animate on user toggle, not on content updates
    const handleToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    // Debug re-renders
    useEffect(() => {
        if (content !== lastContentRef.current) {
            console.log('[ThinkingIndicator] Content updated:', content.length, 'chars');
            lastContentRef.current = content;
        }
        if (isStreaming !== lastStreamingRef.current) {
            console.log('[ThinkingIndicator] Streaming changed:', isStreaming);
            lastStreamingRef.current = isStreaming;
        }
    });

    // Safety check - don't render if no content and not streaming
    if (!content && !isStreaming) return null;
    if (content.length === 0 && !isStreaming) return null;

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surfaceHighlight,
                borderColor: theme.colors.border,
            }
        ]}>
            <Pressable onPress={handleToggle} style={styles.header}>
                <Feather
                    name={isExpanded ? "chevron-down" : "chevron-right"}
                    size={14}
                    color={theme.colors.textSecondary}
                />
                <Text style={[styles.headerText, { color: theme.colors.textSecondary }]}>
                    {isStreaming ? "Thinking..." : "Thought Process"}
                </Text>
                {isStreaming && (
                    <View style={[styles.loadingDot, { backgroundColor: theme.colors.primary }]} />
                )}
            </Pressable>

            {isExpanded && (
                <View style={styles.content}>
                    <Text style={[
                        styles.thinkingText,
                        {
                            color: theme.colors.textSecondary,
                            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        }
                    ]}>
                        {content}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    headerText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
    },
    loadingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: 8,
    },
    content: {
        padding: 10,
        paddingTop: 0,
    },
    thinkingText: {
        fontSize: 13,
        lineHeight: 20,
        fontStyle: 'italic',
    },
});

// Export without memo to debug, we'll add it back once fixed
export default ThinkingIndicator;
