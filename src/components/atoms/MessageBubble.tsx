/**
 * MessageBubble - Clean design with icons for actions
 * User messages: Right-aligned with bubble
 * Assistant messages: Left-aligned with plain text
 * Supports: markdown, LaTeX, code blocks, tool widgets
 */

import React, { useState, useRef, memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../types/message';
import { MessageContent } from '../molecules/MessageContent';
import { ConfirmModal } from '../molecules/ConfirmModal';

interface VersionInfo {
    versions: Message[];
    currentVersion: number;
}

interface Props {
    message: Message;
    onEdit?: (msg: Message) => void;
    onDelete?: (id: string) => void;
    onRegenerate?: (id: string) => void;
    onVersionChange?: (parentId: string, version: number) => void;
    versionHistory?: VersionInfo;
    versionHistoryKey?: string;
    onLinkPress?: (url: string) => void;
    showReasoning?: boolean;
}

const ThinkingBlock: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming }) => {
    const { theme } = useTheme();
    const [expanded, setExpanded] = useState(isStreaming); // Auto-expand while streaming

    if (!content) return null;

    return (
        <View style={[styles.thinkingContainer, { borderColor: theme.colors.border }]}>
            <Pressable
                onPress={() => setExpanded(!expanded)}
                style={styles.thinkingHeader}
            >
                <Feather name={expanded ? "chevron-down" : "chevron-right"} size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.thinkingLabel, { color: theme.colors.textSecondary }]}>
                    Thinking Process
                </Text>
                {isStreaming && (
                    <View style={[styles.thinkingBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Text style={[styles.thinkingBadgeText, { color: theme.colors.primary }]}>Thinking</Text>
                    </View>
                )}
            </Pressable>

            {expanded && (
                <View style={styles.thinkingContent}>
                    <Text style={[styles.thinkingText, { color: theme.colors.textSecondary }]}>
                        {content}
                    </Text>
                </View>
            )}
        </View>
    );
};

