/**
 * Report Viewer Modal Component
 * Full-screen modal with smooth animations for viewing research reports
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { saveAndShareReport } from '../../services/ReportService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReportViewerModalProps {
    isVisible: boolean;
    onClose: () => void;
    content: string;
    title: string;
    isLoading?: boolean;
    onCancel?: () => void;
}

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
    isVisible,
    onClose,
    content,
    title,
    isLoading = false,
    onCancel,
}) => {
    const { theme } = useTheme();
    const [isSharing, setIsSharing] = useState(false);
    
    // Animation values
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const modalTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const modalScale = useRef(new Animated.Value(0.9)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const fabScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            // Open animation sequence
            Animated.parallel([
                // Fade in backdrop
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                // Slide up modal with spring
                Animated.spring(modalTranslateY, {
                    toValue: 0,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                // Scale modal
                Animated.spring(modalScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // Fade in content after modal opens
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
                
                // Pop in FAB buttons
                Animated.spring(fabScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 60,
                    useNativeDriver: true,
                }).start();
            });
        } else {
            // Close animation sequence
            Animated.parallel([
                Animated.timing(contentOpacity, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(fabScale, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(modalTranslateY, {
                    toValue: SCREEN_HEIGHT,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isVisible]);

    const handleShare = async () => {
        if (!content) return;
        
        setIsSharing(true);
        try {
            await saveAndShareReport(content, title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '.md');
        } catch (error) {
            Alert.alert(
                'Error',
                'Failed to share report. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setIsSharing(false);
        }
    };

    const handleClose = () => {
        // Animate out then call onClose
        Animated.parallel([
            Animated.timing(contentOpacity, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.spring(modalTranslateY, {
                toValue: SCREEN_HEIGHT,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    if (!isVisible && !isLoading) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop */}
            <Animated.View
                style={[
                    styles.backdrop,
                    {
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        opacity: backdropOpacity,
                    },
                ]}
            >
                <Pressable style={styles.backdropPressable} onPress={handleClose} />
            </Animated.View>

            {/* Modal Card */}
            <Animated.View
                style={[
                    styles.modal,
                    {
                        backgroundColor: theme.colors.background,
                        transform: [
                            { translateY: modalTranslateY },
                            { scale: modalScale },
                        ],
                    },
                ]}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                    <Pressable onPress={handleClose} style={styles.closeButton}>
                        <Feather name="x" size={24} color={theme.colors.text} />
                    </Pressable>

                    <View style={styles.headerTitleContainer}>
                        <Feather name="file-text" size={16} color={theme.colors.primary} />
                        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                            Research Report
                        </Text>
                    </View>

                    <View style={styles.placeholder} />
                </View>

                {/* Content */}
                <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.colors.primary} />
                            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                                Generating report...
                            </Text>
                            {onCancel && (
                                <Pressable
                                    onPress={onCancel}
                                    style={[styles.cancelButton, { borderColor: theme.colors.border }]}
                                >
                                    <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
                                        Cancel
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={styles.markdownContainer}>
                                {renderMarkdown(content, theme)}
                            </View>
                            
                            {/* Bottom padding for FAB */}
                            <View style={{ height: 100 }} />
                        </ScrollView>
                    )}
                </Animated.View>

                {/* Floating Action Buttons */}
                <Animated.View
                    style={[
                        styles.fabContainer,
                        {
                            transform: [{ scale: fabScale }],
                            opacity: fabScale,
                        },
                    ]}
                >
                    <Pressable
                        onPress={handleShare}
                        disabled={isSharing || isLoading}
                        style={[
                            styles.fab,
                            {
                                backgroundColor: theme.colors.primary,
                                opacity: isSharing || isLoading ? 0.6 : 1,
                            },
                        ]}
                    >
                        {isSharing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Feather name="download" size={20} color="#FFF" />
                                <Text style={styles.fabText}>Download</Text>
                            </>
                        )}
                    </Pressable>
                </Animated.View>
            </Animated.View>
        </View>
    );
};

/**
 * Parse inline markdown formatting (bold, italic, links)
 */
