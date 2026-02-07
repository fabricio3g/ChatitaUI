/**
 * Document Types
 * Type definitions for the document management system
 */

export type DocumentType = 'pdf' | 'docx' | 'txt' | 'image' | 'generated' | 'csv' | 'xlsx';
export type DocumentSource = 'upload' | 'generated' | 'edited';

export interface Document {
    id: string;
    name: string;
    type: DocumentType;
    uri: string;
    size: number;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
    conversationId?: string;
    source: DocumentSource;
    metadata?: DocumentMetadata;
    contentPreview?: string;
    isIndexed: boolean;
    tags?: string[];
}

export interface DocumentMetadata {
    pageCount?: number;
    wordCount?: number;
    language?: string;
    author?: string;
    title?: string;
}

export interface DocumentChunk {
    id: string;
    documentId: string;
    chunkIndex: number;
    content: string;
    embedding?: Float32Array;
    tokenCount?: number;
    metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
    page?: number;
    section?: string;
}

export interface DocumentVersion {
    id: string;
    documentId: string;
    versionNumber: number;
    uri: string;
    createdAt: number;
    createdBy: 'user' | 'llm';
    changesSummary?: string;
}

export interface ParsedDocument {
    text: string;
    metadata: DocumentMetadata;
}

export interface DocumentFilter {
    type?: DocumentType;
    source?: DocumentSource;
    conversationId?: string;
    isIndexed?: boolean;
    tags?: string[];
    dateRange?: { start: number; end: number };
    searchQuery?: string;
}

export interface Attachment {
    id: string;
    uri: string;
    name: string;
    type: 'image' | 'document' | 'video' | 'audio';
    mimeType: string;
    size: number;
}
