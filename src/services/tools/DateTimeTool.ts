import { Tool, ToolDefinition, ToolResponse } from './types';

export class DateTimeTool implements Tool {
    definition: ToolDefinition = {
        name: 'get_date_time',
        description: 'Get current time, date, calendar info, or calculate time differences.',
        renderType: 'datetime_card',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['now', 'diff', 'calendar'],
                    description: 'Action to perform: current time, difference between dates, or calendar events.'
                },
                startDate: {
                    type: 'string',
                    description: 'Start date for diff (YYYY-MM-DD)'
                },
                endDate: {
                    type: 'string',
                    description: 'End date for diff (YYYY-MM-DD)'
                },
                timezone: {
                    type: 'string',
                    description: 'Target timezone (optional)'
                }
            },
            required: ['action']
        }
    };

    async execute(params: { action: string; startDate?: string; endDate?: string; timezone?: string }): Promise<ToolResponse> {
        try {
            const now = new Date();

            if (params.action === 'diff') {
                if (!params.startDate || !params.endDate) throw new Error('Start and End dates required for diff');

                const start = new Date(params.startDate);
                const end = new Date(params.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffYears = (diffDays / 365.25).toFixed(1);

                return {
                    type: 'datetime_card',
                    content: `Time between ${params.startDate} and ${params.endDate} is ${diffDays} days (approx ${diffYears} years).`,
                    data: {
                        mode: 'diff',
                        diffDays,
                        diffYears,
                        startDate: params.startDate,
                        endDate: params.endDate
                    }
                };
            }

            // Default: 'now' or 'calendar'
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Mock Calendar Events
            const events = [
                { id: '1', title: 'Deep Work Session', time: '10:00 AM' },
                { id: '2', title: 'Team Sync', time: '2:00 PM' }
            ];

            return {
                type: 'datetime_card',
                content: `Current Time: ${timeString}\nDate: ${dateString}`,
                data: {
                    mode: 'clock',
                    timestamp: now.getTime(),
                    timeString,
                    dateString,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    events: params.action === 'calendar' ? events : []
                }
            };

        } catch (error: any) {
            return {
                type: 'error',
                content: `Error getting date/time: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
