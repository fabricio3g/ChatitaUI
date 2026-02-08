import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export interface ToolActivityEvent {
  id: string;
  message: string;
  phase: 'start' | 'progress' | 'done' | 'error';
  kind: 'thinking' | 'tool' | 'web';
}

const iconFor = (event: ToolActivityEvent) => {
  if (event.phase === 'error') return 'alert-triangle';
  const lower = event.message.toLowerCase();
  if (event.kind === 'thinking') return 'cpu';
  if (lower.includes('wikipedia')) return 'book-open';
  if (lower.includes('search') || lower.includes('web') || lower.includes('google') || lower.includes('duckduckgo')) return 'globe';
  if (lower.includes('reading') || lower.includes('source')) return 'file-text';
  if (lower.includes('image')) return 'image';
  if (lower.includes('cache')) return 'database';
  return event.phase === 'done' ? 'check-circle' : 'loader';
};

const Row: React.FC<{ event: ToolActivityEvent; active: boolean }> = ({ event, active }) => {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const icon = iconFor(event);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: active ? theme.colors.primary + '40' : theme.colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Feather name={icon as any} size={14} color={active ? theme.colors.primary : theme.colors.textSecondary} />
      <Text style={[styles.text, { color: active ? theme.colors.text : theme.colors.textSecondary }]} numberOfLines={1}>
        {event.message}
      </Text>
    </Animated.View>
  );
};

export const ToolActivityFeed: React.FC<{ events: ToolActivityEvent[] }> = memo(({ events }) => {
  if (!events.length) return null;
  const last = events[events.length - 1];

  return (
    <View style={styles.container}>
      <Row event={last} active={last.phase !== 'done'} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  text: {
    marginLeft: 8,
    fontSize: 12,
    flex: 1,
  },
});

export default ToolActivityFeed;
