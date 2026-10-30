import { describe, expect, it } from 'vitest';
import { dimensionColumnLabel, dimensionInputLimits, fromCentimetres, getDimensionUnit, sizeLabelMeasurements, toCentimetres } from './dimensions';
import { cloneVariantTableColumns, normalizeVariantTableColumns } from './adminProductUtils';

describe('product measurement units', () => {
    it.each([
        ['mm', 1000], ['cm', 100], ['m', 1],
    ] as const)('represents the same metre in %s', (unit, displayed) => {
        expect(fromCentimetres(100, unit)).toBe(displayed);
        expect(toCentimetres(displayed, unit)).toBe(100);
    });

    it.each(['mm', 'cm', 'm'] as const)('preserves decimals and blank overrides in %s', unit => {
        for (const value of [0.01, 0.02, 0.99, 1, 1.15, 49.5, 999.99]) {
            expect(toCentimetres(fromCentimetres(value, unit), unit)).toBe(value);
        }
        for (const value of [null, undefined, '', ' ']) {
            expect(fromCentimetres(value, unit)).toBeNull();
            expect(toCentimetres(value, unit)).toBeNull();
        }
    });

    it('uses the same physical limits and precision for every unit', () => {
        expect(dimensionInputLimits('mm')).toEqual({ min: 0.1, max: 9999.9, step: 0.1 });
        expect(dimensionInputLimits('cm')).toEqual({ min: 0.01, max: 999.99, step: 0.01 });
        expect(dimensionInputLimits('m')).toEqual({ min: 0.0001, max: 9.9999, step: 0.0001 });
    });

    it('keeps small size labels nonzero without changing established centimetre-sized labels', () => {
        expect(sizeLabelMeasurements(0.01)).toEqual({ millimetres: 0.1, inches: 0.0039 });
        expect(sizeLabelMeasurements(0.99)).toEqual({ millimetres: 9.9, inches: 0.3898 });
        for (const value of [1, 1.15, 49.5, 100, 999.99]) {
            expect(sizeLabelMeasurements(value)).toEqual({ millimetres: Math.round(value * 10), inches: Math.round(Math.round(value * 10) / 25) });
        }
    });

    it('preserves unit metadata through column changes and cloning without adding it to legacy configs', () => {
        const original = normalizeVariantTableColumns(null);
        expect(original).not.toHaveProperty('dimension_unit');
        expect(getDimensionUnit(original.dimension_unit)).toBe('cm');
        const edited = { ...original, dimension_unit: 'm' as const };
        edited.size[3].label = 'Custom length (cm)';
        edited.size[3].visible = false;
        expect(cloneVariantTableColumns(normalizeVariantTableColumns(edited))).toEqual(edited);
        expect(dimensionColumnLabel('shipping_length_cm', edited.size[3].label, 'm')).toBe('Custom length (m)');
        expect(edited.size[3].label).toBe('Custom length (cm)');
        expect(dimensionColumnLabel('custom:height', 'Custom height', 'm')).toBe('Custom height');
        expect(getDimensionUnit('unknown')).toBe('cm');
    });
});
