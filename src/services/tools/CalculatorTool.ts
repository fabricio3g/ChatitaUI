/**
 * Calculator Tool
 * Evaluates mathematical expressions using mathjs library
 */

import { Tool, ToolDefinition, ToolResponse } from './types';
import { evaluate, format } from 'mathjs';

export class CalculatorTool implements Tool {
    definition: ToolDefinition = {
        name: 'calculator',
        description: 'Evaluate mathematical expressions. Supports basic operations (+, -, *, /), powers (^), parentheses, trigonometry (sin, cos, tan, asin, acos, atan), logarithms (log, log10, ln), roots (sqrt, cbrt, nthRoot), constants (pi, e, phi), factorial (!), percentages (%), complex numbers (i), and more.',
        renderType: 'calculator',
        parameters: {
            type: 'object',
            properties: {
                expression: {
                    type: 'string',
                    description: 'The math expression to evaluate (e.g., "25 * 4 + 100", "sqrt(144)", "2^10", "sin(pi/2)", "5!", "log(100)")'
                }
            },
            required: ['expression']
        }
    };

    async execute(params: { expression: string }): Promise<ToolResponse> {
        try {
            // Use mathjs to evaluate the expression safely
            const result = evaluate(params.expression);

            // Format the result nicely
            const formatted = this.formatResult(result);

            return {
                type: 'calculator',
                content: `${params.expression} = ${formatted}`,
                data: {
                    expression: params.expression,
                    result: typeof result === 'number' ? result : result.toString(),
                    formatted: formatted
                }
            };
        } catch (error: any) {
            return {
                type: 'error',
                content: `Could not calculate: ${error.message}`,
                data: { error: error.message, expression: params.expression }
            };
        }
    }

    private formatResult(result: any): string {
        // Handle different result types from mathjs
        if (typeof result === 'number') {
            if (Number.isInteger(result)) {
                return result.toLocaleString();
            }
            // Round to avoid floating point display issues
            const rounded = parseFloat(result.toPrecision(12));
            return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 });
        }

        // For complex numbers, matrices, etc.
        return format(result, { precision: 10 });
    }
}
