/**
 * Related Questions Component
 * Grid of follow-up question suggestions
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface RelatedQuestionsProps {
    questions: string[];
    onPress: (question: string) => void;
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
    questions,
    onPress,
}) => {
    const { theme } = useTheme();
    
    if (!questions.length) return null;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Feather name="help-circle" size={16} color={theme.colors.primary} />
                <Text style={[styles.headerTitle, { color: theme.colors.textSecondary }]}>Related Questions</Text>
            </View>

            {/* Questions List */}
            <View style={styles.questionsList}>
                {questions.map((question, idx) => (
                    <Pressable
                        key={idx}
                        style={({ pressed }) => [
                            styles.questionItem,
                            {
                                backgroundColor: theme.colors.surfaceHighlight,
                                borderColor: theme.colors.border,
                            },
                            pressed && { backgroundColor: theme.colors.border },
                        ]}
                        onPress={() => onPress(question)}
                    >
                        <Text style={[styles.questionText, { color: theme.colors.text }]} numberOfLines={2}>
                            {question}
                        </Text>
                        <Feather name="arrow-right" size={16} color={theme.colors.textSecondary} />
                    </Pressable>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    questionsList: {
        gap: 8,
    },
    questionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    questionText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
});
