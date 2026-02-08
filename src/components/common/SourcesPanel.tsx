/**
 * Sources Panel Component
 * Collapsible panel showing numbered sources with favicon and snippets
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface Source {
    id: number;
    title: string;
    url: string;
    domain: string;
    snippet: string;
}

interface SourcesPanelProps {
    sources: Source[];
    wiki?: {
        title: string;
        summary: string;
        url: string;
    };
    expanded: boolean;
    onToggle: () => void;
    onSourcePress: (source: Source) => void;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
    sources,
    wiki,
    expanded,
    onToggle,
    onSourcePress,
}) => {
    const { theme } = useTheme();
    
    const getFaviconUrl = (domain: string) => {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    };

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: theme.colors.surfaceHighlight,
                borderColor: theme.colors.border,
            }
        ]}>
            {/* Header */}
            <Pressable style={styles.header} onPress={onToggle}>
                <View style={styles.headerLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}15` }]}>
                        <Feather name="layers" size={14} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Sources</Text>
                    <View style={[styles.badge, { backgroundColor: theme.colors.border }]}>
                        <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>{sources.length}</Text>
                    </View>
                </View>
                <Feather
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textSecondary}
                />
            </Pressable>

            {/* Expanded Content */}
            {expanded && (
                <View style={styles.content}>
                    {/* Wikipedia (if available) */}
                    {wiki && (
                        <Pressable
                            style={[
                                styles.wikiCard,
                                {
                                    backgroundColor: `${theme.colors.primary}08`,
                                    borderLeftColor: theme.colors.primary,
                                }
                            ]}
                            onPress={() => onSourcePress({
                                id: 0,
                                title: wiki.title,
                                url: wiki.url,
                                domain: 'wikipedia.org',
                                snippet: wiki.summary,
                            })}
                        >
                            <View style={styles.wikiHeader}>
                                <Image
                                    source={{ uri: 'https://www.wikipedia.org/favicon.ico' }}
                                    style={styles.favicon}
                                />
                                <Text style={[styles.wikiTitle, { color: theme.colors.text }]}>{wiki.title}</Text>
                                <View style={[styles.wikiBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
                                    <Feather name="book" size={10} color={theme.colors.primary} />
                                </View>
                            </View>
                            <Text style={[styles.wikiSummary, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                {wiki.summary}
                            </Text>
                        </Pressable>
                    )}

                    {/* Source List */}
                    {sources.map((source) => (
                        <Pressable
                            key={source.id}
                            style={styles.sourceItem}
                            onPress={() => onSourcePress(source)}
                        >
                            <View style={[styles.sourceNumber, { backgroundColor: theme.colors.border }]}>
                                <Text style={[styles.sourceNumberText, { color: theme.colors.textSecondary }]}>{source.id}</Text>
                            </View>
                            <Image
                                source={{ uri: getFaviconUrl(source.domain) }}
                                style={styles.favicon}
                            />
                            <View style={styles.sourceContent}>
                                <Text style={[styles.sourceTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                    {source.title}
                                </Text>
                                <Text style={[styles.sourceDomain, { color: theme.colors.textSecondary }]}>
                                    {source.domain}
                                </Text>
                            </View>
                            <Feather name="external-link" size={14} color={theme.colors.textSecondary} />
                        </Pressable>
                    ))}
                </View>
            )}

            {/* Collapsed Preview */}
            {!expanded && (
                <View style={styles.collapsedPreview}>
                    {sources.slice(0, 4).map((source) => (
                        <Pressable
                            key={source.id}
                            style={[styles.previewItem, { backgroundColor: theme.colors.border }]}
                            onPress={() => onSourcePress(source)}
                        >
                            <Image
                                source={{ uri: getFaviconUrl(source.domain) }}
                                style={styles.previewFavicon}
                            />
                        </Pressable>
                    ))}
                    {sources.length > 4 && (
                        <View style={[styles.previewMore, { backgroundColor: theme.colors.border }]}>
                            <Text style={[styles.previewMoreText, { color: theme.colors.textSecondary }]}>+{sources.length - 4}</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    wikiCard: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 3,
    },
    wikiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    wikiTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    wikiBadge: {
        padding: 4,
        borderRadius: 6,
    },
    wikiSummary: {
        fontSize: 13,
        lineHeight: 18,
    },
    sourceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
    },
    sourceNumber: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sourceNumberText: {
        fontSize: 10,
        fontWeight: '700',
    },
    favicon: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    sourceContent: {
        flex: 1,
    },
    sourceTitle: {
        fontSize: 13,
        fontWeight: '500',
    },
    sourceDomain: {
        fontSize: 11,
        marginTop: 2,
    },
    collapsedPreview: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingBottom: 14,
        gap: 8,
    },
    previewItem: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewFavicon: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    previewMore: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewMoreText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
