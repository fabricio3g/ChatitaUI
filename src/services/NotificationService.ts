import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically import expo-notifications to avoid SDK 53+ Expo Go warning
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
    try {
        Notifications = require('expo-notifications');
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
                priority: Notifications!.AndroidNotificationPriority.HIGH,
            }),
        });
    } catch (e) {
        console.warn('[Notifications] Failed to load expo-notifications:', e);
    }
}

export class NotificationService {
    static async requestPermissions() {
        if (isExpoGo || !Notifications) {
            console.warn('[Notifications] Expo Go detected or module not loaded; skipping permissions.');
            return false;
        }
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return false;
        }
        return true;
    }

    static async scheduleNotification(title: string, body: string, seconds: number = 1) {
        if (isExpoGo || !Notifications) {
            console.warn('[Notifications] Expo Go detected or module not loaded; skipping schedule.');
            return false;
        }
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) return false;

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
            },
            trigger: {
                // Compatible with time interval trigger
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: Math.max(1, seconds),
                channelId: 'default',
            } as any, // Type cast to avoid some strict TS issues with triggers
        });
        return true;
    }

    static async cancelAllNotifications() {
        if (!Notifications) return;
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
}
