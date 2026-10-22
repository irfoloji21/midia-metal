import { expect, it } from 'vitest';
import { priceRangeError } from './price-filter';
it.each([['-1', ''], ['', '-0.01'], ['100', '50'], ['abc', '']])('rejects invalid range %s–%s', (min, max) => expect(priceRangeError(min, max)).not.toBe(''));
it.each([['', ''], ['0', '0'], ['50', '100'], ['', '100']])('accepts range %s–%s', (min, max) => expect(priceRangeError(min, max)).toBe(''));
