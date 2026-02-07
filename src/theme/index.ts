/**
 * Central theme export
 * Clean, minimalist design system with improved readability
 */

import { Typography } from './typography';

const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
} as const;

const borderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
} as const;

export const ThemeMap = {
    clean: {
        colors: {
            // Clean, professional light theme with excellent readability
            background: '#FFFFFF',
            surface: '#FFFFFF',
            surfaceHighlight: '#F8FAFC',
            primary: '#3B82F6', // Professional blue
            primaryForeground: '#FFFFFF',
            secondary: '#F1F5F9',
            text: '#0F172A', // High contrast dark text
            textSecondary: '#475569', // Good readability secondary text
            textTertiary: '#64748B', // Subtle but readable tertiary text
            border: '#E2E8F0',
            borderLight: '#F1F5F9',
            error: '#EF4444',
            success: '#10B981',
            warning: '#F59E0B',
            info: '#3B82F6',
            white: '#FFFFFF',
            black: '#000000',
            // Chat specific
            userBubble: '#F1F5F9',
            assistantBg: '#FFFFFF',
            inputBg: '#F8FAFC',
        },
        spacing,
        borderRadius,
        typography: Typography,
    },
    monoDark: {
        colors: {
            background: '#09090B',
            surface: '#18181B',
            surfaceHighlight: '#27272A',
            primary: '#FFFFFF',
            primaryForeground: '#000000',
            secondary: '#27272A',
            text: '#FAFAFA',
            textSecondary: '#A1A1AA',
            textTertiary: '#71717A',
            border: '#27272A',
            borderLight: '#3F3F46',
            error: '#EF4444',
            success: '#10B981',
            warning: '#F59E0B',
            info: '#3B82F6',
            white: '#FFFFFF',
            black: '#000000',
            // Chat specific
            userBubble: '#27272A',
            assistantBg: '#09090B',
            inputBg: '#18181B',
        },
        spacing,
        borderRadius,
        typography: Typography,
    },
    monoLight: {
        colors: {
            background: '#FAFAFA',
            surface: '#FFFFFF',
            surfaceHighlight: '#E5E7EB',
            primary: '#111111',
            primaryForeground: '#FFFFFF',
            secondary: '#E5E7EB',
            text: '#111111',
            textSecondary: '#6B7280',
            textTertiary: '#9CA3AF',
            border: '#E5E7EB',
            borderLight: '#F3F4F6',
            error: '#EF4444',
            success: '#10B981',
            warning: '#F59E0B',
            info: '#3B82F6',
            white: '#FFFFFF',
            black: '#000000',
            // Chat specific
            userBubble: '#F3F4F6',
            assistantBg: '#FFFFFF',
            inputBg: '#F9FAFB',
        },
        spacing,
        borderRadius,
        typography: Typography,
    },
    forest: {
        colors: {
            background: '#0B0F0C',
            surface: '#121914',
            surfaceHighlight: '#1A241D',
            primary: '#E5F5EA',
            primaryForeground: '#0B0F0C',
            secondary: '#1A241D',
            text: '#E7F6EC',
            textSecondary: '#98A69E',
            textTertiary: '#6B7A72',
            border: '#1F2A22',
            borderLight: '#2A3A30',
            error: '#EF4444',
            success: '#22C55E',
            warning: '#F59E0B',
            info: '#3B82F6',
            white: '#FFFFFF',
            black: '#000000',
            // Chat specific
            userBubble: '#1A241D',
            assistantBg: '#0B0F0C',
            inputBg: '#121914',
        },
        spacing,
        borderRadius,
        typography: Typography,
    },
    sunset: {
        colors: {
            background: '#100B0B',
            surface: '#1A1212',
            surfaceHighlight: '#251717',
            primary: '#FFE6D5',
            primaryForeground: '#100B0B',
            secondary: '#251717',
            text: '#FFEFE6',
            textSecondary: '#C7A59A',
            textTertiary: '#9A7B71',
            border: '#2A1D1A',
            borderLight: '#3D2A25',
            error: '#EF4444',
            success: '#F59E0B',
            warning: '#FBBF24',
            info: '#3B82F6',
            white: '#FFFFFF',
            black: '#000000',
            // Chat specific
            userBubble: '#251717',
            assistantBg: '#100B0B',
            inputBg: '#1A1212',
        },
        spacing,
        borderRadius,
        typography: Typography,
    },
} as const;

export type ThemeName = keyof typeof ThemeMap;
export type Theme = typeof ThemeMap[ThemeName];

// Default to clean light theme
export const Theme = ThemeMap.clean;

export { Typography };
export type { SpacingKey } from './spacing';
export type { TypographyKey } from './typography';
