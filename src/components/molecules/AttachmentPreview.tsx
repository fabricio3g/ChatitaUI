/**
 * AttachmentPreview
 * Shows attached files before sending a message
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Attachment } from '../../types/document';

interface AttachmentPreviewProps {
    attachments: Attachment[];
    onRemove: (id: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
    attachments,
    onRemove,
}) => {
    const { theme } = useTheme();

    if (attachments.length === 0) return null;

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getDocIcon = (mimeType: string): string => {
        if (mimeType.includes('pdf')) return 'file-text';
        if (mimeType.includes('word') || mimeType.includes('docx')) return 'file';
        return 'file-text';
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            {attachments.map((attachment) => (
                <View
                    key={attachment.id}
                    style={[styles.attachmentCard, { backgroundColor: theme.colors.surface }]}
                >
                    {attachment.type === 'image' ? (
                        <Image source={{ uri: attachment.uri }} style={styles.imageThumb} />
                    ) : (
                        <View style={[styles.docIcon, { backgroundColor: '#EF444420' }]}>
                            <Feather
                                name={getDocIcon(attachment.mimeType) as any}
                                size={20}
                                color="#EF4444"
                            />
                        </View>
                    )}
                    <View style={styles.info}>
                        <Text
                            style={[styles.name, { color: theme.colors.text }]}
                            numberOfLines={1}
                        >
                            {attachment.name}
                        </Text>
                        <Text style={[styles.size, { color: theme.colors.textSecondary }]}>
                            {formatSize(attachment.size)}
                        </Text>
                    </View>
                    <Pressable
                        style={[styles.removeBtn, { backgroundColor: theme.colors.background }]}
                        onPress={() => onRemove(attachment.id)}
                        hitSlop={10}
                    >
                        <Feather name="x" size={14} color={theme.colors.textSecondary} />
                    </Pressable>
                </View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        maxHeight: 80,
    },
    content: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    attachmentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 4,
        paddingRight: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
        maxWidth: 200,
    },
    imageThumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    docIcon: {
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 10,
        marginRight: 8,
    },
    name: {
        fontSize: 13,
        fontWeight: '500',
    },
    size: {
        fontSize: 11,
        marginTop: 2,
    },
    removeBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AttachmentPreview;
