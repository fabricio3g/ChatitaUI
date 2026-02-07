/**
 * Status Modal Component
 * Reusable native-style modal for displaying success, error, and info states
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface StatusModalState {
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
}

interface StatusModalProps {
    visible: boolean;
    type?: 'success' | 'error' | 'info';
    title?: string;
    message?: string;
    onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export const StatusModal: React.FC<StatusModalProps> = ({
    visible,
    type = 'info',
    title,
    message,
    onDismiss,
}) => {
    const { theme } = useTheme();

    const getConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: 'check-circle',
                    color: theme.colors.success,
                    bg: `${theme.colors.success}15`,
                };
            case 'error':
                return {
                    icon: 'alert-triangle',
                    color: theme.colors.error,
                    bg: `${theme.colors.error}15`,
                };
            default:
                return {
                    icon: 'info',
                    color: theme.colors.primary,
                    bg: `${theme.colors.primary}15`,
                };
        }
    };

    const config = getConfig();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
                <View style={[styles.modalContainer, { 
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                }]}>
                    <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
                        <Feather name={config.icon as any} size={32} color={config.color} />
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>

                    <Pressable
                        style={[styles.button, { backgroundColor: theme.colors.surfaceHighlight }]}
                        onPress={onDismiss}
                    >
                        <Text style={[styles.buttonText, { color: theme.colors.text }]}>Close</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        width: Math.min(width - 48, 340),
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    button: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        fontWeight: '600',
        fontSize: 16,
    },
});