export const MessageBubble: React.FC<Props> = ({
    message,
    onEdit,
    onDelete,
    onRegenerate,
    onVersionChange,
    versionHistory,
    versionHistoryKey,
    onLinkPress,
    showReasoning = true
}) => {
    const { theme } = useTheme();
    const [copied, setCopied] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const isUser = message.role === 'user';
    const isStreaming = message.metadata?.isStreaming;
    const fadeIn = !!message.metadata?.fadeIn && !isStreaming;
    const fadeAnim = useRef(new Animated.Value(fadeIn ? 0 : 1)).current;
    const translateY = useRef(new Animated.Value(fadeIn ? 6 : 0)).current;

    useEffect(() => {
        if (!fadeIn) return;
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
    }, [fadeIn, fadeAnim, translateY]);

    const hasVersions = versionHistory && versionHistory.versions.length > 1;
    const currentVersion = versionHistory?.currentVersion || 0;
    const totalVersions = versionHistory?.versions.length || 1;

    // Helper to safely get string content from message
    const getContentString = (): string => {
        if (typeof message.content === 'string') {
            return message.content;
        }
        return '';
    };

    const contentString = getContentString();

    const handleCopy = async () => {
        let textToCopy = contentString;

        // If message is empty but has a tool response, copy that instead
        if (textToCopy.length === 0 && toolResponse) {
            textToCopy = typeof toolResponse.content === 'string'
                ? toolResponse.content
                : JSON.stringify(toolResponse.content, null, 2);
        }

        if (textToCopy.length > 0) {
            await Clipboard.setStringAsync(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = () => {
        setShowDeleteModal(false);
        if (onDelete) {
            onDelete(message.id);
        }
    };

    const toolResponse = message.metadata?.toolResponse;
    const hasThinking = message.metadata?.thinking && message.metadata.thinking.length > 0;
    const hasGroupedTools = message.metadata?.groupedToolResponses && message.metadata.groupedToolResponses.length > 0;
    const isEmptyAssistant = !isUser && (!contentString || contentString.trim() === '') && !hasThinking && !isStreaming;

    // Get message preview for delete modal
    const getMessagePreview = () => {
        if (contentString) {
            return contentString.length > 60
                ? contentString.substring(0, 60) + '...'
                : contentString;
        }
        if (toolResponse) {
            return toolResponse.type === 'background_task'
                ? 'Background task results'
                : toolResponse.type;
        }
        if (hasGroupedTools) {
            const groupedToolCount = message.metadata?.groupedToolResponses?.length || 0;
            return `${groupedToolCount} tool result${groupedToolCount > 1 ? 's' : ''}`;
        }
        return 'This message';
    };

    return (
        <View style={[styles.container, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
            <View style={[styles.contentColumn, { alignItems: isUser ? 'flex-end' : 'flex-start' }]}>
                {/* Message content */}
                {isUser ? (
                    // User message: Bubble on the right
                    <View style={[
                        styles.userBubble,
                        { backgroundColor: theme.colors.primary }
                    ]}>
                        <Text style={styles.userText}>
                            {contentString}
                        </Text>
                    </View>
                ) : isEmptyAssistant && hasGroupedTools ? (
                    // Assistant message with only widgets, no text - render directly without bubble wrapper
                    <MessageContent
                        content={contentString}
                        textColor={theme.colors.text}
                        toolResponse={toolResponse}
                        groupedToolResponses={message.metadata?.groupedToolResponses}
                        onLinkPress={onLinkPress}
                        isStreaming={isStreaming}
                        isAssistant={true}
                    />
                ) : (
                    // Assistant message: Plain text on the left (with bubble wrapper)
                    <Animated.View
                        style={[
                            styles.assistantContent,
                            fadeIn && { opacity: fadeAnim, transform: [{ translateY }] }
                        ]}
                    >
                        {/* Thinking Process Display */}
                        {showReasoning && hasThinking && (
                            <ThinkingBlock
                                content={message.metadata?.thinking || ''}
                                isStreaming={isStreaming && !contentString}
                            />
                        )}

                        <MessageContent
                            content={contentString}
                            textColor={theme.colors.text}
                            toolResponse={toolResponse}
                            groupedToolResponses={message.metadata?.groupedToolResponses}
                            onLinkPress={onLinkPress}
                            isStreaming={isStreaming}
                            isAssistant={true}
                        />
                        {isStreaming && (
                            <View style={{ marginTop: 8, marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Image
                                    source={require('../../../assets/typing.gif')}
                                    style={{ width: 40, height: 40, resizeMode: 'contain' }}
                                />
                                <Text style={[styles.typingText, { color: theme.colors.textSecondary }]}>
                                    {message.metadata?.thinking !== undefined && !contentString
                                        ? "Reasoning..."
                                        : "Thinking..."}
                                </Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* Version navigation - BELOW the text for assistant messages with versions */}
                {hasVersions && onVersionChange && !isUser && (
                    <View style={[styles.versionNav, { alignSelf: 'flex-start' }]}>
                        <Pressable
                            onPress={() => versionHistoryKey && onVersionChange(versionHistoryKey, currentVersion - 1)}
                            disabled={currentVersion <= 0}
                            hitSlop={8}
                        >
                            <Feather
                                name="chevron-left"
                                size={16}
                                color={currentVersion <= 0 ? theme.colors.border : theme.colors.textSecondary}
                            />
                        </Pressable>
                        <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>
                            {currentVersion + 1} / {totalVersions}
                        </Text>
                        <Pressable
                            onPress={() => versionHistoryKey && onVersionChange(versionHistoryKey, currentVersion + 1)}
                            disabled={currentVersion >= totalVersions - 1}
                            hitSlop={8}
                        >
                            <Feather
                                name="chevron-right"
                                size={16}
                                color={currentVersion >= totalVersions - 1 ? theme.colors.border : theme.colors.textSecondary}
                            />
                        </Pressable>
                    </View>
                )}

                {/* Action buttons below */}
                {!isStreaming && (
                    <View style={[styles.actions, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
                        {/* Regenerate button for assistant messages */}
                        {onRegenerate && !isUser && (
                            <Pressable
                                onPress={() => onRegenerate(message.id)}
                                style={styles.actionBtn}
                                hitSlop={8}
                            >
                                <Feather name="refresh-cw" size={14} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}

                        {/* Edit button for ALL messages */}
                        {onEdit && (
                            <Pressable
                                onPress={() => onEdit(message)}
                                style={styles.actionBtn}
                                hitSlop={8}
                            >
                                <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}

                        <Pressable
                            onPress={handleCopy}
                            style={styles.actionBtn}
                            hitSlop={8}
                        >
                            <Feather name={copied ? "check" : "copy"} size={14} color={theme.colors.textSecondary} />
                        </Pressable>

                        {onDelete && (
                            <Pressable
                                onPress={handleDeleteClick}
                                style={styles.actionBtn}
                                hitSlop={8}
                            >
                                <Feather name="trash-2" size={14} color={theme.colors.textSecondary} />
                            </Pressable>
                        )}
                    </View>
                )}
            </View>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                visible={showDeleteModal}
                title="Delete Message?"
                message={`Are you sure you want to delete this message?\n\n"${getMessagePreview()}"`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDeleteModal(false)}
                type="danger"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    contentColumn: {
        flex: 1,
        flexDirection: 'column',
    },
    versionNav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 4,
    },
    versionText: {
        fontSize: 12,
        fontWeight: '500',
        minWidth: 35,
        textAlign: 'center',
    },
    // User message styles
    userBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderBottomRightRadius: 4,
    },
    userText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#fff',
    },
    // Assistant message styles
    assistantContent: {
        width: '100%',
        paddingRight: 40, // Leave space for actions
    },
    cursor: {
        opacity: 0.7,
        fontSize: 15,
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 8,
    },
    actionBtn: {
        padding: 4,
    },
    actionBtnActive: {
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
        opacity: 0.7,
    },
    // Thinking Block Styles
    thinkingContainer: {
        marginTop: 4,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
        borderLeftWidth: 4, // Accent on left
    },
    thinkingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(0,0,0,0.02)',
        gap: 6,
    },
    thinkingLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    thinkingContent: {
        padding: 10,
        paddingTop: 4,
        backgroundColor: 'rgba(0,0,0,0.01)',
    },
    thinkingText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'monospace', // Code-like font for reasoning
        opacity: 0.9,
    },
    thinkingBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 'auto',
    },
    thinkingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
});

// Memoized version for performance - only check essential fields
export const MemoizedMessageBubble = memo(MessageBubble, (prev, next) => {
    return (
        prev.message.id === next.message.id &&
        prev.message.content === next.message.content &&
        prev.message.metadata?.isStreaming === next.message.metadata?.isStreaming &&
        prev.message.metadata?.thinking === next.message.metadata?.thinking &&
        prev.showReasoning === next.showReasoning
    );
});

export default MessageBubble;
