
export class BertTokenizer {
    private vocab: Map<string, number>;
    private unkToken: string = '[UNK]';
    private clsToken: string = '[CLS]';
    private sepToken: string = '[SEP]';
    private unkId: number = 100;
    private clsId: number = 101;
    private sepId: number = 102;

    constructor(vocabContent?: string) {
        this.vocab = new Map();
        if (vocabContent) {
            this.loadVocab(vocabContent);
        } else {
            // Fallback/Default mini-vocab or wait for load
            console.warn('[BertTokenizer] Initialized without vocab.');
        }
    }

    loadVocab(content: string) {
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            if (line) {
                this.vocab.set(line.trim(), index);
            }
        });
        this.unkId = this.vocab.get(this.unkToken) || 100;
        this.clsId = this.vocab.get(this.clsToken) || 101;
        this.sepId = this.vocab.get(this.sepToken) || 102;
    }

    tokenize(text: string): number[] {
        const tokens: number[] = [this.clsId];

        // Basic pre-tokenization (whitespace + punctuation splitting)
        // This is a simplified BERT tokenizer. 
        // Real one handles "wordpiece" (##ing).
        const words = text.toLowerCase().split(/(\W+)/).filter(w => w.length > 0 && w.trim().length > 0);

        for (const word of words) {
            // Try full word
            if (this.vocab.has(word)) {
                tokens.push(this.vocab.get(word)!);
            } else {
                // WordPiece fallback (simplified)
                // Try to find longest prefix
                let remaining = word;
                let foundAny = false;

                // Simple greedy max-match
                while (remaining.length > 0) {
                    let match = '';
                    let matchId = -1;

                    for (let i = remaining.length; i > 0; i--) {
                        const sub = remaining.substring(0, i);
                        const query = foundAny ? '##' + sub : sub;
                        if (this.vocab.has(query)) {
                            match = sub;
                            matchId = this.vocab.get(query)!;
                            break;
                        }
                    }

                    if (matchId !== -1) {
                        tokens.push(matchId);
                        remaining = remaining.substring(match.length);
                        foundAny = true;
                    } else {
                        // Unknown char/subword
                        tokens.push(this.unkId);
                        remaining = remaining.substring(1); // Advance 1 char
                        foundAny = true; // Treat next as suffix potentially? Or reset? 
                        // Simplified: just eat the char as UNK
                    }
                }
            }
        }

        tokens.push(this.sepId);
        return tokens;
    }
}
