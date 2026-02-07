/**
 * Tool Simulator for Models Without Native Tool Support
 * Simulates tool calling by formatting tools as text and parsing responses
 */

import { Message } from '../../types/message';
import { ToolRegistry } from '../tools/ToolRegistry';

interface SimulatedToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export class ToolSimulator {
    private static instance: ToolSimulator;

    static getInstance(): ToolSimulator {
        if (!ToolSimulator.instance) {
            ToolSimulator.instance = new ToolSimulator();
        }
        return ToolSimulator.instance;
    }

    /**
     * Inject tool instructions into the system message
     */
    /**
     * Inject tool instructions into the system message
     */
    injectToolInstructions(messages: Message[], tools: any[], format: 'compact' | 'xml' = 'xml'): Message[] {
        if (tools.length === 0) return messages;

        const toolInstructions = format === 'compact'
            ? this.getCompactToolInstructions(tools)
            : this.formatToolsAsInstructions(tools);

        // Find system message or create one
        const systemIndex = messages.findIndex(m => m.role === 'system');

        if (systemIndex >= 0) {
            const newMessages = [...messages];
            // Avoid duplicate injection
            if (!newMessages[systemIndex].content?.includes(format === 'compact' ? '[TOOLS]' : '[TOOLS AVAILABLE]')) {
                newMessages[systemIndex] = {
                    ...newMessages[systemIndex],
                    content: `${newMessages[systemIndex].content}\n\n${toolInstructions}`
                };
            }
            return newMessages;
        } else {
            // Add system message at the beginning
            return [{
                id: 'sys_tool_sim_' + Date.now(),
                conversationId: 'sys',
                role: 'system',
                content: toolInstructions,
                timestamp: Date.now(),
            }, ...messages];
        }
    }

    /**
     * Format tools as natural language instructions
     */
    private formatToolsAsInstructions(tools: any[]): string {
        const toolList = tools.map(tool => {
            const params = tool.parameters?.properties || {};
            const required = tool.parameters?.required || [];

            const paramDescriptions = Object.entries(params)
                .map(([name, schema]: [string, any]) => {
                    const isRequired = required.includes(name);
                    return `    - ${name}${isRequired ? ' (required)' : ''}: ${schema.description || 'No description'}`;
                })
                .join('\n');

            return `### ${tool.name}
Description: ${tool.description || 'No description'}
Parameters:
${paramDescriptions || '    No parameters'}

To use this tool, respond with:
<tool>${tool.name}</tool>
<parameters>
${Object.keys(params).map(p => `  "${p}": "value"`).join(',\n')}
</parameters>`;
        }).join('\n\n');

        return `[TOOLS AVAILABLE]
You have access to the following tools. When you need to use a tool, respond ONLY with the tool call format below, then wait for the result.

${toolList}

[IMPORTANT]
- If you need to use a tool, respond ONLY with the tool call format shown above
- Do not add any other text when calling a tool
- Wait for the tool result before continuing
- If no tool is needed, respond normally without using the format`;
    }

    /**
     * Format tools as compact natural language instructions (Token Efficient)
     * Format: tool_name(param: type) - Description
     */
    getCompactToolInstructions(tools: any[]): string {
        const toolList = tools.map(tool => {
            const params = tool.parameters?.properties || {};
            const paramList = Object.entries(params)
                .map(([name, schema]: [string, any]) => `${name}`)
                .join(', ');

            return `- ${tool.name}(${paramList}): ${tool.description}`;
        }).join('\n');

        return `[TOOLS]\nYou have access to the following tools. To use a tool, you MUST use this exact format:\n\nname(param="value")\n\n${toolList}\n\n[CRITICAL INSTRUCTIONS]\n- When you need to use a tool, output ONLY the tool call in the exact format shown above.\n- DO NOT write any explanatory text like "I will call" or "Let me check".\n- DO NOT write any introductions or conclusions.\n- Output ONLY the tool call, then STOP and wait for the result.\n- Example: weather(location="New York")\n- BAD: "I'll check the weather for you: weather(location="New York")"\n- GOOD: "weather(location="New York")"`;
    }

