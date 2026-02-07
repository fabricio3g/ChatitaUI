/**
 * React Native compatible UUID v4 generator
 * Does not rely on crypto.getRandomValues()
 * Uses Math.random() + timestamp for uniqueness
 */

/**
 * Generate a random UUID v4
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function uuidv4(): string {
    // Generate 32 random hex digits
    const bytes = new Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = randomHexDigit();
    }

    // Set version bits (4) and variant bits (8, 9, A, or B)
    bytes[12] = '4'; // Version 4
    bytes[16] = randomVariantDigit(); // Variant 1 (10xx)

    // Format as UUID
    return [
        bytes.slice(0, 8).join(''),
        bytes.slice(8, 12).join(''),
        bytes.slice(12, 16).join(''),
        bytes.slice(16, 20).join(''),
        bytes.slice(20, 32).join('')
    ].join('-');
}

function randomHexDigit(): string {
    return Math.floor(Math.random() * 16).toString(16);
}

function randomVariantDigit(): string {
    // Variant 1: 10xx (8, 9, A, or B in hex)
    const variants = ['8', '9', 'a', 'b'];
    return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Generate a UUID v4 without hyphens (for compact display)
 */
export function uuidv4Compact(): string {
    return uuidv4().replace(/-/g, '');
}

/**
 * Generate a simple unique ID (faster, less cryptographically secure)
 * Good for React Native where crypto.getRandomValues() isn't available
 */
export function simpleUniqueId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${randomStr}`;
}
