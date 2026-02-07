import React from 'react';
import { View, Text, Pressable, TextInput, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
    padContent?: boolean;
    icon?: keyof typeof Feather.glyphMap;
}

export const SettingsSection = ({ title, children, padContent, icon }: SettingsSectionProps) => {
    const { theme } = useTheme();
    return (
        <View className="mb-7">
            <View className="mb-3 flex-row items-center px-1">
                {icon && (
                    <View
                        className="mr-2.5 h-7 w-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${theme.colors.primary}15` }}
                    >
                        <Feather name={icon} size={14} color={theme.colors.primary} />
                    </View>
                )}
                <Text className="text-[13px] font-bold uppercase tracking-[0.8px]" style={{ color: theme.colors.primary }}>
                    {title}
                </Text>
            </View>
            <View
                className="overflow-hidden rounded-2xl border border-border bg-card"
                style={[padContent ? { padding: 16 } : null]}
            >
                {children}
            </View>
        </View>
    );
};


export const CompactInput = ({ label, value, onChangeText, placeholder, secure = false, keyboardType = 'default', multiline = false }:
    { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; secure?: boolean; keyboardType?: any; multiline?: boolean }) => {
    const { theme } = useTheme();
    return (
        <View className="mb-3">
            <Text className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.3px]" style={{ color: theme.colors.textSecondary }}>
                {label}
            </Text>
            <TextInput
                className="rounded-xl border border-border bg-panel px-3 text-[15px] font-medium text-fg"
                style={{
                    height: multiline ? 80 : 44,
                    paddingTop: multiline ? 12 : 0,
                }}
                value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.colors.textTertiary}
                secureTextEntry={secure} keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'}
            />
        </View>
    );
};

export const CompactSwitch = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (val: boolean) => void }) => {
    const { theme } = useTheme();
    return (
        <View className="flex-row items-center justify-between py-2">
            <Text className="text-[15px] font-medium" style={{ color: theme.colors.text }}>{label}</Text>
            <Switch value={value} onValueChange={onValueChange}
                trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                thumbColor={value ? theme.colors.primary : theme.colors.textTertiary}
            />
        </View>
    );
};

export const ChipSelector = ({ options, selected, onSelect }: { options: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void }) => {
    const { theme } = useTheme();
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map((opt) => (
                <Pressable key={opt.key} onPress={() => onSelect(opt.key)}
                    className={
                        selected === opt.key
                            ? "rounded-xl border border-primary bg-primary px-3.5 py-2"
                            : "rounded-xl border border-border bg-panel px-3.5 py-2"
                    }
                >
                    <Text className={selected === opt.key ? "text-[13px] font-semibold text-white" : "text-[13px] font-semibold text-fg"}>
                        {opt.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
};