    /**
     * Parse tool calls from model response
     * Supports multiple formats: XML-style tags, JSON blocks, and Compact Function calls
     */
    parseToolCalls(content: string): { toolCalls: SimulatedToolCall[]; remainingContent: string } {
        const toolCalls: SimulatedToolCall[] = [];
        let remainingContent = content;

        // 1. Try Compact Format: name(param="value", param2=123)
        // Regex looks for: word( ... ) 
        // We allow it to be embedded in text, but let's try to be reasonably strict to avoid false positives.
        // Match: [Start/Space/Newline] Name ( Args ) [End/Space/Newline]
        const compactPattern = /(?:^|\s|\n)([a-zA-Z0-9_]+)\((.*?)\)(?=$|\s|\n)/g;

        // We only match if it looks like a known tool from registry to avoid false positives?
        // No, let's capture potential calls and filter later if needed, or rely on distinct format.
        // To be safer, let's require it to be on its own line or clearly distinguished.

        let match;
        // Reset lastIndex if we were using it, but we are creating new regex

        // We iterate manually to handle replacements correctly
        const matches = [...content.matchAll(compactPattern)];

        for (const m of matches) {
            const fullMatch = m[0];
            const name = m[1];
            const argsStr = m[2];

            // Verify if it's a likely tool call (simple heuristic: contains key=value or just values)
            // Or just check if name matches a known tool? 
            // For now, let's trust the model if it matches the pattern strict enough.

            try {
                // Parse arguments: key="value", key=123
                // We'll convert to JSON string for the standard interface
                const args: Record<string, any> = {};

                // Simple regex to extract key=value pairs. 
                // Handles quotes: key="val ue" or key='val' or key=123
                const argPattern = /([a-zA-Z0-9_]+)=("|'|)(.*?)\2(?:,|$)/g;
                let argMatch;
                let hasArgs = false;

                // If argsStr is just a JSON object "{...}"
                if (argsStr.trim().startsWith('{') && argsStr.trim().endsWith('}')) {
                    const parsed = JSON.parse(argsStr);
                    Object.assign(args, parsed);
                    hasArgs = true;
                } else {
                    while ((argMatch = argPattern.exec(argsStr)) !== null) {
                        const key = argMatch[1];
                        const val = argMatch[3];
                        // Try to infer number/boolean
                        if (val === 'true') args[key] = true;
                        else if (val === 'false') args[key] = false;
                        else if (!isNaN(Number(val)) && val !== '') args[key] = Number(val);
                        else args[key] = val;
                        hasArgs = true;
                    }
                }

                if (hasArgs || argsStr.trim() === '') {
                    toolCalls.push({
                        id: `sim_${Date.now()}_${toolCalls.length}`,
                        type: 'function',
                        function: {
                            name,
                            arguments: JSON.stringify(args)
                        }
                    });
                    remainingContent = remainingContent.replace(fullMatch, '').trim();
                }
            } catch (e) {
                // Ignore parse errors, treat as text
            }
        }

        // 2. Try XML-style format: <tool>name</tool><parameters>{...}</parameters>
        const xmlPattern = /<tool>([^<]+)<\/tool>\s*<parameters>([\s\S]*?)<\/parameters>/g;
        while ((match = xmlPattern.exec(remainingContent)) !== null) {
            try {
                const name = match[1].trim();
                const argsStr = match[2].trim();
                let args: string;
                try {
                    JSON.parse(argsStr);
                    args = argsStr;
                } catch {
                    const pairs: Record<string, string> = {};
                    argsStr.split('\n').forEach(line => {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex > 0) {
                            const key = line.substring(0, colonIndex).trim().replace(/["']/g, '');
                            const value = line.substring(colonIndex + 1).trim().replace(/["']/g, '');
                            if (key && value) pairs[key] = value;
                        }
                    });
                    args = JSON.stringify(pairs);
                }
                toolCalls.push({
                    id: `sim_${Date.now()}_${toolCalls.length}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: args
                    }
                });
                remainingContent = remainingContent.replace(match[0], '').trim();
            } catch (e) { }
        }

        // 3. Try JSON parsing (legacy)
        const jsonBlockPattern = /```(?:json)?\s*\n?\s*{\s*["']tool["']\s*:\s*["']([^"']+)["']\s*,\s*["']parameters["']\s*:\s*({[\s\S]*?})\s*}\s*\n?```/g;
        while ((match = jsonBlockPattern.exec(remainingContent)) !== null) {
            try {
                toolCalls.push({
                    id: `sim_${Date.now()}_${toolCalls.length}`,
                    type: 'function',
                    function: {
                        name: match[1].trim(),
                        arguments: match[2].trim()
                    }
                });
                remainingContent = remainingContent.replace(match[0], '').trim();
            } catch (e) { }
        }

        return { toolCalls, remainingContent };
    }

    /**
     * Check if content contains any tool calls
     */
    hasToolCalls(content: string): boolean {
        const { toolCalls } = this.parseToolCalls(content);
        return toolCalls.length > 0;
    }

    /**
     * Format tool result as a message
     */
    formatToolResult(toolCallId: string, toolName: string, result: any): Message {
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        return {
            id: `tool_result_${Date.now()}`,
            conversationId: 'sys',
            role: 'user', // Use user role for simulated tool results
            content: `[TOOL RESULT for ${toolName}]\n\n${resultStr}\n\nYou can now continue the conversation based on this result.`,
            timestamp: Date.now(),
        };
    }

    /**
     * Get available tools as formatted text for the model
     */
    getToolsSummary(): string {
        const tools = ToolRegistry.getToolDefinitions();
        if (tools.length === 0) return '';

        return tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    }
}

export default ToolSimulator.getInstance();
