export interface ToolParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    enum?: string[];
    required?: boolean;
}

// Tool render types for UI widgets
export type ToolRenderType = 'media' | 'web_card' | 'weather_card' | 'error' | 'calculator' | 'timer' | 'translate' | 'definition' | 'unit' | 'countdown' | 'currency' | 'image_generated' | 'finance_card' | 'datetime_card' | 'notification' | 'message_draft' | 'web_app' | 'background_task';

// Base Tool Definition
export interface ToolDefinition {
    name: string;
    description: string;
    renderType?: ToolRenderType; // Default 'text'
    parameters: {
        type: 'object';
        properties: Record<string, ToolParameter>;
        required?: string[];
    };
}

export interface ToolResponse {
    type: ToolRenderType;
    content: string; // Text summary for LLM context
    data?: any;      // Raw data for UI widget
}

export interface Tool {
    definition: ToolDefinition;
    execute(params: any): Promise<ToolResponse | any>;
}
