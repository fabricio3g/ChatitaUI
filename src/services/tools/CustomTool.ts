/**
 * Custom Tool
 * Executes user-defined API endpoints as tools
 */

import { Tool, ToolDefinition, ToolParameter } from './types';

export interface CustomToolConfig {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    endpoint: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    parameters: {
        name: string;
        type: ToolParameter['type'];
        description: string;
        required: boolean;
    }[];
    responseMapping?: {
        contentPath?: string; // JSONPath-like to extract content
    };
    ttsSpeakMessage?: string; // Custom TTS message when tool executes
}

export class CustomTool implements Tool {
    definition: ToolDefinition;
    private config: CustomToolConfig;

    constructor(config: CustomToolConfig) {
        this.config = config;

        // Build definition from config
        const properties: Record<string, ToolParameter> = {};
        const required: string[] = [];

        for (const param of config.parameters) {
            properties[param.name] = {
                type: param.type,
                description: param.description,
            };
            if (param.required) {
                required.push(param.name);
            }
        }

        this.definition = {
            name: config.name,
            description: config.description,
            parameters: {
                type: 'object',
                properties,
                required: required.length > 0 ? required : undefined,
            },
        };
    }

    async execute(params: Record<string, any>): Promise<any> {
        try {
            let url = this.config.endpoint;
            let body: string | undefined;

            if (this.config.method === 'GET') {
                // Append params as query string
                const queryParams = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                    queryParams.set(key, String(value));
                }
                url = `${url}?${queryParams.toString()}`;
            } else {
                // POST with JSON body
                body = JSON.stringify(params);
            }

            const response = await fetch(url, {
                method: this.config.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...this.config.headers,
                },
                body,
            });

            if (!response.ok) {
                return {
                    error: `API call failed with status ${response.status}`,
                    status: response.status,
                };
            }

            const data = await response.json();

            // Apply response mapping if configured
            if (this.config.responseMapping?.contentPath) {
                return this.extractPath(data, this.config.responseMapping.contentPath);
            }

            return data;

        } catch (error: any) {
            console.error(`[CustomTool:${this.config.name}] Error:`, error);
            return {
                error: 'Tool execution failed',
                details: error.message,
            };
        }
    }

    private extractPath(obj: any, path: string): any {
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return null;
            current = current[part];
        }
        return current;
    }

    getTTSMessage(): string | undefined {
        return this.config.ttsSpeakMessage;
    }
}
