/**
 * Streaming Text Component (Atom)
 * Displays text with animated cursor during streaming
 * Pure component - animation handled internally
 */

import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Theme } from '../../theme';

interface StreamingTextProps {
    text: string;
    isStreaming: boolean;
    style?: any;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
    text,
    isStreaming,
    style,
}) => {
    const [showCursor, setShowCursor] = useState(true);
    const [loadingFrame, setLoadingFrame] = useState(0);
    const loadingFrames = ['.', '..', '...'];

    useEffect(() => {
        if (!isStreaming) {
            setShowCursor(false);
            return;
        }

        const interval = setInterval(() => {
            setShowCursor((prev) => !prev);
            setLoadingFrame(prev => (prev + 1) % loadingFrames.length);
        }, 500);

        return () => clearInterval(interval);
    }, [isStreaming]);

    // ASCII Loader if streaming but no text
    if (isStreaming && !text) {
        return (
            <Text style={[styles.text, style]}>
                {loadingFrames[loadingFrame]}
            </Text>
        );
    }

    return (
        <Text style={[styles.text, style]}>
            {text}
            {isStreaming && showCursor && (
                <Text style={styles.cursor}>▊</Text>
            )}
        </Text>
    );
};

const styles = StyleSheet.create({
    text: {
        fontSize: 16,
        color: Theme.colors.white,
    },
    cursor: {
        color: Theme.colors.primary,
    },
});
