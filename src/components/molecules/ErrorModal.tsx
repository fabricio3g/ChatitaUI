/**
 * Error Modal Component
 * Clean light theme modal for displaying errors
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface ErrorModalProps {
    visible: boolean;
    title?: string;
    message: string;
    onDismiss: () => void;
    onRetry?: () => void;
}

const { width } = Dimensions.get('window');

export const ErrorModal: React.FC<ErrorModalProps> = ({
    visible,
    title = 'Error',
    message,
    onDismiss,
    onRetry,
}) => {
    const { theme } = useTheme();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                <View style={[
                    styles.modalContainer,
                    {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                    }
                ]}>
                    <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.error}15` }]}>
                        <Feather name="alert-triangle" size={32} color={theme.colors.error} />
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>

                    <View style={styles.buttonContainer}>
                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: theme.colors.surfaceHighlight }
                            ]}
                            onPress={onDismiss}
                        >
                            <Text style={[styles.dismissButtonText, { color: theme.colors.text }]}>Dismiss</Text>
                        </Pressable>

                        {onRetry && (
                            <Pressable
                                style={[
                                    styles.button,
                                    { backgroundColor: theme.colors.error }
                                ]}
                                onPress={onRetry}
                            >
                                <Text style={styles.retryButtonText}>Retry</Text>
                            </Pressable>
                        )}
                    </View>
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
        width: Math.min(width - 48, 400),
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
            },
            android: {
                elevation: 8,
            },
        }),
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
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dismissButtonText: {
        fontWeight: '600',
        fontSize: 16,
    },
    retryButtonText: {
        color: '#FFFFFF', // White text on error button
        fontWeight: '600',
        fontSize: 16,
    },
});