function parseInlineMarkdown(text: string, theme: any): React.ReactNode {
    if (!text) return text;
    
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    
    // Process the text to find markdown patterns
    while (remaining.length > 0) {
        let found = false;
        
        // Check for bold **text**
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/);
        if (boldMatch) {
            if (boldMatch[1]) {
                parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{boldMatch[1]}</Text>);
            }
            parts.push(
                <Text key={key++} style={[styles.bold, { color: theme.colors.text }]}>
                    {boldMatch[2]}
                </Text>
            );
            remaining = boldMatch[3];
            found = true;
            continue;
        }
        
        // Check for italic *text* (but not **)
        const italicMatch = remaining.match(/^(.*?)\*(?!\*)((?:[^*]|\*\*[^*]*\*\*)+?)\*(?!\*)(.*)$/);
        if (italicMatch) {
            if (italicMatch[1]) {
                parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{italicMatch[1]}</Text>);
            }
            parts.push(
                <Text key={key++} style={[styles.italic, { color: theme.colors.textSecondary }]}>
                    {italicMatch[2]}
                </Text>
            );
            remaining = italicMatch[3];
            found = true;
            continue;
        }
        
        // Check for links [text](url) - handle URLs with parentheses
        const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
        if (linkMatch) {
            if (linkMatch[1]) {
                parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{linkMatch[1]}</Text>);
            }
            parts.push(
                <Pressable key={key++} onPress={() => Linking.openURL(linkMatch[3])}>
                    <Text style={[styles.link, { color: theme.colors.primary }]}>
                        {linkMatch[2]}
                    </Text>
                </Pressable>
            );
            remaining = linkMatch[4];
            found = true;
            continue;
        }
        
        // Check for raw URLs
        const urlMatch = remaining.match(/^(.*?)(https?:\/\/[^\s]+)(.*)$/);
        if (urlMatch) {
            if (urlMatch[1]) {
                parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{urlMatch[1]}</Text>);
            }
            parts.push(
                <Pressable key={key++} onPress={() => Linking.openURL(urlMatch[2])}>
                    <Text style={[styles.link, { color: theme.colors.primary }]}>
                        {urlMatch[2]}
                    </Text>
                </Pressable>
            );
            remaining = urlMatch[3];
            found = true;
            continue;
        }
        
        // Check for inline code `code`
        const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
        if (codeMatch) {
            if (codeMatch[1]) {
                parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{codeMatch[1]}</Text>);
            }
            parts.push(
                <Text key={key++} style={[styles.inlineCode, { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surfaceHighlight 
                }]}>
                    {codeMatch[2]}
                </Text>
            );
            remaining = codeMatch[3];
            found = true;
            continue;
        }
        
        // No more markdown found
        if (!found) {
            parts.push(<Text key={key++} style={{ color: theme.colors.text }}>{remaining}</Text>);
            break;
        }
    }
    
    return parts;
}

/**
 * Simple markdown renderer for the report viewer
 */
