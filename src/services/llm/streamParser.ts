/**
 * Token Stream Parser
 * Handles extracting <think> tags and clean content from raw streaming chunks
 */

export interface ParsedStreamUpdate {
    contentDelta: string;
    thoughtDelta: string;
    isThinking: boolean;
}

export class StreamParser {
    private buffer = '';
    private deepseekThinking = false; // <think> tags
    private customThinking = false; // [Thinking]: tags

    parse(chunk: string): ParsedStreamUpdate {
        let contentDelta = '';
        let thoughtDelta = '';

        this.buffer += chunk;

        while (this.buffer.length > 0) {
            // Case 1: Already inside <think>
            if (this.deepseekThinking) {
                const closeIndex = this.buffer.indexOf('</think>');
                if (closeIndex !== -1) {
                    thoughtDelta += this.buffer.substring(0, closeIndex);
                    this.buffer = this.buffer.substring(closeIndex + 8);
                    this.deepseekThinking = false;
                } else {
                    thoughtDelta += this.buffer;
                    this.buffer = '';
                }
                continue;
            }

            // Case 2: Already inside [Thinking]:
            if (this.customThinking) {
                const endMatch = this.buffer.indexOf('\n\n');
                if (endMatch !== -1) {
                    thoughtDelta += this.buffer.substring(0, endMatch);
                    this.buffer = this.buffer.substring(endMatch + 2); // Skip \n\n
                    this.customThinking = false;
                } else {
                    thoughtDelta += this.buffer;
                    this.buffer = '';
                }
                continue;
            }

            // Not thinking: Check for tags
            const deepseekStart = this.buffer.indexOf('<think>');
            const customStart = this.buffer.indexOf('[Thinking]:');

            // Find first occurrence
            let startType = 'none';
            let startIndex = -1;

            if (deepseekStart !== -1 && customStart !== -1) {
                if (deepseekStart < customStart) { startType = 'deepseek'; startIndex = deepseekStart; }
                else { startType = 'custom'; startIndex = customStart; }
            } else if (deepseekStart !== -1) {
                startType = 'deepseek'; startIndex = deepseekStart;
            } else if (customStart !== -1) {
                startType = 'custom'; startIndex = customStart;
            }

            if (startIndex !== -1) {
                // Push content before tag
                contentDelta += this.buffer.substring(0, startIndex);

                if (startType === 'deepseek') {
                    this.buffer = this.buffer.substring(startIndex + 7);
                    this.deepseekThinking = true;
                } else {
                    this.buffer = this.buffer.substring(startIndex + 11);
                    this.customThinking = true;
                }
            } else {
                // No tag found
                // Check partials
                // Check partials - MUT BE STRICT
                // Only match if it actually starts like a tag
                const p1 = this.buffer.match(/<(?:t(?:h(?:i(?:n(?:k(?:>)?)?)?)?)?)?$/); // Matches <, <t, <th, etc.
                const p2 = this.buffer.match(/\[(?:T(?:h(?:i(?:n(?:k(?:i(?:n(?:g(?:\](?::)?)?)?)?)?)?)?)?)?)?$/); // [Thinking]:

                // If we have a partial match that looks like a tag start
                if ((p1 && p1[0].length > 0) || (p2 && p2[0].length > 0)) {
                    const safeLen = this.buffer.length - 15;
                    if (safeLen > 0) {
                        contentDelta += this.buffer.substring(0, safeLen);
                        this.buffer = this.buffer.substring(safeLen);
                    }
                    break; // Wait for more data
                }

                contentDelta += this.buffer;
                this.buffer = '';
            }
        }

        return {
            contentDelta,
            thoughtDelta,
            isThinking: this.deepseekThinking || this.customThinking
        };
    }

    /**
     * Flush remaining buffer as content (or thinking if stuck)
     */
    flush(): ParsedStreamUpdate {
        const contentDelta = this.buffer;
        this.buffer = '';
        return {
            contentDelta, // Assume anything left is content if stream ends
            thoughtDelta: '',
            isThinking: false
        };
    }
}

// Legacy wrapper
export const parseStreamChunk = (
    chunk: string,
    state: { inThink: boolean, buffer: string, parser?: StreamParser },
    isFinal?: boolean
): { content: string, thinking: string, newState: { inThink: boolean, buffer: string, parser?: StreamParser } } => {
    // We instantiate a parser if not present in state
    const parser = state.parser || new StreamParser();

    // If state has buffer from legacy usage, we might ignore it or try to feed it?
    // Since we now rely on `parser` instance state, we assume `state.parser` works.
    // Ideally we should have migrated the caller to use class directly.

    let result;
    if (isFinal) {
        result = parser.flush();
    } else {
        result = parser.parse(chunk);
    }

    return {
        content: result.contentDelta,
        thinking: result.thoughtDelta,
        newState: {
            inThink: result.isThinking,
            buffer: '', // Buffer managed by parser instance
            parser: parser
        }
    };
};
