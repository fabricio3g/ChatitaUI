import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ToastProps {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    visible: boolean;
    onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', visible, onDismiss }) => {
    const translateY = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: Platform.OS === 'ios' ? 60 : 40,
                friction: 8,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => {
                handleDismiss();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            handleDismiss();
        }
    }, [visible]);

    const handleDismiss = () => {
        Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            if (visible) onDismiss();
        });
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return 'check-circle';
            case 'warning': return 'alert-triangle';
            case 'error': return 'x-circle';
            default: return 'info';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return '#10B981'; // Green-500
            case 'warning': return '#F59E0B'; // Amber-500
            case 'error': return '#EF4444'; // Red-500
            default: return '#3B82F6'; // Blue-500
        }
    };

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={handleDismiss} style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: `${getColor()}20` }]}>
                    <Feather name={getIcon()} size={20} color={getColor()} />
                </View>
                <Text style={styles.message} numberOfLines={2}>{message}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#18181B', // Zinc-900
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        maxWidth: width - 32,
        minWidth: Math.min(width - 32, 280),
        borderWidth: 1,
        borderColor: '#27272A',
        gap: 12,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        color: '#F4F4F5', // Zinc-100
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    }
});
