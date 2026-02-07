/**
 * Timer Tool
 * Sets timers that trigger alerts when complete
 */

import { Tool, ToolDefinition, ToolResponse } from './types';
import { Alert, Vibration } from 'react-native';

// Store active timers in memory
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

export class TimerTool implements Tool {
    definition: ToolDefinition = {
        name: 'set_timer',
        description: 'Set a timer. When the time is up, an alert will be shown. Note: Timer works while app is open.',
        renderType: 'timer',
        parameters: {
            type: 'object',
            properties: {
                duration: {
                    type: 'number',
                    description: 'Duration in seconds (e.g., 300 for 5 minutes)'
                },
                label: {
                    type: 'string',
                    description: 'Optional label for the timer (e.g., "Pizza ready")'
                }
            },
            required: ['duration']
        }
    };

    async execute(params: { duration: number; label?: string }): Promise<ToolResponse> {
        try {
            const label = params.label || 'Timer';
            const durationMs = params.duration * 1000;
            const timerId = `timer_${Date.now()}`;
            const endTime = new Date(Date.now() + durationMs);

            // Set the timer
            const timeout = setTimeout(() => {
                // Vibrate when timer completes
                try {
                    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
                } catch (e) {
                    // Vibration may not be available
                }

                Alert.alert(
                    '⏰ Timer Complete',
                    `${label}\n\nTime's up!`,
                    [{ text: 'OK', style: 'default' }]
                );

                activeTimers.delete(timerId);
            }, durationMs);

            activeTimers.set(timerId, timeout);

            const formattedDuration = this.formatDuration(params.duration);

            return {
                type: 'timer',
                content: `Timer set for ${formattedDuration}. You'll be alerted when it's done.`,
                data: {
                    timerId,
                    label,
                    durationSeconds: params.duration,
                    durationFormatted: formattedDuration,
                    endTime: endTime.toISOString(),
                    endTimeLocal: endTime.toLocaleTimeString(),
                    activeTimers: activeTimers.size
                }
            };
        } catch (error: any) {
            return {
                type: 'error',
                content: `Failed to set timer: ${error.message}`,
                data: { error: error.message }
            };
        }
    }

    private formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds} second${seconds !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts: string[] = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (secs > 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);

        return parts.join(', ');
    }

    // Cancel a timer by ID
    static cancelTimer(timerId: string): boolean {
        const timeout = activeTimers.get(timerId);
        if (timeout) {
            clearTimeout(timeout);
            activeTimers.delete(timerId);
            return true;
        }
        return false;
    }

    // Get count of active timers
    static getActiveCount(): number {
        return activeTimers.size;
    }
}
