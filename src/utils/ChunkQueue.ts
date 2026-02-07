/**
 * Chunk Queue with Batch Rendering
 *
 * Queues incoming stream chunks and renders them in batches
 * for better performance and smoother UX.
 *
 * Features:
 * - Batches chunks by sentence count or character count
 * - Configurable batch interval
 * - Automatic cleanup on completion
 * - Memory leak prevention
 */

export interface ChunkQueueConfig {
    /** Target batch size in characters */
    batchSizeChars?: number;
    /** Target batch size in sentences (approximate) */
    batchSizeSentences?: number;
    /** Minimum time between batch renders (ms) */
    batchInterval?: number;
    /** Maximum time to wait before flushing queue (ms) */
    maxFlushDelay?: number;
}

export interface QueuedChunk {
    content: string;
    timestamp: number;
}

export interface RenderedBatch {
    content: string;
    timestamp: number;
    chunkCount: number;
}

type BatchCallback = (batch: RenderedBatch) => void;
type CompletionCallback = () => void;

export class ChunkQueue {
    private queue: QueuedChunk[] = [];
    private renderedContent: string = '';
    private lastRenderTime: number = 0;
    private timerId: NodeJS.Timeout | null = null;
    private completionTimerId: NodeJS.Timeout | null = null;
    private isComplete: boolean = false;
    private totalChunks: number = 0;
    private flushedEarly: boolean = false;

    private readonly config: Required<ChunkQueueConfig>;
    private readonly onBatch: BatchCallback;
    private readonly onComplete: CompletionCallback;

    constructor(
        onBatch: BatchCallback,
        onComplete: CompletionCallback,
        config: ChunkQueueConfig = {}
    ) {
        this.onBatch = onBatch;
        this.onComplete = onComplete;

        // Default configuration
        this.config = {
            batchSizeChars: config.batchSizeChars || 500,        // 500 chars per batch
            batchSizeSentences: config.batchSizeSentences || 10, // ~10 sentences
            batchInterval: config.batchInterval || 40,          // 40ms between batches
            maxFlushDelay: config.maxFlushDelay || 150          // Flush queue after 150ms of inactivity
        };
    }

    /**
     * Add a chunk to the queue
     */
    addChunk(chunk: string): void {
        if (this.isComplete) {
            console.warn('[ChunkQueue] Cannot add chunk: queue is complete');
            return;
        }

        if (!chunk || chunk.length === 0) {
            return;
        }

        this.queue.push({
            content: chunk,
            timestamp: Date.now()
        });
        this.totalChunks++;

        // Schedule batch processing
        this.scheduleBatch();
    }

    /**
     * Mark the stream as complete
     * This will flush any remaining chunks
     */
    complete(): void {
        if (this.isComplete) return;

        this.isComplete = true;

        // Flush remaining queue immediately if not much content
        if (this.queue.length > 0) {
            this.flush();
        } else {
            // No queued chunks, just notify completion
            this.cleanup();
            this.onComplete();
        }
    }

    /**
     * Cancel all pending operations
     * Call this when component unmounts
     */
    cancel(): void {
        this.cleanup();

        // Clear queue but don't notify completion
        this.queue = [];
        this.isComplete = true;
    }

    /**
     * Get current rendered content
     */
    getCurrentContent(): string {
        return this.renderedContent;
    }

    /**
     * Get statistics about the queue
     */
    getStats(): {
        queuedChunks: number;
        renderedChars: number;
        totalChunks: number;
        isComplete: boolean;
    } {
        return {
            queuedChunks: this.queue.length,
            renderedChars: this.renderedContent.length,
            totalChunks: this.totalChunks,
            isComplete: this.isComplete
        };
    }

