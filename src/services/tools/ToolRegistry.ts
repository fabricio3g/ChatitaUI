import { Tool } from './types';
import { WebSearchTool } from './WebSearchTool';
import { DeepSearchTool } from './DeepSearchTool';
import { CustomTool, CustomToolConfig } from './CustomTool';
import { WeatherTool } from './WeatherTool';
import { CalculatorTool } from './CalculatorTool';
import { TimerTool } from './TimerTool';
import { TranslateTool } from './TranslateTool';
import { DefinitionTool } from './DefinitionTool';
import { UnitConverterTool } from './UnitConverterTool';
import { CountdownTool } from './CountdownTool';
import { CurrencyConverterTool } from './CurrencyConverterTool';
import { ImageGenTool } from './ImageGenTool';
import { FinanceTool } from './FinanceTool';
import { DateTimeTool } from './DateTimeTool';
import { NotificationTool } from './NotificationTool';
import { WebAppTool } from './WebAppTool';
import { WikipediaTool } from './WikipediaTool';
import { NewsTool } from './NewsTool';
import { BackgroundTaskService } from '../BackgroundTaskService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateStringParams, validateNumberParams } from '../../utils/parsing';

const CUSTOM_TOOLS_KEY = 'custom_tools_v1';
const TOOL_TTS_MESSAGES_KEY = 'tool_tts_messages';

class ToolRegistryClass {
    private tools: Map<string, Tool> = new Map();
    private ttsMessages: Record<string, string> = {
        'web_search': "I'm searching the internet, please wait...",
        'deep_search': "I'm doing a deep search, this may take a moment...",
        'get_weather': "Checking the forecast...",
        'calculator': "Calculating...",
        'set_timer': "Setting your timer...",
        'translate': "Translating...",
        'define_word': "Looking up the definition...",
        'convert_unit': "Converting units...",
        'countdown': "Calculating the countdown...",
        'convert_currency': "Converting currency...",
        'set_reminder': "Setting a reminder for you...",
        'web_app_action': "Reading the web app, please wait...",
        'wikipedia': "Looking that up on Wikipedia...",
        'get_news': "Fetching the latest news...",
        'default': "I'm working on something, please wait..."
    };

    constructor() {
        // Core tools
        this.registerTool(new WebSearchTool());
        this.registerTool(new DeepSearchTool());
        this.registerTool(new WeatherTool());

        // New utility tools
        this.registerTool(new CalculatorTool());
        this.registerTool(new TimerTool());
        this.registerTool(new TranslateTool());
        this.registerTool(new DefinitionTool());
        this.registerTool(new UnitConverterTool());
        this.registerTool(new CountdownTool());
        this.registerTool(new CurrencyConverterTool());
        this.registerTool(new ImageGenTool());
        this.registerTool(new FinanceTool());
        this.registerTool(new DateTimeTool());
        this.registerTool(new NotificationTool());
        this.registerTool(new WebAppTool());
        
        // New tools (no API key required)
        this.registerTool(new WikipediaTool());
        this.registerTool(new NewsTool());

        this.loadCustomTools();
        this.loadTTSMessages();
    }

