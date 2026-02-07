/**
 * Edit Message Modal
 * Clean light theme edit modal
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface EditMessageModalProps {
    visible: boolean;
    initialContent: string;
    onSave: (newContent: string) => void;
    onCancel: () => void;
}

const { width } = Dimensions.get('window');

export const EditMessageModal: React.FC<EditMessageModalProps> = ({
    visible,
    initialContent,
    onSave,
    onCancel
}) => {
    const { theme } = useTheme();
    const [content, setContent] = useState(initialContent);

    useEffect(() => {
        if (visible) {
            setContent(initialContent);
        }
    }, [visible, initialContent]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
            >
                <View style={[
                    styles.container,
                    {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                    }
                ]}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Edit Message</Text>

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.colors.surfaceHighlight,
                                color: theme.colors.text,
                                borderColor: theme.colors.border,
                            }
                        ]}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        autoFocus
                        placeholder="Message content..."
                        placeholderTextColor={theme.colors.textTertiary}
                    />

                    <View style={styles.actions}>
                        <Pressable 
                            style={[styles.btn, { backgroundColor: theme.colors.surfaceHighlight }]} 
                            onPress={onCancel}
                        >
                            <Text style={[styles.btnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.btn, { backgroundColor: theme.colors.primary }]}
                            onPress={() => onSave(content)}
                        >
                            <Text style={[styles.btnText, { color: theme.colors.white }]}>Save</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: Math.min(width - 40, 500),
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    input: {
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 20,
        borderWidth: 1,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    btn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    btnText: {
        fontWeight: '600',
    },
});
