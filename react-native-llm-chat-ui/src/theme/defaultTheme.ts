import { Theme } from '../types';

export const defaultTheme: Theme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#EEEEEE',
    primary: '#000000',
    userBubble: '#F5F5F5',
    assistantBubble: 'transparent',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};

export const darkTheme: Theme = {
  colors: {
    background: '#000000',
    surface: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    border: '#333333',
    primary: '#FFFFFF',
    userBubble: '#1A1A1A',
    assistantBubble: 'transparent',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
};
