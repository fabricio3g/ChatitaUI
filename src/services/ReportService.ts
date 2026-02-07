/**
 * Report Service
 * Generates and manages research reports in Markdown format
 */

import { DatabaseService } from './DatabaseService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface ReportOptions {
    includeThinking?: boolean;
    includeFullSources?: boolean;
    includeDiagrams?: boolean;
}

export interface ReportData {
    title: string;
    generatedAt: string;
    complexityLevel: string;
    queryCount: number;
    sourceCount: number;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        sources?: any[];
        thinking?: string;
        relatedQuestions?: string[];
    }>;
}

/**
 * Generate a markdown report from a research conversation
 */
export async function generateMarkdownReport(
    conversationId: string,
    options: ReportOptions = {}
): Promise<string> {
    const { includeThinking = false, includeFullSources = false, includeDiagrams = true } = options;
    
    // Fetch conversation data
    const messages = await DatabaseService.getMessages(conversationId);
    
    if (!messages || messages.length === 0) {
        throw new Error('No messages found for this conversation');
    }
    
    // Extract metadata
    const firstQuery = messages.find(m => m.role === 'user')?.content || 'Research Report';
    const generatedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Collect all query-answer pairs
    const queryAnswerPairs: Array<{ query: string; answer: string; sources: any[]; relatedQuestions: string[] }> = [];
    const allSources = new Map<string, any>();
    
    messages.forEach(m => {
        if (m.role === 'user') {
            queryAnswerPairs.push({
                query: m.content,
                answer: '',
                sources: [],
                relatedQuestions: []
            });
        } else if (m.role === 'assistant' && queryAnswerPairs.length > 0) {
            const lastPair = queryAnswerPairs[queryAnswerPairs.length - 1];
            lastPair.answer = m.content;
            if (m.metadata?.sources) {
                m.metadata.sources.forEach((s: any) => {
                    if (!allSources.has(s.url)) {
                        allSources.set(s.url, s);
                        lastPair.sources.push(s);
                    }
                });
            }
            if (m.metadata?.relatedQuestions) {
                lastPair.relatedQuestions = m.metadata.relatedQuestions;
            }
        }
    });
    
    // Build synthesized report
    const sections: string[] = [];
    
    // Header
    sections.push(`# ${firstQuery}`);
    sections.push('');
    sections.push(`*Report generated on ${generatedAt}*`);
    sections.push('');
    sections.push('---');
    sections.push('');
    
    // Executive Summary - Synthesized overview
    sections.push('## Executive Summary');
    sections.push('');
    
    // Create a synthesized summary from all answers
    const allAnswers = queryAnswerPairs.filter(p => p.answer).map(p => p.answer).join('\n\n');
    const summaryLength = Math.min(500, allAnswers.length * 0.3);
    const summary = allAnswers.length > 0 
        ? (allAnswers.substring(0, summaryLength) + (allAnswers.length > summaryLength ? '...' : ''))
        : 'Research completed with multiple sources analyzed.';
    
    sections.push(summary);
    sections.push('');
    sections.push(`**Key Statistics:**`);
    sections.push('');
    sections.push(`- **Topics Explored:** ${queryAnswerPairs.length}`);
    sections.push(`- **Sources Consulted:** ${allSources.size}`);
    sections.push(`- **Research Date:** ${new Date().toLocaleDateString()}`);
    sections.push('');
    sections.push('---');
    sections.push('');
    
    // Research Process Diagram
    if (includeDiagrams) {
        sections.push('## Research Process');
        sections.push('');
        sections.push('```mermaid');
        sections.push('flowchart TD');
        sections.push('    A[Initial Query] --> B[Multi-Source Search]');
        sections.push('    B --> C[Information Synthesis]');
        sections.push('    C --> D[Comprehensive Analysis]');
        sections.push('    D --> E[Final Report]');
        sections.push('```');
        sections.push('');
    }
    
    // Main Research Findings - Synthesized
    sections.push('## Research Findings');
    sections.push('');
    
    // Combine all findings into a cohesive narrative
    if (queryAnswerPairs.length === 1) {
        // Single query - use the full answer
        sections.push(queryAnswerPairs[0].answer || 'No findings available.');
        sections.push('');
    } else {
        // Multiple queries - synthesize
        sections.push('This research explored multiple interconnected topics. Here are the consolidated findings:');
        sections.push('');
        
        queryAnswerPairs.forEach((pair, index) => {
            sections.push(`### ${index + 1}. ${pair.query}`);
            sections.push('');
            sections.push(pair.answer || 'No detailed findings for this query.');
            sections.push('');
        });
    }
    
    // Sources and Citations
    if (allSources.size > 0) {
        sections.push('## Sources & References');
        sections.push('');
        sections.push('The following sources were consulted during this research:');
        sections.push('');
        
        Array.from(allSources.values()).forEach((source, idx) => {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const title = source.title || 'Unknown Source';
            sections.push(`**${idx + 1}.** ${title}`);
            sections.push(`   *Source:* ${domain}`);
            if (source.snippet) {
                const snippet = source.snippet.length > 200 
                    ? source.snippet.substring(0, 200) + '...'
                    : source.snippet;
                sections.push(`   > ${snippet}`);
            }
            sections.push(`   *Link:* [${source.url}](${source.url})`);
            sections.push('');
        });
    }
    
    // Related Questions
    const allRelatedQuestions = queryAnswerPairs.flatMap(p => p.relatedQuestions);
    if (allRelatedQuestions.length > 0) {
        sections.push('## Further Reading');
        sections.push('');
        sections.push('Based on this research, you might also be interested in:');
        sections.push('');
        allRelatedQuestions.slice(0, 6).forEach((q, idx) => {
            sections.push(`${idx + 1}. ${q}`);
        });
        sections.push('');
    }
    
    // Footer
    sections.push('---');
    sections.push('');
    sections.push(`*Report generated by AI Research Assistant*`);
    sections.push(`*Total sources: ${allSources.size} | Topics covered: ${queryAnswerPairs.length}*`);
    
    return sections.join('\n');
}