    /**
     * Schedule batch processing
     */
    private scheduleBatch(): void {
        // Don't schedule if already scheduled
        if (this.timerId !== null) {
            return;
        }

        // Don't schedule if queue is empty and not complete
        if (this.queue.length === 0 && !this.isComplete) {
            return;
        }

        const timeSinceLastRender = Date.now() - this.lastRenderTime;

        // If enough time has passed since last render, render immediately
        // Otherwise, schedule a render
        if (timeSinceLastRender >= this.config.batchInterval) {
            this.timerId = setTimeout(() => {
                this.timerId = null;
                this.processBatch();
            }, 0);
        } else {
            const delay = this.config.batchInterval - timeSinceLastRender;

            this.timerId = setTimeout(() => {
                this.timerId = null;
                this.processBatch();
            }, delay);
        }
    }

    /**
     * Process one batch of chunks
     */
    private processBatch(): void {
        if (this.queue.length === 0) {
            // No chunks to process
            if (this.isComplete) {
                this.cleanup();
                this.onComplete();
            }
            return;
        }

        // Gather chunks for this batch
        const batch = this.gatherBatch();

        if (batch.content.length === 0) {
            // No actual content to render
            if (this.isComplete) {
                this.cleanup();
                this.onComplete();
            }
            return;
        }

        // Update rendered content
        this.renderedContent += batch.content;
        this.lastRenderTime = Date.now();

        // Clear completion timer (we'll set a new one)
        if (this.completionTimerId !== null) {
            clearTimeout(this.completionTimerId);
            this.completionTimerId = null;
        }

        // Notify callback
        this.onBatch({
            content: this.renderedContent,
            timestamp: Date.now(),
            chunkCount: batch.chunkCount
        });

        // If stream is complete and queue is empty, notify completion
        if (this.isComplete && this.queue.length === 0) {
            this.cleanup();
            this.onComplete();
        } else if (this.queue.length > 0) {
            // More chunks to process, schedule next batch
            this.scheduleBatch();
        } else {
            // Queue is empty but stream not complete
            // Set a timer to flush if no new chunks arrive
            this.completionTimerId = setTimeout(() => {
                this.completionTimerId = null;

                if (this.isComplete) {
                    this.flush();
                } else {
                    // Stream still active, but no new chunks for a while
                    // Just make sure queue is processed
                    this.scheduleBatch();
                }
            }, this.config.maxFlushDelay);
        }
    }

    /**
     * Gather chunks into a batch
     */
    private gatherBatch(): { content: string; chunkCount: number } {
        const chunks: string[] = [];
        let charCount = 0;
        let sentenceCount = 0;

        while (this.queue.length > 0 && chunks.length < 50) { // Safety limit
            const chunk = this.queue[0];

            chunks.push(chunk.content);
            charCount += chunk.content.length;

            // Approximate sentence count (count periods, question marks, exclamation marks)
            const sentencesInChunk = (chunk.content.match(/[.!?]/g) || []).length;
            sentenceCount += sentencesInChunk;

            // Remove chunk from queue
            this.queue.shift();

            // Check if batch is large enough
            if (charCount >= this.config.batchSizeChars ||
                sentenceCount >= this.config.batchSizeSentences) {
                break;
            }
        }

        return {
            content: chunks.join(''),
            chunkCount: chunks.length
        };
    }

    /**
     * Flush all remaining chunks immediately
     */
    private flush(): void {
        if (this.queue.length === 0) {
            return;
        }

        const batch = {
            content: this.queue.map(c => c.content).join(''),
            timestamp: Date.now(),
            chunkCount: this.queue.length
        };

        this.queue = [];

        this.renderedContent += batch.content;
        this.lastRenderTime = Date.now();

        this.onBatch(batch);

        this.flushedEarly = true;
    }

    /**
     * Cleanup timers and resources
     */
    private cleanup(): void {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        if (this.completionTimerId !== null) {
            clearTimeout(this.completionTimerId);
            this.completionTimerId = null;
        }
    }

    /**
     * Destroy the queue and release all resources
     */
    destroy(): void {
        this.cancel();
        this.queue = [];
        this.renderedContent = '';
    }
}

/**
 * Factory function to create a chunk queue
 */
export function createChunkQueue(
    onBatch: (batch: RenderedBatch) => void,
    onComplete: () => void,
    config?: ChunkQueueConfig
): ChunkQueue {
    return new ChunkQueue(onBatch, onComplete, config);
}
