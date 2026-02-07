/**
 * Code Block Component
 * Clean code display with copy functionality
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';

import SyntaxHighlighter from 'react-native-syntax-highlighter';
import tomorrow from 'react-syntax-highlighter/dist/styles/hljs/tomorrow';

interface CodeBlockProps {
    code: string;
    language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const { theme } = useTheme();

    const handleCopy = async () => {
        await Clipboard.setStringAsync(code);
    };

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: '#F7F7F8',
                borderColor: theme.colors.border,
            }
        ]}>
            <View style={[
                styles.header,
                {
                    backgroundColor: '#F0F0F1',
                    borderBottomColor: theme.colors.border,
                }
            ]}>
                <Text style={[styles.languageText, { color: theme.colors.textSecondary }]}>
                    {language || 'CODE'}
                </Text>
                <Pressable onPress={handleCopy} style={styles.copyButton}>
                    <Feather name="copy" size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.copyText, { color: theme.colors.textSecondary }]}>Copy</Text>
                </Pressable>
            </View>
            <View style={styles.codeWrapper}>
                <SyntaxHighlighter
                    language={language?.toLowerCase() || 'plaintext'}
                    style={tomorrow}
                    highlighter="hljs"
                    CodeTag={Text}
                    PreTag={View}
                    customStyle={{
                        padding: 12,
                        backgroundColor: '#F7F7F8',
                        fontSize: 13,
                        lineHeight: 20,
                        fontFamily: 'monospace',
                    }}
                >
                    {code.trim()}
                </SyntaxHighlighter>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    languageText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    copyText: {
        fontSize: 12,
    },
    codeWrapper: {
        backgroundColor: '#F7F7F8',
    },
});
