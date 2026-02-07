import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Animated, TextStyle } from 'react-native';

interface TypingTextProps {
    text: string;
    isStreaming?: boolean;
    style?: TextStyle;
}

export const TypingText: React.FC<TypingTextProps> = ({ text, isStreaming = false, style }) => {
    // Blinking Cursor Animation
    const cursorOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isStreaming) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(cursorOpacity, {
                        toValue: 0.2,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(cursorOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            cursorOpacity.setValue(0); // Hide when done
        }
    }, [isStreaming]);

    return (
        <Text style={[style, styles.textBase]}>
            {text}
            {isStreaming && (
                <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
                    {' \u25CF'}
                </Animated.Text>
            )}
        </Text>
    );
};

const styles = StyleSheet.create({
    textBase: {
        // Base text styles if needed, but inheriting from props is better
    },
    cursor: {
        color: '#10B981', // Emerald Cursor
        fontSize: 16,
    }
});
