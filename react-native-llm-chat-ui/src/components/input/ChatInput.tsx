import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

const BW = {
  white: '#FFFFFF',
  black: '#000000',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray400: '#AAAAAA',
  gray600: '#666666',
};

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSend,
  onCancel,
  disabled,
  isStreaming,
  placeholder = 'Message...',
}) => {
  const hasText = value.trim().length > 0;
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = isFocused ? BW.black : BW.gray200;

  return (
    <View style={styles.wrapper}>
      <View style={[
        styles.container,
        { borderColor }
      ]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={BW.gray400}
          multiline
          maxLength={4000}
          editable={!disabled && !isStreaming}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        <View style={styles.rightActions}>
          {isStreaming ? (
            <Pressable
              style={styles.iconBtn}
              onPress={onCancel}
            >
              <View style={styles.stopSquare} />
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.iconBtn,
                !hasText && styles.iconBtnDisabled
              ]}
              onPress={onSend}
              disabled={disabled || !hasText}
            >
              <Feather
                name="arrow-up"
                size={20}
                color={hasText ? BW.black : BW.gray400}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BW.white,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    color: BW.black,
    paddingTop: 0,
    paddingBottom: 0,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: BW.black,
    borderRadius: 2,
  },
});
