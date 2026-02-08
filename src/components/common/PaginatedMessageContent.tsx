/**
 * PaginatedMessageContent - Renders large messages in chunks for better performance
 * Automatically splits long messages (>2000 chars) into pages
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MemoizedMessageContent } from './MessageContent';
import { useTheme } from '../../context/ThemeContext';
import type { ToolResponse } from '../../services/tools/types';

interface Props {
    content: string;
    textColor?: string;
    toolResponse?: ToolResponse;
    groupedToolResponses?: ToolResponse[];
    onLinkPress?: (url: string) => void;
    isStreaming?: boolean;
    isAssistant?: boolean;
}

const CHARS_PER_PAGE = 2000; // Split messages over 2000 chars

export const PaginatedMessageContent: React.FC<Props> = ({
    content,
    textColor,
    toolResponse,
    groupedToolResponses,
    onLinkPress,
    isStreaming,
    isAssistant
}) => {
    const { theme } = useTheme();
    const [currentPage, setCurrentPage] = useState(0);

    // Split content into pages (only if not streaming and content is large)
    const pages = useMemo(() => {
        // Don't paginate during streaming
        if (isStreaming || !content) return [content];

        // Content is small enough, don't paginate
        if (content.length <= CHARS_PER_PAGE) return [content];

        // Split by paragraphs to avoid breaking mid-sentence
        const pages: string[] = [];
        let currentPage = '';

        // Split by double newlines (paragraphs)
        const paragraphs = content.split(/\n\n/);

        for (const paragraph of paragraphs) {
            const testPage = currentPage + (currentPage ? '\n\n' : '') + paragraph;

            if (testPage.length > CHARS_PER_PAGE && currentPage) {
                // Would exceed limit, start new page
                pages.push(currentPage);
                currentPage = paragraph;
            } else {
                currentPage = testPage;
            }
        }

        // Add last page
        if (currentPage) {
            pages.push(currentPage);
        }

        return pages.length > 0 ? pages : [content];
    }, [content, isStreaming]);

    const totalPages = pages.length;

    // If only one page, render normally
    if (totalPages === 1) {
        return (
            <MemoizedMessageContent
                content={content}
                textColor={textColor}
                toolResponse={toolResponse}
                groupedToolResponses={groupedToolResponses}
                onLinkPress={onLinkPress}
                isStreaming={isStreaming}
                isAssistant={isAssistant}
            />
        );
    }

    // Render paginated content
    return (
        <View style={styles.container}>
            {/* Current page */}
            <MemoizedMessageContent
                content={pages[currentPage]}
                textColor={textColor}
                toolResponse={currentPage === totalPages - 1 ? toolResponse : undefined}
                groupedToolResponses={currentPage === totalPages - 1 ? groupedToolResponses : undefined}
                onLinkPress={onLinkPress}
                isStreaming={isStreaming}
                isAssistant={isAssistant}
            />

            {/* Pagination controls */}
            <View style={[styles.pagination, { borderTopColor: theme.colors.border }]}>
                <Pressable
                    onPress={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
                    hitSlop={8}
                >
                    <Feather
                        name="chevron-left"
                        size={16}
                        color={currentPage === 0 ? theme.colors.border : theme.colors.textSecondary}
                    />
                </Pressable>

                <Text style={[styles.pageText, { color: theme.colors.textSecondary }]}>
                    Page {currentPage + 1} of {totalPages}
                    <Text style={{ fontSize: 11, opacity: 0.7 }}>
                        {' '}({pages[currentPage].length.toLocaleString()} chars)
                    </Text>
                </Text>

                <Pressable
                    onPress={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                    style={[styles.pageButton, currentPage === totalPages - 1 && styles.pageButtonDisabled]}
                    hitSlop={8}
                >
                    <Feather
                        name="chevron-right"
                        size={16}
                        color={currentPage === totalPages - 1 ? theme.colors.border : theme.colors.textSecondary}
                    />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 12,
        borderTopWidth: 1,
    },
    pageButton: {
        padding: 8,
    },
    pageButtonDisabled: {
        opacity: 0.3,
    },
    pageText: {
        fontSize: 13,
        fontWeight: '500',
    },
});

export default PaginatedMessageContent;
