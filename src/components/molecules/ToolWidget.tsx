import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ToolRenderType } from '../../services/tools/types';

interface ToolWidgetProps {
    type: ToolRenderType;
    data: any;
    onLinkPress?: (url: string) => void;
}

const ToolWidgetComponent: React.FC<ToolWidgetProps> = ({ type, data, onLinkPress }) => {
    const { theme } = useTheme();

    const CardContainer = ({ children }: { children: React.ReactNode }) => (
        <View style={[styles.cardWrapper, { borderColor: theme.colors.border }]}>
            {Platform.OS === 'ios' ? (
                <BlurView intensity={30} tint={theme.colors.background === '#FFFFFF' ? 'light' : 'dark'} style={[styles.cardBlur, { backgroundColor: theme.colors.surfaceHighlight }]}>
                    {children}
                </BlurView>
            ) : (
                <View style={[styles.cardBlur, { backgroundColor: theme.colors.surfaceHighlight }]}>
                    {children}
                </View>
            )}
        </View>
    );

    switch (type) {
        case 'notification': return (
            <CardContainer>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: theme.colors.primary + '20',
                        justifyContent: 'center', alignItems: 'center'
                    }}>
                        <Feather name="bell" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>REMINDER SCHEDULED</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                            {data.title}
                        </Text>
                        <Text style={{ color: theme.colors.textTertiary, fontSize: 11, marginTop: 1 }}>
                            In {data.seconds} seconds
                        </Text>
                    </View>
                </View>
            </CardContainer>
        );

        case 'error': return (
            <CardContainer>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: theme.colors.error + '20',
                        justifyContent: 'center', alignItems: 'center'
                    }}>
                        <Feather name="alert-triangle" size={20} color={theme.colors.error} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.colors.error, fontWeight: '700', fontSize: 14 }}>System Error</Text>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                            {data.error || "An unknown error occurred while executing this tool."}
                        </Text>
                    </View>
                </View>
            </CardContainer>
        );
        default:
            return null;
    }
};

export const ToolWidget = ToolWidgetComponent;

const styles = StyleSheet.create({
    cardWrapper: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        marginBottom: 8,
    },
    cardBlur: {
        padding: 16,
    },
});

