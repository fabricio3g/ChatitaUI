/**
 * Safe parsing utilities for handling untrusted input
 * Prevents crashes from malformed JSON and invalid data
 */

/**
 * Safely parse JSON with fallback
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJSONParse<T = any>(json: string, fallback: T): T {
    try {
        return JSON.parse(json);
    } catch (error) {
        console.error('[safeJSONParse] Failed to parse JSON:', error instanceof Error ? error.message : error);
        return fallback;
    }
}

/**
 * Safely parse JSON with validation
 * @param json - JSON string to parse
 * @param validator - Function to validate parsed object
 * @param fallback - Value to return if parsing or validation fails
 * @returns Parsed and validated object, or fallback
 */
export function parseAndValidate<T>(
    json: string,
    validator: (data: any) => data is T,
    fallback: T
): T {
    try {
        const parsed = JSON.parse(json);
        if (validator(parsed)) {
            return parsed;
        }
        console.warn('[parseAndValidate] Validation failed, using fallback');
        return fallback;
    } catch (error) {
        console.error('[parseAndValidate] Failed to parse:', error instanceof Error ? error.message : error);
        return fallback;
    }
}

/**
 * Validate tool call parameters
 */
export interface ToolCallParams {
    [key: string]: any;
}

/**
 * Validate that required string fields exist and are not empty
 */
export function validateStringParams(
    params: ToolCallParams,
    requiredFields: string[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of requiredFields) {
        const value = params[field];

        // Check if field exists
        if (value === undefined || value === null) {
            errors.push(`Missing required field: ${field}`);
            continue;
        }

        // Check if field is a string
        if (typeof value !== 'string') {
            errors.push(`Field ${field} must be a string, got ${typeof value}`);
            continue;
        }

        // Check if field is not empty
        if (value.trim().length === 0) {
            errors.push(`Field ${field} cannot be empty`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate URL format
 */
export function isValidURL(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validate number parameters
 */
export function validateNumberParams(
    params: ToolCallParams,
    fields: { [key: string]: { min?: number; max?: number; required?: boolean } }
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [fieldName, constraints] of Object.entries(fields)) {
        const value = params[fieldName];

        // Check if field is required but missing
        if (constraints.required && (value === undefined || value === null)) {
            errors.push(`Missing required field: ${fieldName}`);
            continue;
        }

        // Skip optional fields that are not provided
        if (!constraints.required && (value === undefined || value === null)) {
            continue;
        }

        // Check if field is a number
        if (typeof value !== 'number') {
            errors.push(`Field ${fieldName} must be a number, got ${typeof value}`);
            continue;
        }

        // Check min/max constraints
        if (constraints.min !== undefined && value < constraints.min) {
            errors.push(`Field ${fieldName} must be at least ${constraints.min}, got ${value}`);
        }

        if (constraints.max !== undefined && value > constraints.max) {
            errors.push(`Field ${fieldName} must be at most ${constraints.max}, got ${value}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Sanitize user input by removing dangerous characters
 */
export function sanitizeInput(input: string, options: {
    maxLength?: number;
    removeControlChars?: boolean;
    trim?: boolean;
} = {}): string {
    let sanitized = input;

    // Trim whitespace
    if (options.trim !== false) {
        sanitized = sanitized.trim();
    }

    // Remove control characters (except \n, \r, \t)
    if (options.removeControlChars !== false) {
        sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Enforce max length
    if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
}
