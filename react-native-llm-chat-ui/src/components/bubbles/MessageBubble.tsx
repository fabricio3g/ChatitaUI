import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Message, Theme } from '../../types';
import { MessageContent } from '../content/MessageContent';
import { defaultTheme } from '../../theme/defaultTheme';

interface MessageBubbleProps {
  message: Message;
  theme?: Partial<Theme>;
  isStreaming?: boolean;
  onCopy?: (text: string) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (id: string) => void;
  onLinkPress?: (url: string) => void;
  showThinking?: boolean;
}

const ThinkingBlock: React.FC<{
  content: string;
  isStreaming?: boolean;
  theme: Theme;
}> = ({ content, isStreaming, theme }) => {
  const [expanded, setExpanded] = useState(isStreaming);

  if (!content) return null;

  return (
    <View style={[styles.thinkingContainer, { borderColor: theme.colors.border }]}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.thinkingHeader}
      >
        <Feather
          name={expanded ? "chevron-down" : "chevron-right"}
          size={14}
          color={theme.colors.textSecondary}
        />
        <Text style={[styles.thinkingLabel, { color: theme.colors.textSecondary }]}>
          Thinking Process
        </Text>
        {isStreaming && (
          <View style={[styles.thinkingBadge, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.thinkingBadgeText, { color: theme.colors.primary }]}>Thinking</Text>
          </View>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.thinkingContent}>
          <Text style={[styles.thinkingText, { color: theme.colors.textSecondary }]}>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  theme: customTheme,
  isStreaming,
  onCopy,
  onEdit,
  onDelete,
  onLinkPress,
  showThinking = true,
}) => {
  const theme = { ...defaultTheme, ...customTheme };
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const fadeIn = !!message.metadata?.fadeIn && !isStreaming;
  const fadeAnim = useRef(new Animated.Value(fadeIn ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(fadeIn ? 6 : 0)).current;

  useEffect(() => {
    if (!fadeIn) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, fadeAnim, translateY]);

  const contentString = typeof message.content === 'string' ? message.content : '';
  const hasThinking = message.metadata?.thinking && message.metadata.thinking.length > 0;

  const handleCopy = () => {
    if (contentString.length > 0 && onCopy) {
      onCopy(contentString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={[styles.container, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.contentColumn, { alignItems: isUser ? 'flex-end' : 'flex-start' }]}>
        {isUser ? (
          <View style={[
            styles.userBubble,
            { backgroundColor: theme.colors.userBubble }
          ]}>
            <Text style={[styles.userText, { color: theme.colors.text }]}>
              {contentString}
            </Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.assistantContent,
              fadeIn && { opacity: fadeAnim, transform: [{ translateY }] }
            ]}
          >
            {showThinking && hasThinking && (
              <ThinkingBlock
                content={message.metadata?.thinking || ''}
                isStreaming={isStreaming && !contentString}
                theme={theme}
              />
            )}

            <MessageContent
              content={contentString}
              theme={theme}
              isStreaming={isStreaming}
              onLinkPress={onLinkPress}
            />
          </Animated.View>
        )}

        {!isStreaming && (
          <View style={[styles.actions, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
            {onEdit && (
              <Pressable onPress={() => onEdit(message)} style={styles.actionBtn}>
                <Feather name="edit-2" size={14} color={theme.colors.textSecondary} />
              </Pressable>
            )}

            <Pressable onPress={handleCopy} style={styles.actionBtn}>
              <Feather name={copied ? "check" : "copy"} size={14} color={theme.colors.textSecondary} />
            </Pressable>

            {onDelete && (
              <Pressable onPress={() => onDelete(message.id)} style={styles.actionBtn}>
                <Feather name="trash-2" size={14} color={theme.colors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantContent: {
    width: '100%',
    paddingRight: 40,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  actionBtn: {
    padding: 4,
  },
  thinkingContainer: {
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    gap: 6,
  },
  thinkingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  thinkingContent: {
    padding: 10,
    paddingTop: 4,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  thinkingText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
    opacity: 0.9,
  },
  thinkingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  thinkingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
