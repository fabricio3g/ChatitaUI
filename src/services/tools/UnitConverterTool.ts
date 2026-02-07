/**
 * Unit Converter Tool
 * Converts between various units of measurement
 */

import { Tool, ToolDefinition, ToolResponse } from './types';

type UnitCategory = 'length' | 'weight' | 'temperature' | 'volume' | 'speed' | 'time';

const UNIT_CONVERSIONS: Record<UnitCategory, Record<string, number | ((v: number) => number)>> = {
    length: {
        m: 1, // base unit
        km: 1000,
        cm: 0.01,
        mm: 0.001,
        mi: 1609.344,
        yd: 0.9144,
        ft: 0.3048,
        in: 0.0254
    },
    weight: {
        kg: 1, // base unit
        g: 0.001,
        mg: 0.000001,
        lb: 0.453592,
        oz: 0.0283495,
        ton: 1000
    },
    temperature: {
        c: (v: number) => v, // base (Celsius)
        f: (v: number) => (v - 32) * 5 / 9, // to Celsius
        k: (v: number) => v - 273.15 // to Celsius
    },
    volume: {
        l: 1, // base unit (liters)
        ml: 0.001,
        gal: 3.78541,
        qt: 0.946353,
        pt: 0.473176,
        cup: 0.236588,
        floz: 0.0295735
    },
    speed: {
        'km/h': 1, // base unit
        'mph': 1.60934,
        'm/s': 3.6,
        'ft/s': 1.09728,
        'knots': 1.852
    },
    time: {
        s: 1, // base unit (seconds)
        ms: 0.001,
        min: 60,
        h: 3600,
        d: 86400,
        wk: 604800
    }
};

const UNIT_NAMES: Record<string, string> = {
    m: 'meters', km: 'kilometers', cm: 'centimeters', mm: 'millimeters',
    mi: 'miles', yd: 'yards', ft: 'feet', in: 'inches',
    kg: 'kilograms', g: 'grams', mg: 'milligrams', lb: 'pounds', oz: 'ounces', ton: 'tons',
    c: '°C', f: '°F', k: 'K',
    l: 'liters', ml: 'milliliters', gal: 'gallons', qt: 'quarts', pt: 'pints', cup: 'cups', floz: 'fl oz',
    'km/h': 'km/h', 'mph': 'mph', 'm/s': 'm/s', 'ft/s': 'ft/s', 'knots': 'knots',
    s: 'seconds', ms: 'milliseconds', min: 'minutes', h: 'hours', d: 'days', wk: 'weeks'
};

export class UnitConverterTool implements Tool {
    definition: ToolDefinition = {
        name: 'convert_unit',
        description: 'Convert between units of measurement. Supports length (km, mi, m, ft, in, cm), weight (kg, lb, oz, g), temperature (C, F, K), volume (L, gal, ml, cups), speed (km/h, mph), and time (s, min, h, d).',
        renderType: 'unit',
        parameters: {
            type: 'object',
            properties: {
                value: {
                    type: 'number',
                    description: 'The value to convert'
                },
                from_unit: {
                    type: 'string',
                    description: 'The source unit (e.g., "km", "lb", "f")'
                },
                to_unit: {
                    type: 'string',
                    description: 'The target unit (e.g., "mi", "kg", "c")'
                }
            },
            required: ['value', 'from_unit', 'to_unit']
        }
    };

    async execute(params: { value: number; from_unit: string; to_unit: string }): Promise<ToolResponse> {
        try {
            const fromUnit = params.from_unit.toLowerCase().trim();
            const toUnit = params.to_unit.toLowerCase().trim();

            // Find the category for these units
            let category: UnitCategory | null = null;
            for (const [cat, units] of Object.entries(UNIT_CONVERSIONS)) {
                if (fromUnit in units && toUnit in units) {
                    category = cat as UnitCategory;
                    break;
                }
            }

            if (!category) {
                return {
                    type: 'error',
                    content: `Cannot convert between "${fromUnit}" and "${toUnit}". Make sure both units are of the same type.`,
                    data: { error: 'Incompatible units' }
                };
            }

            let result: number;

            if (category === 'temperature') {
                // Special handling for temperature
                result = this.convertTemperature(params.value, fromUnit, toUnit);
            } else {
                const conversions = UNIT_CONVERSIONS[category];
                const fromFactor = conversions[fromUnit] as number;
                const toFactor = conversions[toUnit] as number;

                // Convert to base unit, then to target
                const baseValue = params.value * fromFactor;
                result = baseValue / toFactor;
            }

            const formattedResult = this.formatNumber(result);
            const fromName = UNIT_NAMES[fromUnit] || fromUnit;
            const toName = UNIT_NAMES[toUnit] || toUnit;

            return {
                type: 'unit',
                content: `${params.value} ${fromName} = ${formattedResult} ${toName}`,
                data: {
                    originalValue: params.value,
                    fromUnit,
                    fromUnitName: fromName,
                    result,
                    resultFormatted: formattedResult,
                    toUnit,
                    toUnitName: toName,
                    category
                }
            };
        } catch (error: any) {
            return {
                type: 'error',
                content: `Conversion failed: ${error.message}`,
                data: { error: error.message }
            };
        }
    }

    private convertTemperature(value: number, from: string, to: string): number {
        // Convert to Celsius first
        let celsius: number;
        switch (from) {
            case 'c': celsius = value; break;
            case 'f': celsius = (value - 32) * 5 / 9; break;
            case 'k': celsius = value - 273.15; break;
            default: throw new Error(`Unknown temperature unit: ${from}`);
        }

        // Convert from Celsius to target
        switch (to) {
            case 'c': return celsius;
            case 'f': return celsius * 9 / 5 + 32;
            case 'k': return celsius + 273.15;
            default: throw new Error(`Unknown temperature unit: ${to}`);
        }
    }

    private formatNumber(num: number): string {
        if (Number.isInteger(num)) {
            return num.toLocaleString();
        }
        return parseFloat(num.toFixed(6)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
}
