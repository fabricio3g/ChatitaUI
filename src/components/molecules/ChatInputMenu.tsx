import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MiniAppRegistry } from './MiniAppRegistry';
import { MiniAppDefinition, DeviceTier } from './MiniAppTypes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;
const CLOSE_THRESHOLD = 150;

interface ChatInputMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (appId: string) => void;
  deviceTier: DeviceTier;
  isOnline: boolean;
}

export const ChatInputMenu: React.FC<ChatInputMenuProps> = ({
  visible,
  onClose,
  onSelect,
  deviceTier,
  isOnline,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pressedItem, setPressedItem] = useState<string | null>(null);

  // Animation values
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);

  const primaryApps = MiniAppRegistry.getPrimary();
  const secondaryApps = MiniAppRegistry.getSecondary();

  const openSheet = useCallback(() => {
    setPressedItem(null);
    Animated.parallel([
      Animated.spring(panY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panY, backdropOpacity]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.spring(panY, {
        toValue: SCREEN_HEIGHT,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPressedItem(null);
      onClose();
    });
  }, [panY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) {
      openSheet();
    } else {
      panY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      setPressedItem(null);
    }
  }, [visible, openSheet, panY, backdropOpacity]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Don't capture immediately, let ScrollView handle it
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if dragging down significantly and primarily vertical
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        panY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
          const progress = 1 - (gestureState.dy / CLOSE_THRESHOLD);
          backdropOpacity.setValue(Math.max(0, Math.min(1, progress)));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        if (gestureState.dy > CLOSE_THRESHOLD) {
          closeSheet();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            friction: 8,
            tension: 60,
            useNativeDriver: true,
          }).start();
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // When ScrollView takes over, reset dragging state
        setIsDragging(false);
        Animated.spring(panY, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminationRequest: () => true, // Allow ScrollView to take over when scrolling content
    })
  ).current;

  const handleSelect = (appId: string) => {
    setPressedItem(appId);
    setTimeout(() => {
      onSelect(appId);
      closeSheet();
    }, 150);
  };


  const renderAppItem = (app: MiniAppDefinition) => {
    const isAvailable = MiniAppRegistry.isAvailable(app.id, isOnline, deviceTier);
    const isPressed = pressedItem === app.id;

    return (
      <TouchableOpacity
        key={app.id}
        activeOpacity={0.7}
        onPress={() => isAvailable && handleSelect(app.id)}
        onPressIn={() => isAvailable && setPressedItem(app.id)}
        onPressOut={() => setPressedItem(null)}
        disabled={!isAvailable}
        delayPressIn={100}
        style={[
          styles.menuItem,
          {
            backgroundColor: isPressed ? theme.colors.surfaceHighlight : 'transparent',
            opacity: isAvailable ? 1 : 0.4,
          }
        ]}
      >
        <View style={[styles.iconContainer, { borderColor: theme.colors.border }]}>
          <Feather name={app.icon as any} size={20} color={theme.colors.text} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{app.label}</Text>
          <Text style={[styles.description, { color: theme.colors.textTertiary }]} numberOfLines={1}>
            {app.description}
          </Text>
        </View>

        {!isAvailable && <Feather name="lock" size={14} color={theme.colors.textTertiary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={closeSheet}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        {/* Backdrop - tap to close */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        {/* Sheet - captures all touches so they don't pass through to chat */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ translateY: panY }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
          pointerEvents="auto"
        >
          {/* Drag handle area - swipe down to close */}
          <View {...panResponder.panHandlers} style={styles.handleArea} pointerEvents="box-only">
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDragging}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Tools</Text>
            <View style={styles.appsList}>
              {primaryApps.map(renderAppItem)}
              <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: 12, opacity: 0.5 }]} />
              {secondaryApps.map(renderAppItem)}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SHEET_HEIGHT,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    // Larger touch target for easier drag-to-close
    minHeight: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 24,
    marginBottom: 8,
  },
  appsList: {
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    marginTop: 1,
  },
});

export default ChatInputMenu;
