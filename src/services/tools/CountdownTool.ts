/**
 * Countdown Tool
 * Calculate days until an event or date
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

// Common events with their dates (month, day)
const COMMON_EVENTS: Record<string, { month: number; day: number; name: string }> = {
    'christmas': { month: 12, day: 25, name: 'Christmas' },
    'new year': { month: 1, day: 1, name: 'New Year' },
    'newyear': { month: 1, day: 1, name: 'New Year' },
    'valentine': { month: 2, day: 14, name: "Valentine's Day" },
    'valentines': { month: 2, day: 14, name: "Valentine's Day" },
    'halloween': { month: 10, day: 31, name: 'Halloween' },
    'thanksgiving': { month: 11, day: 28, name: 'Thanksgiving' }, // Approximate
    'easter': { month: 4, day: 20, name: 'Easter' }, // Approximate
    'independence day': { month: 7, day: 4, name: 'Independence Day (US)' },
    'july 4': { month: 7, day: 4, name: 'July 4th' },
    'new years eve': { month: 12, day: 31, name: "New Year's Eve" },
    'st patricks': { month: 3, day: 17, name: "St. Patrick's Day" },
    'mothers day': { month: 5, day: 12, name: "Mother's Day" }, // Approximate
    'fathers day': { month: 6, day: 16, name: "Father's Day" }, // Approximate
};

export class CountdownTool implements Tool {
    definition: ToolDefinition = {
        name: 'countdown',
        description: 'Calculate days until an event or specific date. Supports common events (Christmas, New Year, Halloween, etc.) or specific dates.',
        renderType: 'countdown',
        parameters: {
            type: 'object',
            properties: {
                event: {
                    type: 'string',
                    description: 'Event name (e.g., "Christmas", "Halloween") or a date (e.g., "2025-12-25", "March 15")'
                }
            },
            required: ['event']
        }
    };

    async execute(params: { event: string }): Promise<ToolResponse> {
        try {
            const eventInput = params.event.toLowerCase().trim();
            let targetDate: Date;
            let eventName: string;

            // Check if it's a known event
            const knownEvent = COMMON_EVENTS[eventInput];
            if (knownEvent) {
                targetDate = this.getNextOccurrence(knownEvent.month, knownEvent.day);
                eventName = knownEvent.name;
            } else {
                // Try to parse as a date
                const parsed = this.parseDate(params.event);
                if (!parsed) {
                    return {
                        type: 'error',
                        content: `Could not understand "${params.event}" as a date or event. Try "Christmas", "2025-12-25", or "March 15".`,
                        data: { error: 'Invalid date/event' }
                    };
                }
                targetDate = parsed.date;
                eventName = parsed.name;
            }

            const now = new Date();
            now.setHours(0, 0, 0, 0);
            targetDate.setHours(0, 0, 0, 0);

            const diffMs = targetDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            let message: string;
            if (diffDays === 0) {
                message = `🎉 ${eventName} is TODAY!`;
            } else if (diffDays === 1) {
                message = `⏰ ${eventName} is TOMORROW!`;
            } else if (diffDays < 0) {
                message = `📅 ${eventName} was ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago.`;
            } else {
                message = `📅 ${diffDays} day${diffDays !== 1 ? 's' : ''} until ${eventName}`;
            }

            return {
                type: 'countdown',
                content: message,
                data: {
                    eventName,
                    targetDate: targetDate.toISOString(),
                    targetDateFormatted: targetDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }),
                    daysRemaining: diffDays,
                    isToday: diffDays === 0,
                    isPast: diffDays < 0
                }
            };
        } catch (error: any) {
            return {
                type: 'error',
                content: `Countdown failed: ${error.message}`,
                data: { error: error.message }
            };
        }
    }

    private getNextOccurrence(month: number, day: number): Date {
        const now = new Date();
        let year = now.getFullYear();

        let target = new Date(year, month - 1, day);

        // If the date has passed this year, use next year
        if (target < now) {
            target = new Date(year + 1, month - 1, day);
        }

        return target;
    }

    private parseDate(input: string): { date: Date; name: string } | null {
        const now = new Date();

        // Try ISO format (2025-12-25)
        const isoMatch = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
            return { date, name: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) };
        }

        // Try "Month Day" format
        const months: Record<string, number> = {
            'january': 0, 'jan': 0, 'february': 1, 'feb': 1, 'march': 2, 'mar': 2,
            'april': 3, 'apr': 3, 'may': 4, 'june': 5, 'jun': 5,
            'july': 6, 'jul': 6, 'august': 7, 'aug': 7, 'september': 8, 'sep': 8, 'sept': 8,
            'october': 9, 'oct': 9, 'november': 10, 'nov': 10, 'december': 11, 'dec': 11
        };

        const monthDayMatch = input.toLowerCase().match(/^([a-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
        if (monthDayMatch) {
            const monthName = monthDayMatch[1];
            const month = months[monthName];
            if (month !== undefined) {
                const day = parseInt(monthDayMatch[2]);
                const year = monthDayMatch[3] ? parseInt(monthDayMatch[3]) : now.getFullYear();
                const date = new Date(year, month, day);

                // If no year specified and date passed, use next year
                if (!monthDayMatch[3] && date < now) {
                    date.setFullYear(year + 1);
                }

                return { date, name: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) };
            }
        }

        // Try year only (e.g., "2027")
        const yearMatch = input.match(/^(\d{4})$/);
        if (yearMatch) {
            const date = new Date(parseInt(yearMatch[1]), 0, 1);
            return { date, name: `January 1, ${yearMatch[1]}` };
        }

        return null;
    }
}