function renderMarkdown(content: string, theme: any) {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Headers
        if (line.startsWith('# ')) {
            elements.push(
                <Text key={key++} style={[styles.h1, { color: theme.colors.text }]}>
                    {parseInlineMarkdown(line.substring(2), theme)}
                </Text>
            );
            i++;
        } else if (line.startsWith('## ')) {
            elements.push(
                <Text key={key++} style={[styles.h2, { color: theme.colors.text }]}>
                    {parseInlineMarkdown(line.substring(3), theme)}
                </Text>
            );
            i++;
        } else if (line.startsWith('### ')) {
            elements.push(
                <Text key={key++} style={[styles.h3, { color: theme.colors.text }]}>
                    {parseInlineMarkdown(line.substring(4), theme)}
                </Text>
            );
            i++;
        } else if (line.startsWith('#### ')) {
            elements.push(
                <Text key={key++} style={[styles.h4, { color: theme.colors.text }]}>
                    {parseInlineMarkdown(line.substring(5), theme)}
                </Text>
            );
            i++;
        }
        // Code blocks
        else if (line.startsWith('```')) {
            const codeLines: string[] = [];
            const lang = line.substring(3).trim();
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            elements.push(
                <View key={key++} style={[styles.codeBlock, { backgroundColor: theme.colors.surfaceHighlight }]}>
                    {lang && <Text style={[styles.codeLang, { color: theme.colors.textTertiary }]}>{lang}</Text>}
                    <Text style={[styles.codeText, { color: theme.colors.text }]}>
                        {codeLines.join('\n')}
                    </Text>
                </View>
            );
            i++; // Skip closing ```
        }
        // Blockquotes
        else if (line.startsWith('> ')) {
            elements.push(
                <View key={key++} style={[styles.blockquote, { borderLeftColor: theme.colors.primary }]}>
                    <Text style={[styles.blockquoteText, { color: theme.colors.textSecondary }]}>
                        {parseInlineMarkdown(line.substring(2), theme)}
                    </Text>
                </View>
            );
            i++;
        }
        // Bullet points
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            elements.push(
                <View key={key++} style={styles.bulletContainer}>
                    <Text style={[styles.bullet, { color: theme.colors.primary }]}>•</Text>
                    <Text style={[styles.bulletText, { color: theme.colors.text }]}>
                        {parseInlineMarkdown(line.substring(2), theme)}
                    </Text>
                </View>
            );
            i++;
        }
        // Numbered lists
        else if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s(.*)$/);
            if (match) {
                elements.push(
                    <View key={key++} style={styles.bulletContainer}>
                        <Text style={[styles.number, { color: theme.colors.primary }]}>
                            {match[1]}.
                        </Text>
                        <Text style={[styles.bulletText, { color: theme.colors.text }]}>
                            {parseInlineMarkdown(match[2], theme)}
                        </Text>
                    </View>
                );
            }
            i++;
        }
        // Horizontal rule
        else if (line === '---' || line === '***' || line === '___') {
            elements.push(
                <View key={key++} style={[styles.hr, { backgroundColor: theme.colors.border }]} />
            );
            i++;
        }
        // Empty lines
        else if (line.trim() === '') {
            elements.push(<View key={key++} style={{ height: 12 }} />);
            i++;
        }
        // Table header row
        else if (line.startsWith('|') && line.includes('---')) {
            elements.push(<View key={key++} style={styles.tableHeaderDivider} />);
            i++;
        }
        // Table header
        else if (line.startsWith('|') && lines[i + 1]?.includes('|---|')) {
            const headerCells = line.split('|').filter((c: string) => c.trim() !== '');
            elements.push(
                <View key={key++} style={styles.tableHeaderRow}>
                    {headerCells.map((cell: string, idx: number) => (
                        <Text key={idx} style={[styles.tableHeaderCell, { color: theme.colors.text }]}>
                            {cell.trim()}
                        </Text>
                    ))}
                </View>
            );
            i++; // Skip separator
        }
        // Table data rows
        else if (line.startsWith('|')) {
            const cells = line.split('|').filter((c: string) => c.trim() !== '');
            elements.push(
                <View key={key++} style={styles.tableRow}>
                    {cells.map((cell: string, idx: number) => (
                        <Text key={idx} style={[styles.tableCell, { color: theme.colors.text }]} numberOfLines={2}>
                            {cell.trim()}
                        </Text>
                    ))}
                </View>
            );
            i++;
        }
        // Regular paragraph with inline formatting
        else {
            elements.push(
                <Text key={key++} style={[styles.paragraph, { color: theme.colors.text }]}>
                    {parseInlineMarkdown(line, theme)}
                </Text>
            );
            i++;
        }
    }

    return elements;
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    backdropPressable: {
        flex: 1,
    },
    modal: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.9,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
    },
    markdownContainer: {
        gap: 0,
    },
    h1: {
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 16,
        marginTop: 12,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 24,
        letterSpacing: -0.3,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 20,
    },
    h4: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 16,
        color: '#444',
    },
    paragraph: {
        fontSize: 16,
        lineHeight: 26,
        marginBottom: 12,
        letterSpacing: 0.1,
    },
    codeBlock: {
        padding: 16,
        borderRadius: 10,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    codeText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    blockquote: {
        borderLeftWidth: 4,
        paddingLeft: 16,
        paddingVertical: 8,
        marginVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 0,
    },
    blockquoteText: {
        fontSize: 15,
        lineHeight: 24,
        fontStyle: 'italic',
        color: '#666',
    },
    bulletContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        paddingLeft: 4,
        alignItems: 'flex-start',
    },
    bullet: {
        fontSize: 18,
        marginRight: 12,
        lineHeight: 26,
        width: 8,
        textAlign: 'center',
    },
    number: {
        fontSize: 15,
        fontWeight: '600',
        marginRight: 12,
        lineHeight: 26,
        minWidth: 24,
        textAlign: 'right',
    },
    bulletText: {
        fontSize: 16,
        lineHeight: 26,
        flex: 1,
        letterSpacing: 0.1,
    },
    hr: {
        height: 1,
        marginVertical: 24,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    italic: {
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 26,
    },
    link: {
        fontSize: 16,
        textDecorationLine: 'underline',
        fontWeight: '500',
        color: '#3B82F6',
    },
    bold: {
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    tableHeaderDivider: {
        height: 2,
        backgroundColor: '#E5E5E5',
        marginVertical: 8,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#E5E5E5',
        marginBottom: 4,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        paddingHorizontal: 8,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        paddingHorizontal: 8,
    },
    inlineCode: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 5,
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    codeLang: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        flexDirection: 'row',
        gap: 12,
    },
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    fabText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    cancelButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '500',
    },
});