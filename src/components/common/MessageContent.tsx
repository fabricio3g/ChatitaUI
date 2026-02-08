/**
 * MessageContent - Enhanced renderer with:
 * - HTML detection & preview (shows as code block with preview button)
 * - Full Markdown support via react-native-markdown-display
 * - LaTeX math support
 * - Code syntax highlighting
 */

import React, { useMemo, useState, useEffect, memo, useRef } from 'react';
import { View, Text, StyleSheet, Linking, Pressable, Dimensions } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../context/ThemeContext';
import { MathBubble } from '../ui/MathBubble';
import { CodeBlock } from './CodeBlock';
import { ToolWidget } from './ToolWidget';
import { ToolResponse } from '../../services/tools/types';
import { HtmlPreview } from './HtmlPreview';

interface MessageContentProps {
    content: string;
    textColor?: string;
    toolResponse?: ToolResponse;
    groupedToolResponses?: ToolResponse[];
    onLinkPress?: (url: string) => void;
    isStreaming?: boolean;
    isAssistant?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Check if content is HTML
const isHtmlContent = (content: string): boolean => {
    const trimmed = content.trim().toLowerCase();
    return (
        trimmed.startsWith('<!doctype html') ||
        trimmed.startsWith('<html') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<p>') ||
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<span') ||
        trimmed.startsWith('<b>') ||
        trimmed.startsWith('<i>') ||
        trimmed.startsWith('<strong') ||
        trimmed.startsWith('<em') ||
        (trimmed.includes('<') && trimmed.includes('>') &&
            (trimmed.includes('</div>') || trimmed.includes('</p>') || trimmed.includes('</span>')))
    );
};

// Extract code blocks from markdown for special handling
const extractCodeBlocks = (content: string): { text: string; codeBlocks: Map<string, { code: string; language?: string }> } => {
    const codeBlocks = new Map<string, { code: string; language?: string }>();
    let processedText = content;
    let blockIndex = 0;

    // Replace code blocks with placeholders
    processedText = processedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${blockIndex}__`;
        codeBlocks.set(placeholder, { code: code.trim(), language: lang });
        blockIndex++;
        // Wrap placeholder in backticks so it's parsed as a code block again
        // This triggers the code_block/fence render rule which finds the placeholder
        return "```\n" + placeholder + "\n```";
    });

    return { text: processedText, codeBlocks };
};

// Process LaTeX math for markdown renderer
const processMathForMarkdown = (content: string): { text: string; mathBlocks: Map<string, { latex: string; display: boolean }> } => {
    const mathBlocks = new Map<string, { latex: string; display: boolean }>();
    let processedText = content;
    let blockIndex = 0;

    // Handle display math $$...$$
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
        const placeholder = `__MATH_BLOCK_${blockIndex}__`;
        mathBlocks.set(placeholder, { latex: latex.trim(), display: true });
        blockIndex++;
        return placeholder;
    });

    // Handle inline math $...$
    processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
        const placeholder = `__INLINE_MATH_${blockIndex}__`;
        mathBlocks.set(placeholder, { latex: latex.trim(), display: false });
        blockIndex++;
        return placeholder;
    });

    return { text: processedText, mathBlocks };
};

export const MessageContent: React.FC<MessageContentProps> = ({
    content,
    textColor,
    toolResponse,
    groupedToolResponses,
    onLinkPress,
    isStreaming,
    isAssistant = false
}) => {
    const { theme } = useTheme();
    const defaultTextColor = textColor || theme.colors.text;

    // FAST PASS: Two-pass rendering for optimal streaming performance
    // Pass 1: Raw text (instant, no parsing)
    // Pass 2: Markdown parsing (throttled, smooth)
    const [shouldParseMarkdown, setShouldParseMarkdown] = useState(false);
    const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Clear any pending parse
        if (parseTimeoutRef.current) {
            clearTimeout(parseTimeoutRef.current);
        }

        if (isStreaming) {
            // During streaming: Show raw text, schedule Markdown parse
            // This gives instant feedback while keeping FPS smooth
            setShouldParseMarkdown(false);
            parseTimeoutRef.current = setTimeout(() => {
                setShouldParseMarkdown(true);
            }, 300); // Parse after 300ms of inactivity
        } else {
            // Streaming stopped: Parse immediately
            setShouldParseMarkdown(true);
        }

        return () => {
            if (parseTimeoutRef.current) {
                clearTimeout(parseTimeoutRef.current);
            }
        };
    }, [content, isStreaming]);

    // Detect content type based on raw content
    const contentType = useMemo(() => {
        if (!content) return 'empty';
        if (isHtmlContent(content)) return 'html';
        // Check if has markdown features
        if (content.match(/[#*``_\[\]\(\)]|\n\n|```|\$\$/)) return 'markdown';
        return 'text';
    }, [content]);

    const renderWebSources = (data: any, keyPrefix: string) => {
        const results = data?.results || data?.sources || [];
        const wiki = data?.wiki;
        const query = data?.query;

        if (!results.length && !wiki) return null;

        return (
            <View style={styles.webSources}>
                {query ? (
                    <Text style={[styles.webSourcesHeader, { color: defaultTextColor }]}>
                        Sources for: {query}
                    </Text>
                ) : (
                    <Text style={[styles.webSourcesHeader, { color: defaultTextColor }]}>
                        Sources
                    </Text>
                )}

                {wiki && (
                    <View style={styles.webSourceItem}>
                        <Text style={[styles.webSourceTitle, { color: defaultTextColor }]}>
                            {wiki.title}
                        </Text>
                        {wiki.url ? (
                            <Pressable onPress={() => (onLinkPress ? onLinkPress(wiki.url) : Linking.openURL(wiki.url))}>
                                <Text style={[styles.webSourceUrl, { color: defaultTextColor }]} numberOfLines={1}>
                                    {wiki.url}
                                </Text>
                            </Pressable>
                        ) : null}
                        {wiki.summary ? (
                            <Text style={[styles.webSourceSnippet, { color: defaultTextColor }]} numberOfLines={3}>
                                {wiki.summary}
                            </Text>
                        ) : null}
                    </View>
                )}

        {results.slice(0, 8).map((item: any, idx: number) => {
            const url = item.url || item.link || item.href || '';
            return (
            <View key={`${keyPrefix}_${idx}`} style={styles.webSourceItem}>
                <Pressable onPress={() => url && (onLinkPress ? onLinkPress(url) : Linking.openURL(url))}>
                    <Text style={[styles.webSourceTitle, { color: defaultTextColor }]} numberOfLines={1}>
                        {idx + 1}. {item.title || url}
                    </Text>
                </Pressable>
                {url ? (
                    <Pressable onPress={() => url && (onLinkPress ? onLinkPress(url) : Linking.openURL(url))}>
                        <Text style={[styles.webSourceUrl, { color: defaultTextColor }]} numberOfLines={1}>
                            {url}
                        </Text>
                    </Pressable>
                ) : null}
                {item.content ? (
                    <Text style={[styles.webSourceSnippet, { color: defaultTextColor }]} numberOfLines={2}>
                        {item.content}
                    </Text>
                ) : null}
            </View>
        )})}
    </View>
);
    };

    // During streaming, use raw content for instant rendering
    // After streaming or when shouldParseMarkdown is true, use full processing
    const useRawRendering = isStreaming && !shouldParseMarkdown;

    // Process content for markdown (skip if raw rendering)
    const { processedContent, codeBlocks, mathBlocks } = useMemo(() => {
        if (contentType !== 'markdown' || !content || useRawRendering) {
            return { processedContent: content || '', codeBlocks: new Map(), mathBlocks: new Map() };
        }

        let text = content;

        // Extract code blocks first
        const codeResult = extractCodeBlocks(text);
        text = codeResult.text;
        const codeBlocks = codeResult.codeBlocks;

        // Then process math
        const mathResult = processMathForMarkdown(text);
        text = mathResult.text;
        const mathBlocks = mathResult.mathBlocks;

        return { processedContent: text, codeBlocks, mathBlocks };
    }, [content, contentType, useRawRendering]);

    // Markdown styles
    const markdownStyles = useMemo(() => ({
        body: {
            color: defaultTextColor,
            fontSize: 15,
            lineHeight: 22,
        },
        paragraph: {
            marginTop: 0,
            marginBottom: 8,
        },
        heading1: {
            fontSize: 24,
            fontWeight: '700',
            color: defaultTextColor,
            marginTop: 16,
            marginBottom: 8,
        },
        heading2: {
            fontSize: 20,
            fontWeight: '600',
            color: defaultTextColor,
            marginTop: 14,
            marginBottom: 6,
        },
        heading3: {
            fontSize: 17,
            fontWeight: '600',
            color: defaultTextColor,
            marginTop: 12,
            marginBottom: 4,
        },
        list_item: {
            flexDirection: 'row',
            marginBottom: 4,
        },
        bullet_list_icon: {
            marginLeft: 0,
            marginRight: 8,
            color: defaultTextColor,
        },
        ordered_list_icon: {
            marginLeft: 0,
            marginRight: 8,
            color: defaultTextColor,
        },
        blockquote: {
            backgroundColor: theme.colors.surfaceHighlight,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
            paddingLeft: 12,
            paddingVertical: 4,
            marginVertical: 8,
        },
        link: {
            color: theme.colors.primary,
            textDecorationLine: 'underline',
        },
        code_inline: {
            backgroundColor: theme.colors.surfaceHighlight,
            fontFamily: 'monospace',
            fontSize: 13,
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 4,
            color: defaultTextColor,
        },
        code_block: {
            backgroundColor: 'transparent',
            padding: 0,
            marginVertical: 8,
        },
        fence: {
            backgroundColor: 'transparent',
            padding: 0,
            marginVertical: 8,
        },
        table: {
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginVertical: 8,
        },
        th: {
            backgroundColor: theme.colors.surfaceHighlight,
            padding: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        td: {
            padding: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
    }), [defaultTextColor, theme]);

    // Render HTML content as previewable code block
    if (contentType === 'html') {
        return (
            <View style={styles.container}>
                <HtmlPreview html={content} />
                {groupedToolResponses && groupedToolResponses.length > 0 ? (
                    groupedToolResponses.map((response: ToolResponse, idx: number) => {
                        if (response.type === 'web_card') {
                            return (
                                <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 12 }]}>
                                    {renderWebSources(response.data, `web_${idx}`)}
                                </View>
                            );
                        }
                        return (
                            <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 16 }]}>
                                <ToolWidget type={response.type} data={response.data} onLinkPress={onLinkPress} />
                            </View>
                        );
                    })
                ) : toolResponse && (
                    <View style={styles.toolWidget}>
                        {toolResponse.type === 'web_card'
                            ? renderWebSources(toolResponse.data, 'web_single')
                            : <ToolWidget type={toolResponse.type} data={toolResponse.data} onLinkPress={onLinkPress} />
                        }
                    </View>
                )}
            </View>
        );
    }

    // special performance fix: For web_card (Deep Search) with massive content, SKIP rendering the text
    // The content is only for the AI, users just see the widget.
    const shouldSkipTextRendering = useMemo(() => {
        // IMPORTANT: Never skip rendering for assistant messages (the text is the answer!)
        if (isAssistant) return false;

        if (!content) return false;

        // check single response
        if (toolResponse && toolResponse.type === 'web_card' && content.trim() === '') return true;

        // check grouped responses
        if (groupedToolResponses && groupedToolResponses.some(r => r.type === 'web_card') && content.trim() === '') return true;

        return false;
    }, [content, toolResponse, groupedToolResponses, isAssistant]);

    // Render Markdown content
    if (contentType === 'markdown') {
        if (shouldSkipTextRendering) {
            return (
                <View style={styles.container}>
                    {/* Skip Markdown render for performance */}
                    {groupedToolResponses && groupedToolResponses.length > 0 ? (
                        groupedToolResponses.map((response: ToolResponse, idx: number) => {
                            if (response.type === 'web_card') {
                                return (
                                    <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 12 }]}>
                                        {renderWebSources(response.data, `web_${idx}`)}
                                    </View>
                                );
                            }
                            return (
                                <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 16 }]}>
                                    <ToolWidget type={response.type} data={response.data} onLinkPress={onLinkPress} />
                                </View>
                            );
                        })
                    ) : toolResponse && (
                        <View style={styles.toolWidget}>
                            {toolResponse.type === 'web_card'
                                ? renderWebSources(toolResponse.data, 'web_single')
                                : <ToolWidget type={toolResponse.type} data={toolResponse.data} onLinkPress={onLinkPress} />
                            }
                        </View>
                    )}
                </View>
            );
        }

        // FAST PATH: During streaming, render raw text for instant feedback
        if (useRawRendering) {
            return (
                <View style={styles.container}>
                    <Text style={[styles.text, { color: defaultTextColor }]} selectable>
                        {content}
                    </Text>
                    {groupedToolResponses && groupedToolResponses.length > 0 ? (
                        groupedToolResponses.map((response: ToolResponse, idx: number) => (
                            <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 16 }]}>
                                <ToolWidget type={response.type} data={response.data} onLinkPress={onLinkPress} />
                            </View>
                        ))
                    ) : toolResponse && (
                        <View style={styles.toolWidget}>
                            <ToolWidget type={toolResponse.type} data={toolResponse.data} onLinkPress={onLinkPress} />
                        </View>
                    )}
                </View>
            );
        }

        // Custom renderers for special blocks
        const renderRules = {
            code_block: (node: any, children: any, parent: any, styles: any) => {
                const content = node.content;
                // Check if it's a placeholder
                if (content.includes('__CODE_BLOCK_')) {
                    const block = codeBlocks.get(content.trim());
                    if (block) {
                        return (
                            <View key={node.key} style={styles.codeBlock}>
                                <CodeBlock code={block.code} language={block.language} />
                            </View>
                        );
                    }
                }

                // Fallback for code blocks not caught by regex but parsed by markdown
                // content is the code itself
                // sourceInfo often contains the language
                const language = node.sourceInfo || 'plaintext';
                return (
                    <View key={node.key} style={styles.codeBlock}>
                        <CodeBlock code={content || ''} language={language} />
                    </View>
                );
            },
            fence: (node: any, children: any, parent: any, styles: any) => {
                // Fenced code blocks (```)
                const content = node.content;
                // Custom regex might have already replaced it with a placeholder if it matched
                if (content.includes('__CODE_BLOCK_')) {
                    const block = codeBlocks.get(content.trim());
                    if (block) {
                        return (
                            <View key={node.key} style={styles.codeBlock}>
                                <CodeBlock code={block.code} language={block.language} />
                            </View>
                        );
                    }
                }

                // Fallback: use node content and sourceInfo for language
                const language = node.sourceInfo || 'plaintext';
                return (
                    <View key={node.key} style={styles.codeBlock}>
                        <CodeBlock code={content || ''} language={language} />
                    </View>
                );
            },
            text: (node: any, children: any, parent: any, styles: any) => {
                const content = node.content;

                // Check for math placeholders
                if (content.includes('__MATH_BLOCK_') || content.includes('__INLINE_MATH_')) {
                    const parts = content.split(/(__(?:MATH_BLOCK|INLINE_MATH)_\d+__)/g);

                    return (
                        <View key={node.key} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                            {parts.map((part: string, index: number) => {
                                const mathMatch = part.match(/__(MATH_BLOCK|INLINE_MATH)_(\d+)__/);
                                if (mathMatch) {
                                    const placeholder = part;
                                    const mathBlock = mathBlocks.get(placeholder);
                                    if (mathBlock) {
                                        // Performance Optimization:
                                        // During streaming, avoid rendering heavy WebViews for math.
                                        // Just show the raw LaTeX until the message is complete.
                                        if (isStreaming) {
                                            return (
                                                <Text key={`${node.key}-${index}`} style={[styles.code_inline, { color: defaultTextColor, fontSize: 13 }]}>
                                                    {mathBlock.display ? `$$${mathBlock.latex}$$` : `$${mathBlock.latex}$`}
                                                </Text>
                                            );
                                        }

                                        return (
                                            <MathBubble
                                                key={`${node.key}-${index}`}
                                                latex={mathBlock.latex}
                                                inline={!mathBlock.display}
                                                textColor={defaultTextColor}
                                            />
                                        );
                                    }
                                }
                                return <Text key={`${node.key}-${index}`} style={styles.text}>{part}</Text>;
                            })}
                        </View>
                    );
                }

                return <Text key={node.key} style={styles.text}>{content}</Text>;
            },
        };

        return (
            <View style={styles.container}>
                <Markdown
                    style={markdownStyles as any}
                    rules={renderRules}
                    onLinkPress={(url: string) => {
                        if (onLinkPress) {
                            onLinkPress(url);
                        } else {
                            Linking.openURL(url);
                        }
                        return false;
                    }}
                >
                    {processedContent}
                </Markdown>

                {groupedToolResponses && groupedToolResponses.length > 0 ? (
                    groupedToolResponses.map((response: ToolResponse, idx: number) => {
                        if (response.type === 'web_card') {
                            return (
                                <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 12 }]}>
                                    {renderWebSources(response.data, `web_${idx}`)}
                                </View>
                            );
                        }
                        return (
                            <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 16 }]}>
                                <ToolWidget type={response.type} data={response.data} onLinkPress={onLinkPress} />
                            </View>
                        );
                    })
                ) : toolResponse && (
                    <View style={styles.toolWidget}>
                        {toolResponse.type === 'web_card'
                            ? renderWebSources(toolResponse.data, 'web_single')
                            : <ToolWidget type={toolResponse.type} data={toolResponse.data} onLinkPress={onLinkPress} />
                        }
                    </View>
                )}
            </View>
        );
    }

    // Fallback to simple text renderer for plain text
    return (
        <View style={styles.container}>
            <Text style={[styles.text, { color: defaultTextColor }]}>{content}</Text>

            {groupedToolResponses && groupedToolResponses.length > 0 ? (
                groupedToolResponses.map((response: ToolResponse, idx: number) => {
                    if (response.type === 'web_card') {
                        return (
                            <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 12 }]}>
                                {renderWebSources(response.data, `web_${idx}`)}
                            </View>
                        );
                    }
                    return (
                        <View key={`tool-${idx}`} style={[styles.toolWidget, idx > 0 && { marginTop: 16 }]}>
                            <ToolWidget type={response.type} data={response.data} onLinkPress={onLinkPress} />
                        </View>
                    );
                })
            ) : toolResponse && (
                <View style={styles.toolWidget}>
                    {toolResponse.type === 'web_card'
                        ? renderWebSources(toolResponse.data, 'web_single')
                        : <ToolWidget type={toolResponse.type} data={toolResponse.data} onLinkPress={onLinkPress} />
                    }
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingRight: 8,
    },
    text: {
        fontSize: 15,
        lineHeight: 22,
    },
    codeBlock: {
        width: '100%',
        marginVertical: 8,
    },
    mathBlock: {
        width: '100%',
        marginVertical: 8,
    },
    inlineMath: {
        marginHorizontal: 2,
    },
    toolWidget: {
        marginTop: 12,
        width: '100%',
    },
    webSources: {
        marginTop: 4,
        gap: 6,
    },
    webSourcesHeader: {
        fontSize: 12,
        fontWeight: '700',
    },
    webSourceItem: {
        gap: 2,
    },
    webSourceTitle: {
        fontSize: 13,
        fontWeight: '600',
    },
    webSourceUrl: {
        fontSize: 11,
        opacity: 0.75,
    },
    webSourceSnippet: {
        fontSize: 12,
        opacity: 0.85,
    },
});

// Memoized version for performance in lists
export const MemoizedMessageContent = memo(MessageContent, (prev, next) => {
    return (
        prev.content === next.content &&
        prev.textColor === next.textColor &&
        prev.toolResponse === next.toolResponse &&
        prev.groupedToolResponses === next.groupedToolResponses
    );
});

export default MessageContent;

