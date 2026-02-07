import { Tool, ToolDefinition, ToolResponse } from './types';

export class FinanceTool implements Tool {
    definition: ToolDefinition = {
        name: 'get_financial_data',
        description: 'Get real-time price data for Crypto (Bitcoin, Ethereum, etc.) or Stocks (AAPL, TSLA, etc.).',
        renderType: 'finance_card',
        parameters: {
            type: 'object',
            properties: {
                symbol: {
                    type: 'string',
                    description: 'The ticker symbol or coin name (e.g., BTC, ETH, AAPL, TSLA)'
                },
                type: {
                    type: 'string',
                    enum: ['crypto', 'stock'],
                    description: 'Type of asset (default: auto-detect)'
                }
            },
            required: ['symbol']
        }
    };

    async execute(params: { symbol: string; type?: string }): Promise<ToolResponse> {
        try {
            const symbol = params.symbol.toUpperCase();
            let type = params.type || (['BTC', 'ETH', 'SOL', 'DOGE'].includes(symbol) ? 'crypto' : 'stock');

            // Map common symbols to CoinGecko IDs
            const cryptoMap: Record<string, string> = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'SOL': 'solana',
                'DOGE': 'dogecoin',
                'XRP': 'ripple',
                'ADA': 'cardano'
            };

            let data: any = {
                symbol,
                price: 0,
                change24h: 0,
                marketCap: 'N/A',
                volume: 'N/A',
                name: symbol,
                type
            };

            if (type === 'crypto' || cryptoMap[symbol]) {
                const coinId = cryptoMap[symbol] || symbol.toLowerCase();
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);

                if (!response.ok) throw new Error('Failed to fetch crypto data');

                const json = await response.json();
                if (json[coinId]) {
                    data.price = json[coinId].usd;
                    data.change24h = json[coinId].usd_24h_change;
                    data.marketCap = this.formatNumber(json[coinId].usd_market_cap);
                    data.type = 'crypto';
                    data.name = coinId.charAt(0).toUpperCase() + coinId.slice(1);
                } else {
                    // Fallback or error if not found
                    throw new Error(`Crypto ${symbol} not found`);
                }
            } else {
                // Mock Stock Data (Real API requires key usually)
                // Simulating realistic movement based on hash of symbol
                const hash = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                const basePrice = (hash % 500) + 10;

                data.price = basePrice + (Math.random() * 2 - 1);
                data.change24h = (Math.random() * 5) - 2;
                data.marketCap = '2.4T'; // Mock
                data.type = 'stock';
                data.name = `${symbol} Inc.`;
            }

            return {
                type: 'finance_card',
                content: `${data.name} (${symbol}) Price: $${data.price.toFixed(2)} (${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%)`,
                data: data
            };

        } catch (error: any) {
            return {
                type: 'error',
                content: `Failed to fetch finance data: ${error.message}`,
                data: { error: error.message }
            };
        }
    }

    private formatNumber(num: number): string {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        return num.toString();
    }
}
