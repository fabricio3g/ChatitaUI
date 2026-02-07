/**
 * Detect if app is running in Expo Go (prebuilt client).
 * Release/standalone builds have appOwnership 'standalone' - native modules work.
 * Only Expo Go has appOwnership 'expo' or executionEnvironment 'storeClient'.
 */

import Constants from 'expo-constants';

export function isExpoGo(): boolean {
  try {
    if (!Constants) return false;
    if (Constants.appOwnership === 'expo') return true;
    if (Constants.executionEnvironment === 'storeClient') return true;
    return false;
  } catch {
    return false;
  }
}
