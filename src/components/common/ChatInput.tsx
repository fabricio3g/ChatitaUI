/**
 * ChatInput - Minimalist black & white design
 * No accent colors, no filled buttons, clean outline style
 */

import React, { useState } from 'react';
import {
    View,
    TextInput,
    Pressable,
    StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Props {
    value: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onCancel?: () => void;
    disabled?: boolean;
    isStreaming?: boolean;
    placeholder?: string;
    onMenuPress?: () => void;
    onDictationStart?: () => void;
    onDictationEnd?: () => void;
    isDictating?: boolean;
}

// Black & White color palette
const BW = {
    white: '#FFFFFF',
    black: '#000000',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray400: '#AAAAAA',
    gray600: '#666666',
};

export const ChatInput: React.FC<Props> = ({
    value,
    onChangeText,
    onSend,
    onCancel,
    disabled,
    isStreaming,
    placeholder = 'Message...',
    onMenuPress,
    onDictationStart,
    onDictationEnd,
    isDictating,
}) => {
    const hasText = value.trim().length > 0;
    const [isFocused, setIsFocused] = useState(false);

    // Determine border color based on focus
    const borderColor = isFocused ? BW.black : BW.gray200;

    return (
        <View style={styles.wrapper}>
            <View style={[
                styles.container,
                { borderColor }
            ]}>
                {/* Tool button - simple icon */}
                {onMenuPress ? (
                    <Pressable
                        style={styles.iconBtn}
                        onPress={onMenuPress}
                        disabled={disabled || isStreaming || !onMenuPress}
                    >
                        <Feather name="plus" size={20} color={BW.gray600} />
                    </Pressable>
                ) : null}

                {/* Input field */}
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={BW.gray400}
                    multiline
                    maxLength={4000}
                    editable={!disabled && !isStreaming}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />

                {/* Right actions */}
                <View style={styles.rightActions}>
                    {isStreaming ? (
                        /* Stop button during streaming */
                        <Pressable
                            style={styles.iconBtn}
                            onPress={onCancel}
                        >
                            <View style={styles.stopSquare} />
                        </Pressable>
                    ) : (
                        <>
                            {/* Dictation Button */}
                            <Pressable
                                style={[
                                    styles.iconBtn,
                                    isDictating && styles.iconBtnActive,
                                ]}
                                onPressIn={onDictationStart}
                                onPressOut={onDictationEnd}
                            >
                                <Feather
                                    name="mic"
                                    size={18}
                                    color={isDictating ? BW.black : BW.gray600}
                                />
                            </Pressable>

                            {/* Send button */}
                            <Pressable
                                style={[
                                    styles.iconBtn,
                                    !hasText && styles.iconBtnDisabled
                                ]}
                                onPress={onSend}
                                disabled={disabled || !hasText}
                            >
                                <Feather
                                    name="arrow-up"
                                    size={18}
                                    color={hasText ? BW.black : BW.gray400}
                                />
                            </Pressable>
                        </>
                    )}
                </View>
            </View>
            {/* No hint text - minimalist */}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,           // Less rounded (was 24)
        paddingHorizontal: 8,
        paddingVertical: 6,
        minHeight: 44,
        maxHeight: 120,
        borderWidth: 1,
        backgroundColor: BW.white,
    },
    iconBtn: {
        padding: 8,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBtnActive: {
        backgroundColor: BW.gray200,
    },
    iconBtnDisabled: {
        opacity: 0.4,
    },
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 20,
        color: BW.black,
        maxHeight: 100,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    stopSquare: {
        width: 12,
        height: 12,
        backgroundColor: BW.black,
        borderRadius: 2,
    },
    // No hint text styles - removed for minimalism
});

export default ChatInput;
