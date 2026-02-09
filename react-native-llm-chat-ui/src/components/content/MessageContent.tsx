import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Theme } from '../../types';

interface MessageContentProps {
  content: string;
  theme: Theme;
  isStreaming?: boolean;
  onLinkPress?: (url: string) => void;
}

export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  theme,
  isStreaming,
  onLinkPress,
}) => {
  const handleLinkPress = (url: string) => {
    if (onLinkPress) {
      onLinkPress(url);
      return false;
    }
    Linking.openURL(url).catch(() => {
      console.warn('Failed to open URL:', url);
    });
    return false;
  };

  const markdownStyles = {
    body: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 24,
    },
    paragraph: {
      marginVertical: 8,
      color: theme.colors.text,
    },
    link: {
      color: theme.colors.primary,
      textDecorationLine: 'underline' as const,
    },
    code_inline: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    code_block: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    list_item: {
      marginVertical: 4,
    },
    heading1: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      marginVertical: 12,
      color: theme.colors.text,
    },
    heading2: {
      fontSize: 20,
      fontWeight: 'bold' as const,
      marginVertical: 10,
      color: theme.colors.text,
    },
    heading3: {
      fontSize: 18,
      fontWeight: 'bold' as const,
      marginVertical: 8,
      color: theme.colors.text,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.border,
      paddingLeft: 12,
      marginVertical: 8,
      fontStyle: 'italic' as const,
    },
  };

  return (
    <View>
      <Markdown
        style={markdownStyles}
        onLinkPress={handleLinkPress}
      >
        {content}
      </Markdown>
      {isStreaming && (
        <Text style={[styles.cursor, { color: theme.colors.primary }]}>▊</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cursor: {
    fontSize: 16,
    lineHeight: 24,
  },
});
