/**
 * Spacing system based on 4px base unit
 * Pure constants - consistent spacing across app
 */

const BASE_UNIT = 4;

export const Spacing = {
    xs: BASE_UNIT,      // 4px
    sm: BASE_UNIT * 2,  // 8px
    md: BASE_UNIT * 3,  // 12px
    lg: BASE_UNIT * 4,  // 16px
    xl: BASE_UNIT * 6,  // 24px
    xxl: BASE_UNIT * 8, // 32px
    xxxl: BASE_UNIT * 12, // 48px
} as const;

export type SpacingKey = keyof typeof Spacing;
