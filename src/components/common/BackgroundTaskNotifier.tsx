/**
 * Background Task Notifier
 * Shows notifications when background tasks complete
 * Works across all screens
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BackgroundTaskService, BackgroundTask } from '../../services/BackgroundTaskService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  onNavigateToConversation: (conversationId: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Notification {
  task: BackgroundTask;
  id: string;
  animation: Animated.Value;
}

export const BackgroundTaskNotifier: React.FC<Props> = ({
  onNavigateToConversation
}) => {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processedTaskIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Load already processed task IDs from AsyncStorage (persistent)
    const loadProcessedIds = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const notificationKeys = keys.filter(k => k.startsWith('notification_'));

        // Mark these as already processed
        notificationKeys.forEach(key => {
          const taskId = key.replace('notification_', '');
          processedTaskIds.current.add(taskId);
        });
      } catch (e) {
        console.error('[BackgroundTaskNotifier] Failed to load processed IDs:', e);
      }
    };

    loadProcessedIds();

    const unsubscribe = BackgroundTaskService.subscribe((tasks) => {
      // Find newly completed tasks (not already processed)
      const newlyCompleted = tasks.filter(
        t => (t.status === 'completed' || t.status === 'failed') &&
             !processedTaskIds.current.has(t.id)
      );

      newlyCompleted.forEach(task => {
        // Mark as processed immediately
        processedTaskIds.current.add(task.id);

        // Show notification
        showNotification(task);
      });
    });

    return () => {
      unsubscribe();
      // Clear all timeouts on unmount
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  const showNotification = (task: BackgroundTask) => {
    const id = `${task.id}_${Date.now()}`;
    const animation = new Animated.Value(0);

    // Remove any existing notifications for this task (prevent duplicates)
    setNotifications(prev => {
      const filtered = prev.filter(n => !n.id.startsWith(task.id));
      return [...filtered, { task, id, animation }];
    });

    // Animate in
    Animated.timing(animation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Schedule dismissal
    const dismissTime = task.status === 'completed' ? 4000 : 6000;
    const timeout = setTimeout(() => {
      dismissNotification(id);
    }, dismissTime);

    // Store timeout reference for cleanup
    timeoutRefs.current.set(id, timeout);
  };

  const dismissNotification = (id: string) => {
    // Clear timeout if exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    // Find and animate out
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (!notification) {
        // Already removed, just return
        return prev;
      }

      // Animate out then remove
      Animated.timing(notification.animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setNotifications(current => current.filter(n => n.id !== id));
      });

      return prev; // Keep in state until animation completes
    });
  };

  const handlePress = (notification: Notification) => {
    dismissNotification(notification.id);

    // Navigate if conversationId is valid
    if (notification.task.conversationId && notification.task.conversationId !== 'unknown') {
      onNavigateToConversation(notification.task.conversationId);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {notifications.map(notification => {
        const { task, id, animation } = notification;
        const isSuccess = task.status === 'completed';
        const icon = task.type === 'deep_research' ? 'globe' :
                     task.type === 'image_generation' ? 'image' : 'search';

        return (
          <Animated.View
            key={id}
            style={[
              styles.notification,
              {
                backgroundColor: theme.colors.surface,
                borderColor: isSuccess ? '#10B981' : '#EF4444',
                opacity: animation,
                transform: [
                  {
                    translateY: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, 0]
                    })
                  }
                ]
              }
            ]}
          >
            <Pressable onPress={() => handlePress(notification)} style={styles.content}>
              <View style={[
                styles.iconContainer,
                { backgroundColor: isSuccess ? '#10B98120' : '#EF444420' }
              ]}>
                <Feather
                  name={isSuccess ? icon : 'alert-circle'}
                  size={18}
                  color={isSuccess ? '#10B981' : '#EF4444'}
                />
              </View>

              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  {isSuccess
                    ? (task.type === 'deep_research' ? 'Research Complete' : 'Done')
                    : 'Failed'
                  }
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {task.query.substring(0, 25)}{task.query.length > 25 ? '...' : ''}
                </Text>
              </View>

              <Feather name="chevron-right" size={14} color={theme.colors.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => dismissNotification(id)}
              style={styles.closeButton}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={theme.colors.textSecondary} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 16,
    gap: 6,
  },
  notification: {
    width: '100%',
    maxWidth: SCREEN_WIDTH - 32,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
  },
});

export default BackgroundTaskNotifier;
