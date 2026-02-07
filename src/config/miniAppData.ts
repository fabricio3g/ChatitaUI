export const MINIAPP_DATA_SOURCES = {
  exercise: process.env.EXPO_PUBLIC_EXERCISE_DATA_URL || '',
  interview: process.env.EXPO_PUBLIC_INTERVIEW_DATA_URL || '',
  cooking: process.env.EXPO_PUBLIC_COOKING_DATA_URL || '',
  cacheTtlMs: 6 * 60 * 60 * 1000,
};

export const MINIAPP_DATA_VERSION = 1;