    registerTool(tool: Tool) {
        console.log('[ToolRegistry] Registering:', tool.definition.name);
        this.tools.set(tool.definition.name, tool);
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    getToolDefinitions() {
        return this.getAllTools().map(t => t.definition);
    }

    async executeTool(name: string, params: any, options?: {
        onProgress?: (
            status: string,
            currentStep?: number,
            totalSteps?: number,
            meta?: { action?: string; url?: string; domain?: string; tool?: string }
        ) => void,
        conversationId?: string
    }) {
        console.log(`[ToolRegistry] Executing tool: ${name} with params:`, params);
        const tool = this.getTool(name);
        if (!tool) {
            console.error(`[ToolRegistry] Tool ${name} not found`);
            throw new Error(`Tool ${name} not found`);
        }

        // Validate tool parameters before execution
        const validation = this.validateToolParameters(name, params);
        if (!validation.valid) {
            const errorMessage = `Invalid parameters for ${name}: ${validation.errors.join(', ')}`;
            console.error(`[ToolRegistry] ${errorMessage}`);
            throw new Error(errorMessage);
        }
        console.log(`[ToolRegistry] Tool ${name} validation passed`);

        // Chat-first tool UX: execute inline and surface progress in live activity feed (no widget/background task)
        const isBackgroundTask = false;

        if (isBackgroundTask && options?.conversationId) {
            // Create background task
            const taskId = await BackgroundTaskService.createTask(
                name as 'deep_research' | 'web_search' | 'image_generation' | 'deep_search',
                options.conversationId,
                params.query || params.prompt || 'Task'
            );
            BackgroundTaskService.startTask(taskId);

            try {
                // Inject onProgress that updates BackgroundTaskService
                const wrappedParams = {
                    ...params,
                    onProgress: (
                        status: string,
                        currentStep?: number,
                        totalSteps?: number,
                        meta?: { action?: string; url?: string; domain?: string; tool?: string }
                    ) => {
                        const progressPercent = totalSteps
                            ? Math.round((currentStep! / totalSteps) * 100)
                            : 0;
                        BackgroundTaskService.updateProgress(taskId, progressPercent, status);
                        options?.onProgress?.(status, currentStep, totalSteps, meta);
                    }
                };

                const result = await tool.execute(wrappedParams);
                await BackgroundTaskService.completeTask(taskId, result);

                // Attach taskId to result so message can link to task
                return {
                    ...result,
                    type: 'background_task' as const,
                    data: {
                        _taskId: taskId,
                        ...result.data
                    }
                };
            } catch (error: any) {
                await BackgroundTaskService.failTask(taskId, error.message);
                throw error;
            }
        }

        // Normal tool execution (no background task)
        if (options?.onProgress) {
            params = { ...params, onProgress: options.onProgress };
        }

        return await tool.execute(params);
    }

    /**
     * Validate tool parameters before execution
     */
    private validateToolParameters(toolName: string, params: any): { valid: boolean; errors: string[] } {
        // Define validation schemas for each tool
        const toolSchemas: { [key: string]: any } = {
            deep_search: {
                requiredStrings: ['query'],
                stringConstraints: {
                    query: { max: 500 }
                }
            },
            web_search: {
                requiredStrings: ['query'],
                stringConstraints: {
                    query: { max: 200 }
                }
            },
            generate_image: {
                requiredStrings: ['prompt'],
                stringConstraints: {
                    prompt: { max: 1000 }
                }
            },
            define_word: {
                requiredStrings: ['word'],
                stringConstraints: {
                    word: { max: 100 }
                }
            },
            translate: {
                requiredStrings: ['text', 'target_language'],
                stringConstraints: {
                    text: { max: 5000 },
                    target_language: { max: 50 }
                }
            },
            convert_unit: {
                requiredStrings: ['value', 'from_unit', 'to_unit'],
                stringConstraints: {
                    value: { max: 100 },
                    from_unit: { max: 50 },
                    to_unit: { max: 50 }
                }
            },
            timer: {
                requiredNumbers: [
                    { field: 'seconds', min: 1, max: 86400, required: true }
                ]
            },
            countdown: {
                requiredStrings: ['date'],
                stringConstraints: {
                    date: { max: 100 }
                }
            },
            calculator: {
                requiredStrings: ['expression'],
                stringConstraints: {
                    expression: { max: 200 }
                }
            },
            convert_currency: {
                requiredNumbers: [
                    { field: 'amount', min: 0, max: 999999999, required: true }
                ],
                requiredStrings: ['from_currency', 'to_currency'],
                stringConstraints: {
                    from_currency: { max: 10 },
                    to_currency: { max: 10 }
                }
            }
        };

        const schema = toolSchemas[toolName];
        if (!schema) {
            // No validation schema defined, allow all parameters
            return { valid: true, errors: [] };
        }

        const errors: string[] = [];

        // Validate required strings
        if (schema.requiredStrings) {
            const stringValidation = validateStringParams(params, schema.requiredStrings);
            if (!stringValidation.valid) {
                errors.push(...stringValidation.errors);
            }
        }

        // Validate string length constraints
        if (schema.stringConstraints) {
            for (const [field, constraintsObj] of Object.entries(schema.stringConstraints)) {
                const constraints = constraintsObj as { max?: number };
                const value = params[field];
                if (value && typeof value === 'string') {
                    if (constraints.max && value.length > constraints.max) {
                        errors.push(`${field} exceeds maximum length of ${constraints.max}`);
                    }
                }
            }
        }

        // Validate required numbers
        if (schema.requiredNumbers) {
            for (const numConstraint of schema.requiredNumbers) {
                const numValidation = validateNumberParams(params, {
                    [numConstraint.field]: {
                        min: numConstraint.min,
                        max: numConstraint.max,
                        required: numConstraint.required
                    }
                });
                if (!numValidation.valid) {
                    errors.push(...numValidation.errors);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // TTS Messages for voice mode
    getTTSMessage(toolName: string): string {
        return this.ttsMessages[toolName] || this.ttsMessages['default'];
    }

    async setTTSMessage(toolName: string, message: string) {
        this.ttsMessages[toolName] = message;
        await AsyncStorage.setItem(TOOL_TTS_MESSAGES_KEY, JSON.stringify(this.ttsMessages));
    }

    private async loadTTSMessages() {
        try {
            const stored = await AsyncStorage.getItem(TOOL_TTS_MESSAGES_KEY);
            if (stored) {
                this.ttsMessages = { ...this.ttsMessages, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error('Failed to load TTS messages', e);
        }
    }

    // Custom Tools
    async loadCustomTools() {
        try {
            const stored = await AsyncStorage.getItem(CUSTOM_TOOLS_KEY);
            if (stored) {
                const configs: CustomToolConfig[] = JSON.parse(stored);
                for (const config of configs) {
                    if (config.enabled) {
                        this.registerTool(new CustomTool(config));
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load custom tools', e);
        }
    }

    async saveCustomTool(config: CustomToolConfig) {
        try {
            const stored = await AsyncStorage.getItem(CUSTOM_TOOLS_KEY);
            let configs: CustomToolConfig[] = stored ? JSON.parse(stored) : [];

            const existingIndex = configs.findIndex(c => c.id === config.id);
            if (existingIndex >= 0) {
                configs[existingIndex] = config;
            } else {
                configs.push(config);
            }

            await AsyncStorage.setItem(CUSTOM_TOOLS_KEY, JSON.stringify(configs));

            // Re-register tool
            if (config.enabled) {
                this.registerTool(new CustomTool(config));
            } else {
                this.tools.delete(config.name);
            }
        } catch (e) {
            console.error('Failed to save custom tool', e);
        }
    }

    async getCustomToolConfigs(): Promise<CustomToolConfig[]> {
        try {
            const stored = await AsyncStorage.getItem(CUSTOM_TOOLS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    async deleteCustomTool(id: string) {
        try {
            const configs = await this.getCustomToolConfigs();
            const config = configs.find(c => c.id === id);
            if (config) {
                this.tools.delete(config.name);
            }
            const updated = configs.filter(c => c.id !== id);
            await AsyncStorage.setItem(CUSTOM_TOOLS_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to delete custom tool', e);
        }
    }
}

export const ToolRegistry = new ToolRegistryClass();

