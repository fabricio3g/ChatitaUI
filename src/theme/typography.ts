/**
 * Typography system
 * Pure constants - no side effects
 */

export const Typography = {
    // Font families
    fontFamily: {
        regular: 'Urbanist-Regular',
        medium: 'Urbanist-Medium',
        bold: 'Urbanist-Bold',
    },

    // Font sizes
    fontSize: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
    },

    // Font weights
    fontWeight: {
        normal: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },

    // Line heights
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },
} as const;

export type TypographyKey = keyof typeof Typography;
