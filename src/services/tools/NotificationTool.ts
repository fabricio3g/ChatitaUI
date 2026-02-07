import { Tool, ToolDefinition, ToolResponse } from './types';
import { NotificationService } from '../NotificationService';

export class NotificationTool implements Tool {
    definition: ToolDefinition = {
        name: 'set_reminder',
        description: 'Schedule a system notification/reminder for the user. Use this when the user asks to be reminded of something.',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'The title of the notification (e.g., "Reminder")'
                },
                body: {
                    type: 'string',
                    description: 'The content/body of the reminder'
                },
                seconds: {
                    type: 'number',
                    description: 'How many seconds from now to trigger the notification'
                }
            },
            required: ['title', 'body', 'seconds']
        }
    };

    async execute(params: { title: string; body: string; seconds: number }): Promise<ToolResponse> {
        try {
            const success = await NotificationService.scheduleNotification(
                params.title,
                params.body,
                params.seconds
            );

            if (!success) {
                return {
                    type: 'error',
                    content: 'Failed to schedule notification. Permissions may not be granted.',
                    data: { error: 'Permission denied' }
                };
            }

            return {
                type: 'notification',
                content: `Reminder set: "${params.title} - ${params.body}" in ${params.seconds} seconds.`,
                data: { action: 'scheduled', ...params }
            };

        } catch (error: any) {
            return {
                type: 'error',
                content: `Error scheduling notification: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
