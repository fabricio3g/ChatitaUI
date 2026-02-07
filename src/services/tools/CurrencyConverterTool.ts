/**
 * Currency Converter Tool
 * Convert between currencies using free exchange rate API
 */

import { Tool, ToolDefinition, ToolResponse } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

const CURRENCY_NAMES: Record<string, string> = {
    USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan', INR: 'Indian Rupee', AUD: 'Australian Dollar',
    CAD: 'Canadian Dollar', CHF: 'Swiss Franc', MXN: 'Mexican Peso',
    BRL: 'Brazilian Real', KRW: 'South Korean Won', RUB: 'Russian Ruble',
    ARS: 'Argentine Peso', CLP: 'Chilean Peso', COP: 'Colombian Peso',
    PLN: 'Polish Zloty', SEK: 'Swedish Krona', NOK: 'Norwegian Krone',
    DKK: 'Danish Krone', NZD: 'New Zealand Dollar', SGD: 'Singapore Dollar',
    HKD: 'Hong Kong Dollar', TRY: 'Turkish Lira', ZAR: 'South African Rand',
    THB: 'Thai Baht', PHP: 'Philippine Peso', IDR: 'Indonesian Rupiah',
    MYR: 'Malaysian Ringgit', VND: 'Vietnamese Dong', EGP: 'Egyptian Pound',
    AED: 'UAE Dirham', SAR: 'Saudi Riyal', ILS: 'Israeli Shekel'
};

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹',
    AUD: 'A$', CAD: 'C$', CHF: 'Fr', MXN: '$', BRL: 'R$', KRW: '₩',
    RUB: '₽', ARS: '$', PLN: 'zł', SEK: 'kr', NOK: 'kr', DKK: 'kr',
    NZD: 'NZ$', SGD: 'S$', HKD: 'HK$', TRY: '₺', ZAR: 'R', THB: '฿',
    PHP: '₱', MYR: 'RM', VND: '₫', AED: 'د.إ', SAR: '﷼', ILS: '₪'
};

export class CurrencyConverterTool implements Tool {
    definition: ToolDefinition = {
        name: 'convert_currency',
        description: 'Convert monetary amounts between different currencies (e.g., USD to EUR, dollars to euros, money conversion). Use this when the user asks to convert currency, exchange rates, or monetary values.',
        renderType: 'currency',
        parameters: {
            type: 'object',
            properties: {
                amount: {
                    type: 'number',
                    description: 'The amount to convert'
                },
                from_currency: {
                    type: 'string',
                    description: 'Source currency code (e.g., "USD", "EUR", "GBP")'
                },
                to_currency: {
                    type: 'string',
                    description: 'Target currency code (e.g., "JPY", "BRL", "INR")'
                }
            },
            required: ['amount', 'from_currency', 'to_currency']
        }
    };

    async execute(params: { amount: number; from_currency: string; to_currency: string }): Promise<ToolResponse> {
        console.log('[CurrencyTool] Executing with params:', params);
        try {
            const from = params.from_currency.toUpperCase().trim();
            const to = params.to_currency.toUpperCase().trim();
            console.log('[CurrencyTool] Converting', params.amount, from, 'to', to);

            // Fetch exchange rates
            const rates = await this.getExchangeRates(from);

            if (!rates) {
                return {
                    type: 'error',
                    content: 'Could not fetch exchange rates. Please try again later.',
                    data: { error: 'API unavailable' }
                };
            }

            if (!rates[to]) {
                return {
                    type: 'error',
                    content: `Currency "${to}" is not supported.`,
                    data: { error: 'Unsupported currency', currency: to }
                };
            }

            const rate = rates[to];
            const result = params.amount * rate;

            const fromSymbol = CURRENCY_SYMBOLS[from] || from;
            const toSymbol = CURRENCY_SYMBOLS[to] || to;
            const fromName = CURRENCY_NAMES[from] || from;
            const toName = CURRENCY_NAMES[to] || to;

            const formattedAmount = this.formatCurrency(params.amount, from);
            const formattedResult = this.formatCurrency(result, to);

            console.log('[CurrencyTool] Success:', formattedAmount, '=', formattedResult);
            return {
                type: 'currency',
                content: `${formattedAmount} = ${formattedResult}`,
                data: {
                    originalAmount: params.amount,
                    fromCurrency: from,
                    fromCurrencyName: fromName,
                    fromSymbol,
                    result,
                    resultFormatted: formattedResult,
                    toCurrency: to,
                    toCurrencyName: toName,
                    toSymbol,
                    exchangeRate: rate,
                    rateFormatted: `1 ${from} = ${rate.toFixed(4)} ${to}`
                }
            };
        } catch (error: any) {
            return {
                type: 'error',
                content: `Currency conversion failed: ${error.message}`,
                data: { error: error.message }
            };
        }
    }

    private async getExchangeRates(baseCurrency: string): Promise<Record<string, number> | null> {
        try {
            // Check cache first
            const cached = await AsyncStorage.getItem(RATES_CACHE_KEY);
            if (cached) {
                const { timestamp, base, rates } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION_MS && base === baseCurrency) {
                    console.log('[CurrencyTool] Using cached rates');
                    return rates;
                }
            }

            // Fetch fresh rates from exchangerate-api.com (free tier)
            const url = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Exchange rate API error');
            }

            const data = await response.json();

            // Cache the rates
            await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                base: baseCurrency,
                rates: data.rates
            }));

            return data.rates;
        } catch (e) {
            console.error('[CurrencyTool] Failed to fetch rates:', e);
            return null;
        }
    }

    private formatCurrency(amount: number, currency: string): string {
        const symbol = CURRENCY_SYMBOLS[currency] || '';

        // Special formatting for some currencies
        if (['JPY', 'KRW', 'VND', 'IDR'].includes(currency)) {
            // No decimal places for these currencies
            return `${symbol}${Math.round(amount).toLocaleString()}`;
        }

        return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
