/**
 * Content Extraction Utilities
 * Clean HTML and extract raw text efficiently
 */

/**
 * Clean HTML content and extract readable text
 * Removes scripts, styles, navigation, ads, and other non-content elements
 */
export function extractCleanText(html: string): string {
    if (!html || typeof html !== 'string') return '';
    
    // Remove script and style tags with their content
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<canvas[^>]*>[\s\S]*?<\/canvas>/gi, ' ');
    
    // Remove common non-content elements
    text = text
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, ' ')
        .replace(/<menu[^>]*>[\s\S]*?<\/menu>/gi, ' ')
        .replace(/<nav\b[^>]*>.*?<\/nav>/gi, ' ');
    
    // Remove common ad and tracking elements
    text = text
        .replace(/<div[^>]*class="[^"]*(?:ad|advertisement|banner|popup|modal|cookie|newsletter)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
        .replace(/<div[^>]*id="[^"]*(?:ad|advertisement|banner|popup|modal|cookie|newsletter)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ');
    
    // Convert remaining HTML tags to newlines for structure
    text = text
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Clean up whitespace
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
    
    return text;
}

/**
 * Extract content from specific semantic HTML elements
 * Prioritizes main content areas
 */
export function extractMainContent(html: string): string {
    if (!html || typeof html !== 'string') return '';
    
    // Try to find main content areas
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
        return extractCleanText(mainMatch[1]).substring(0, 10000);
    }
    
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
        return extractCleanText(articleMatch[1]).substring(0, 10000);
    }
    
    // Try common content containers
    const contentMatch = html.match(/<div[^>]*(?:class|id)="[^"]*(?:content|main|body|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (contentMatch) {
        return extractCleanText(contentMatch[1]).substring(0, 10000);
    }
    
    // Fallback: extract from body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
        return extractCleanText(bodyMatch[1]).substring(0, 10000);
    }
    
    // Last resort: clean the whole HTML
    return extractCleanText(html).substring(0, 10000);
}

/**
 * Truncate text to a specific length while preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
        return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
}

/**
 * Get content length limit based on depth level
 */
export function getContentLimit(depth: string): number {
    switch (depth) {
        case 'basic':
            return 3000;  // Quick: 3K chars per source
        case 'normal':
            return 6000;  // Standard: 6K chars per source
        case 'thorough':
            return 10000; // Deep: 10K chars per source
        case 'comprehensive':
            return 15000; // Exhaustive: 15K chars per source
        default:
            return 6000;
    }
}