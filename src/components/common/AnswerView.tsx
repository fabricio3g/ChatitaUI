/**
 * Answer View Component
 * Rich markdown answer with inline citations
 */

import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useTheme } from '../../context/ThemeContext';

interface Source {
    id: number;
    title: string;
    url: string;
    domain: string;
}

interface AnswerViewProps {
    content: string;
    thinking?: string;
    isStreaming: boolean;
    sources: Source[];
    onCitationPress: (sourceId: number) => void;
}

// Simple markdown parser for inline rendering
const parseMarkdown = (text: string, onCitationPress: (id: number) => void, theme: any) => {
    const elements: React.ReactNode[] = [];

    // Split by citation pattern [1], [2], etc.
    const parts = text.split(/(\[\d+\])/g);

    parts.forEach((part, idx) => {
        // Check if it's a citation
        const citationMatch = part.match(/\[(\d+)\]/);
        if (citationMatch) {
            const num = parseInt(citationMatch[1]);
            elements.push(
                <Pressable
                    key={`cite-${idx}`}
                    style={[styles.citation, { backgroundColor: theme.colors.primary }]}
                    onPress={() => onCitationPress(num)}
                >
                    <Text style={[styles.citationText, { color: theme.colors.white }]}>{num}</Text>
                </Pressable>
            );
        } else if (part) {
            // Regular text - handle basic markdown
            let processedPart = part;

            // Bold **text**
            const boldParts = processedPart.split(/\*\*(.*?)\*\*/g);
            const textElements = boldParts.map((bp, bpIdx) => {
                if (bpIdx % 2 === 1) {
                    // Bold text
                    return <Text key={`bold-${idx}-${bpIdx}`} style={[styles.bold, { color: theme.colors.text }]}>{bp}</Text>;
                }
                return <Text key={`text-${idx}-${bpIdx}`}>{bp}</Text>;
            });

            elements.push(
                <Text key={`part-${idx}`} style={[styles.answerText, { color: theme.colors.text }]}>
                    {textElements}
                </Text>
            );
        }
    });

    return elements;
};

