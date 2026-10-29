export type DimensionUnit = 'mm' | 'cm' | 'm';

export const DIMENSION_UNITS: readonly DimensionUnit[] = ['mm', 'cm', 'm'];

export const getDimensionUnit = (value: unknown): DimensionUnit =>
    value === 'mm' || value === 'm' ? value : 'cm';

const centimetresPerUnit: Record<DimensionUnit, number> = { mm: 0.1, cm: 1, m: 100 };

const numericDimension = (value: unknown): number | null => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

// Round floating-point noise only; unit selection never rewrites stored measurements.
const cleanDecimal = (value: number) => Number(value.toFixed(8));

export function fromCentimetres(value: unknown, unit: DimensionUnit): number | null {
    const number = numericDimension(value);
    return number === null ? null : cleanDecimal(number / centimetresPerUnit[unit]);
}

export function toCentimetres(value: unknown, unit: DimensionUnit): number | null {
    const number = numericDimension(value);
    return number === null ? null : cleanDecimal(number * centimetresPerUnit[unit]);
}

export function dimensionInputLimits(unit: DimensionUnit) {
    return {
        min: fromCentimetres(1, unit)!,
        max: fromCentimetres(999.99, unit)!,
        step: fromCentimetres(0.01, unit)!,
    };
}

export const DIMENSION_FIELD_LABELS: Record<string, string> = {
    shipping_length_cm: 'Length',
    shipping_width_cm: 'Width',
    shipping_height_cm: 'Height',
};

/** Render the chosen unit in admin without changing saved/custom column labels. */
export function dimensionColumnLabel(key: string, label: string, unit: DimensionUnit): string {
    if (!DIMENSION_FIELD_LABELS[key] || unit === 'cm') return label;
    return `${label.replace(/\s*\((?:mm|cm|m)\)\s*$/i, '').trim()} (${unit})`;
}
