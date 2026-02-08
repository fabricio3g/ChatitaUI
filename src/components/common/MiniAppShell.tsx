/**
 * MiniAppShell - Reusable shell for mini-apps
 * Provides consistent header, mode badge, and action buttons
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface MiniAppShellProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  mode: 'local' | 'api';
  children: React.ReactNode;
  actions?: {
    shareToChat?: () => void;
    primary?: {
      label: string;
      icon: string;
      onPress: () => void;
    };
  };
}

export const MiniAppShell: React.FC<MiniAppShellProps> = ({
  visible,
  onClose,
  title,
  icon,
  mode,
  children,
  actions,
}) => {
  const { theme, themeName } = useTheme();
  const insets = useSafeAreaInsets();

  const isLocal = mode === 'local';
  const modeColor = isLocal ? theme.colors.success : theme.colors.info;
  const modeBgColor = isLocal ? `${theme.colors.success}20` : `${theme.colors.info}20`;
  const isDark = themeName === 'monoDark' || themeName === 'forest' || themeName === 'sunset';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
    >
      {/* Main container - captures all touches to prevent passing through */}
      <View 
        className="flex-1 bg-bg"
        pointerEvents="auto"
      >
        {/* Header */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 100}
          tint={isDark ? 'dark' : 'light'}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              borderBottomWidth: 1,
            },
            {
              paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <View className="flex-row items-center justify-between px-3 py-2">
            {/* Close Button */}
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-xl bg-card"
              style={{ backgroundColor: theme.colors.surfaceHighlight }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={22} color={theme.colors.text} />
            </Pressable>

            {/* Title */}
            <View className="mx-3 flex-1 flex-row items-center justify-center gap-2">
              <Feather name={icon as any} size={18} color={theme.colors.primary} />
              <Text className="text-[17px] font-semibold text-fg" style={{ color: theme.colors.text }} numberOfLines={1}>
                {title}
              </Text>
            </View>

            {/* Mode Badge */}
            <View className="flex-row items-center gap-1 rounded-full px-2 py-1" style={{ backgroundColor: modeBgColor }}>
              <Feather
                name={isLocal ? 'cpu' : 'cloud'}
                size={12}
                color={modeColor}
              />
              <Text className="text-[11px] font-semibold" style={{ color: modeColor }}>
                {isLocal ? 'Local' : 'API'}
              </Text>
            </View>
          </View>
        </BlurView>

        {/* Content */}
        <View className="flex-1" style={{ paddingTop: 64 + insets.top }}>
          {children}
        </View>

        {/* Bottom Actions */}
        {(actions?.shareToChat || actions?.primary) && (
          <View
            className="flex-row items-center justify-center gap-3 border-t border-border bg-card px-4 pt-3"
            style={{
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            }}
          >
            {actions.primary && (
              <Pressable
                className="flex-row items-center gap-2 rounded-xl px-4 py-3"
                style={{ backgroundColor: theme.colors.surfaceHighlight }}
                onPress={actions.primary.onPress}
              >
                <Feather name={actions.primary.icon as any} size={18} color={theme.colors.text} />
                <Text className="text-[15px] font-semibold" style={{ color: theme.colors.text }}>
                  {actions.primary.label}
                </Text>
              </Pressable>
            )}
            
            {actions.shareToChat && (
              <Pressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl px-5 py-3"
                style={{ backgroundColor: theme.colors.primary }}
                onPress={actions.shareToChat}
              >
                <Feather name="message-square" size={18} color="#FFF" />
                <Text className="text-[15px] font-semibold text-white">Share to Chat</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

export default MiniAppShell;