/**
 * Save report to file and share
 */
export async function saveAndShareReport(
    content: string,
    filename?: string
): Promise<void> {
    try {
        // Generate filename if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().split('T')[0];
            filename = `research-report-${timestamp}.md`;
        }
        
        // Ensure .md extension
        if (!filename.endsWith('.md')) {
            filename += '.md';
        }
        
        // Write to cache directory
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, content);
        
        console.log('[ReportService] Report saved to:', fileUri);
        
        // Share the file
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/markdown',
                dialogTitle: 'Share Research Report',
                UTI: 'net.daringfireball.markdown'
            });
        } else {
            throw new Error('Sharing is not available on this device');
        }
    } catch (error) {
        console.error('[ReportService] Error saving/sharing report:', error);
        throw error;
    }
}

/**
 * Get report summary data for preview card
 */
export async function getReportSummary(conversationId: string): Promise<{
    title: string;
    generatedAt: string;
    queryCount: number;
    sourceCount: number;
    preview: string;
}> {
    const messages = await DatabaseService.getMessages(conversationId);
    
    const firstQuery = messages.find(m => m.role === 'user')?.content || 'Research Report';
    const firstAnswer = messages.find(m => m.role === 'assistant')?.content || '';
    
    const allSources = new Set<string>();
    messages.forEach(m => {
        if (m.metadata?.sources) {
            m.metadata.sources.forEach((s: any) => allSources.add(s.url));
        }
    });
    
    return {
        title: firstQuery.length > 50 ? firstQuery.substring(0, 50) + '...' : firstQuery,
        generatedAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }),
        queryCount: messages.filter(m => m.role === 'user').length,
        sourceCount: allSources.size,
        preview: firstAnswer.length > 100 ? firstAnswer.substring(0, 100) + '...' : firstAnswer
    };
}