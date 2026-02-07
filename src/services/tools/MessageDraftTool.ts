/**
 * MessageDraftTool
 * Creates mailto: or sms: links for the user to tap and open their mail/SMS app
 * No API key required - uses device's Linking capabilities
 */

import { Tool, ToolDefinition, ToolResponse } from './types';
import { Linking } from 'react-native';

export class MessageDraftTool implements Tool {
    definition: ToolDefinition = {
        name: 'draft_message',
        description: 'Create a draft email or SMS message. Returns a link the user can tap to open their mail or SMS app with the message pre-filled.',
        parameters: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    description: 'Message type: "email" or "sms"',
                    enum: ['email', 'sms']
                },
                to: {
                    type: 'string',
                    description: 'Recipient email address or phone number'
                },
                subject: {
                    type: 'string',
                    description: 'Email subject line (ignored for SMS)'
                },
                body: {
                    type: 'string',
                    description: 'Message body/content'
                }
            },
            required: ['type', 'body']
        }
    };

    async execute(params: { type: 'email' | 'sms'; to?: string; subject?: string; body: string }): Promise<ToolResponse> {
        try {
            const { type, to, subject, body } = params;
            let url: string;
            let displayText: string;

            if (type === 'email') {
                // Build mailto: URL - use encodeURIComponent (not URLSearchParams which uses + for spaces)
                const recipient = to ? encodeURIComponent(to) : '';
                const params: string[] = [];
                if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                
                const queryString = params.join('&');
                url = `mailto:${recipient}${queryString ? '?' + queryString : ''}`;
                
                displayText = to 
                    ? `Email draft to ${to}${subject ? `: "${subject}"` : ''}`
                    : `Email draft${subject ? `: "${subject}"` : ''}`;
            } else {
                // Build sms: URL
                const recipient = to ? encodeURIComponent(to) : '';
                // SMS body format varies by platform; most support ?body= or &body=
                const smsBody = body ? `?body=${encodeURIComponent(body)}` : '';
                url = `sms:${recipient}${smsBody}`;
                
                displayText = to 
                    ? `SMS draft to ${to}`
                    : 'SMS draft';
            }

            // Check if the URL can be opened (for Open button in widget)
            const canOpen = await Linking.canOpenURL(url);

            // Return a card widget with Copy + Open; do not auto-open
            return {
                type: 'message_draft',
                content: `${displayText}. Tap Copy to copy the text, or Open to open your ${type === 'email' ? 'mail' : 'SMS'} app.`,
                data: {
                    type,
                    to: to || null,
                    subject: subject || null,
                    body,
                    url,
                    canOpen: !!canOpen
                }
            };

        } catch (error: any) {
            console.error('[MessageDraftTool] Error:', error);
            return {
                type: 'error',
                content: `Failed to create message draft: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
