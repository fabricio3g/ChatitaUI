/**
 * PDF Extractor Utility
 * Extracts text from PDF using PDF.js in a hidden WebView (on-device, open source)
 */

import * as FileSystem from 'expo-file-system/legacy';

const buildPdfExtractorHTML = (pdfjsUri: string, workerUri: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Extractor</title>
    <style>
        body { margin: 0; padding: 8px; font-family: monospace; font-size: 12px; }
    </style>
    <script src="${pdfjsUri}"></script>
</head>
<body>
    <script>
        function send(type, payload) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
        }

        async function extractTextFromPdf(base64) {
            try {
                if (!window.pdfjsLib) {
                    throw new Error('PDF.js not loaded');
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = "${workerUri}";

                const binary = atob(base64);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

                const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
                const pdf = await loadingTask.promise;
                const numPages = pdf.numPages || 0;
                let fullText = '';

                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = (textContent.items || [])
                        .map(item => item.str)
                        .join(' ')
                        .replace(/\\s{2,}/g, ' ')
                        .trim();
                    if (pageText) {
                        fullText += pageText + '\\n\\n';
                    }
                }

                fullText = fullText.trim();
                send('success', { text: fullText, pageCount: numPages });
            } catch (error) {
                send('error', { error: error.message || 'PDF extraction failed' });
            }
        }

        document.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data || '{}');
                if (data.type === 'extract') {
                    extractTextFromPdf(data.base64 || '');
                }
            } catch (e) {
                send('error', { error: 'Invalid message' });
            }
        });

        window.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data || '{}');
                if (data.type === 'extract') {
                    extractTextFromPdf(data.base64 || '');
                }
            } catch (e) {
                send('error', { error: 'Invalid message' });
            }
        });
    </script>
</body>
</html>
`;

let pdfWebView: any = null;
let pendingResolve: ((value: { text: string; pageCount: number }) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

export function setPdfExtractorWebView(webView: any): void {
    pdfWebView = webView;
}

export function handlePdfExtractorMessage(event: any): void {
    try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'success') {
            pendingResolve?.({ text: data.text || '', pageCount: data.pageCount || 0 });
        } else if (data.type === 'error') {
            pendingReject?.(new Error(data.error || 'PDF extraction failed'));
        }
    } catch (e) {
        pendingReject?.(new Error('Failed to parse PDF extractor response'));
    } finally {
        pendingResolve = null;
        pendingReject = null;
    }
}

export function getPdfExtractorHTML(pdfjsUri: string, workerUri: string): string {
    return buildPdfExtractorHTML(pdfjsUri, workerUri);
}

export async function extractPdfTextFromUri(pdfUri: string): Promise<{ text: string; pageCount: number }> {
    if (!pdfWebView) {
        throw new Error('PDF extractor WebView not initialized. Make sure PdfExtractorWebView is mounted.');
    }

    const base64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: 'base64' });

    return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;

        pdfWebView.postMessage(JSON.stringify({
            type: 'extract',
            base64,
        }));

        setTimeout(() => {
            if (pendingReject) {
                pendingReject(new Error('PDF extraction timeout'));
                pendingResolve = null;
                pendingReject = null;
            }
        }, 60000);
    });
}