export const AnswerView: React.FC<AnswerViewProps> = ({
    content,
    thinking,
    isStreaming,
    sources,
    onCitationPress,
}) => {
    const { theme } = useTheme();

    // Parse content into sections
    const sections = useMemo(() => {
        const lines = content.split('\n');
        const result: { type: 'heading' | 'subheading' | 'paragraph' | 'list' | 'code'; content: string }[] = [];
        let currentParagraph = '';
        let inCode = false;
        let codeContent = '';

        lines.forEach((line) => {
            // Code block
            if (line.startsWith('```')) {
                if (inCode) {
                    result.push({ type: 'code', content: codeContent.trim() });
                    codeContent = '';
                }
                inCode = !inCode;
                return;
            }

            if (inCode) {
                codeContent += line + '\n';
                return;
            }

            // Heading H2
            if (line.startsWith('## ')) {
                if (currentParagraph) {
                    result.push({ type: 'paragraph', content: currentParagraph.trim() });
                    currentParagraph = '';
                }
                result.push({ type: 'heading', content: line.replace('## ', '') });
                return;
            }

            // Heading H3
            if (line.startsWith('### ')) {
                if (currentParagraph) {
                    result.push({ type: 'paragraph', content: currentParagraph.trim() });
                    currentParagraph = '';
                }
                result.push({ type: 'subheading', content: line.replace('### ', '') });
                return;
            }

            // List item
            if (line.match(/^[-*•] /)) {
                if (currentParagraph) {
                    result.push({ type: 'paragraph', content: currentParagraph.trim() });
                    currentParagraph = '';
                }
                result.push({ type: 'list', content: line.replace(/^[-*•] /, '') });
                return;
            }

            // Numbered list
            if (line.match(/^\d+\. /)) {
                if (currentParagraph) {
                    result.push({ type: 'paragraph', content: currentParagraph.trim() });
                    currentParagraph = '';
                }
                result.push({ type: 'list', content: line });
                return;
            }

            // Regular paragraph
            if (line.trim()) {
                currentParagraph += line + ' ';
            } else if (currentParagraph) {
                result.push({ type: 'paragraph', content: currentParagraph.trim() });
                currentParagraph = '';
            }
        });

        if (currentParagraph) {
            result.push({ type: 'paragraph', content: currentParagraph.trim() });
        }

        return result;
    }, [content]);

    // Check if thinking is likely a status message or actual reasoning
    // Status messages are short and usually lack newlines, e.g. "Searching the web..."
    const isStatus = thinking && (thinking.startsWith('Searching') || thinking.startsWith('Reading') || (thinking.length < 60 && !thinking.includes('\n')));

    // Helper to get icon based on status text
    const getStatusIcon = (text: string) => {
        if (!text) return 'loader';
        const t = text.toLowerCase();
        if (t.includes('search') || t.includes('checking')) return 'search';
        if (t.includes('reading') || t.includes('finding')) return 'book-open';
        if (t.includes('analyzing') || t.includes('synthesizing')) return 'cpu';
        return 'loader';
    };

    // Dynamic styles - monochrome theme
    const pillBg = 'rgba(128, 128, 128, 0.12)';
    const pillColor = theme.colors.textSecondary;

    return (
        <View style={styles.container}>
            {/* Status Message */}
            {thinking && isStatus && isStreaming && (
                <View style={[styles.thinkingContainer, { backgroundColor: pillBg }]}>
                    {getStatusIcon(thinking) === 'loader' ? (
                        <ActivityIndicator size="small" color={pillColor} />
                    ) : (
                        <Feather name={getStatusIcon(thinking) as any} size={14} color={pillColor} />
                    )}
                    <Text style={[styles.thinkingText, { color: pillColor }]} numberOfLines={1} ellipsizeMode="tail">
                        {thinking}
                    </Text>
                </View>
            )}

            {/* Reasoning Trace */}
            {thinking && (!isStatus || !isStreaming) && (
                <ThinkingIndicator content={thinking} isStreaming={isStreaming} />
            )}

            {/* If thinking exists and isStatus but NOT streaming (stuck?), show it? */}
            {thinking && isStatus && !isStreaming && (
                <ThinkingIndicator content={thinking} isStreaming={false} />
            )}

            {/* Answer content */}
            <View style={styles.answerContainer}>
                {sections.map((section, idx) => {
                    switch (section.type) {
                        case 'heading':
                            return (
                                <Text key={idx} style={[styles.heading, { color: theme.colors.text }]}>
                                    {section.content}
                                </Text>
                            );
                        case 'subheading':
                            return (
                                <Text key={idx} style={[styles.subheading, { color: theme.colors.text }]}>
                                    {section.content}
                                </Text>
                            );
                        case 'code':
                            return (
                                <View key={idx} style={[styles.codeBlock, { backgroundColor: theme.colors.surfaceHighlight }]}>
                                    <Text style={[styles.codeText, { color: theme.colors.text }]}>{section.content}</Text>
                                </View>
                            );
                        case 'list':
                            return (
                                <View key={idx} style={styles.listItem}>
                                    <Text style={[styles.listBullet, { color: theme.colors.textSecondary }]}>•</Text>
                                    <View style={styles.listContent}>
                                        {parseMarkdown(section.content.replace(/^\d+\. /, ''), onCitationPress, theme)}
                                    </View>
                                </View>
                            );
                        default:
                            return (
                                <View key={idx} style={styles.paragraph}>
                                    {parseMarkdown(section.content, onCitationPress, theme)}
                                </View>
                            );
                    }
                })}

                {/* Streaming cursor */}
                {isStreaming && (
                    <View style={[styles.cursor, { backgroundColor: theme.colors.textSecondary }]} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },
    thinkingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    thinkingText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    answerContainer: {
        paddingVertical: 8,
    },
    heading: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    subheading: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 6,
    },
    paragraph: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: 12,
    },
    answerText: {
        fontSize: 15,
        lineHeight: 24,
    },
    bold: {
        fontWeight: '700',
    },
    citation: {
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
        marginHorizontal: 2,
        marginVertical: -2,
    },
    citationText: {
        fontSize: 11,
        fontWeight: '700',
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingLeft: 4,
    },
    listBullet: {
        fontSize: 15,
        marginRight: 8,
        marginTop: 2,
    },
    listContent: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    codeBlock: {
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
    },
    codeText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        lineHeight: 20,
    },
    cursor: {
        width: 2,
        height: 16,
        marginLeft: 2,
        opacity: 0.8,
    },
});
