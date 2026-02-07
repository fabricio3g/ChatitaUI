/**
 * Color palette following purple/monochrome/golden design system
 * Pure constants - no side effects
 */

export const Colors = {
  // Purple (Primary)
  purple50: '#F5F3FF',
  purple100: '#EDE9FE',
  purple200: '#DDD6FE',
  purple300: '#C4B5FD',
  purple400: '#A78BFA',
  purple500: '#8B5CF6', // Main purple
  purple600: '#7C3AED',
  purple700: '#6D28D9',
  purple800: '#5B21B6',
  purple900: '#4C1D95',

  // Monochrome
  black: '#000000',
  gray900: '#111111',
  gray800: '#1F1F1F',
  gray700: '#2D2D2D',
  gray600: '#3D3D3D',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50: '#F9FAFB',
  white: '#FFFFFF',

  // Golden Yellow (Accent)
  gold50: '#FFFBEB',
  gold100: '#FEF3C7',
  gold200: '#FDE68A',
  gold300: '#FCD34D', // Main gold
  gold400: '#FBBF24',
  gold500: '#F59E0B',
  gold600: '#D97706',
  gold700: '#B45309',
  gold800: '#92400E',
  gold900: '#78350F',

  // Semantic colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Transparent overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
} as const;

export type ColorKey = keyof typeof Colors;
