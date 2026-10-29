import { describe, expect, it } from 'vitest';
import { matchesShopPrice, resolveShopPriceFilter } from './shop-price-filter';

describe('shop price filters', () => {
  it.each([['', ''], ['0', ''], ['  ', '  ']])('has no upper bound for %j–%j', (min, max) => {
    const filter = resolveShopPriceFilter(min, max);
    expect(filter).toEqual({ error: '', min: 0, max: Infinity, active: false, label: 'Price: Any price' });
    expect(matchesShopPrice(12345, false, filter)).toBe(true);
    expect(matchesShopPrice(0, true, filter)).toBe(true);
  });

  it('applies only a minimum when the maximum is blank', () => {
    const filter = resolveShopPriceFilter('50', '');
    expect(filter).toEqual({ error: '', min: 50, max: Infinity, active: true, label: 'Price: From £50' });
    expect(matchesShopPrice(49.99, false, filter)).toBe(false);
    expect(matchesShopPrice(50, false, filter)).toBe(true);
    expect(matchesShopPrice(12345, false, filter)).toBe(true);
    expect(matchesShopPrice(0, true, filter)).toBe(true);
  });

  it('applies an explicit maximum and includes the boundary', () => {
    const filter = resolveShopPriceFilter('', '100');
    expect(filter).toEqual({ error: '', min: 0, max: 100, active: true, label: 'Price: Up to £100' });
    expect(matchesShopPrice(100, false, filter)).toBe(true);
    expect(matchesShopPrice(100.01, false, filter)).toBe(false);
    expect(matchesShopPrice(0, true, filter)).toBe(true);
  });

  it('treats an explicit zero maximum as a real upper bound', () => {
    const filter = resolveShopPriceFilter('0', '0');
    expect(filter).toEqual({ error: '', min: 0, max: 0, active: true, label: 'Price: Up to £0' });
    expect(matchesShopPrice(0, false, filter)).toBe(true);
    expect(matchesShopPrice(0.01, false, filter)).toBe(false);
    expect(matchesShopPrice(0, true, filter)).toBe(true);
  });

  it('uses both bounds for a custom decimal range', () => {
    const filter = resolveShopPriceFilter('50.50', '100.75');
    expect(filter).toEqual({ error: '', min: 50.5, max: 100.75, active: true, label: 'Price: £50.5 — £100.75' });
    expect(matchesShopPrice(50.49, false, filter)).toBe(false);
    expect(matchesShopPrice(50.5, false, filter)).toBe(true);
    expect(matchesShopPrice(100.75, false, filter)).toBe(true);
    expect(matchesShopPrice(100.76, false, filter)).toBe(false);
    expect(matchesShopPrice(0, true, filter)).toBe(true);
  });

  it.each([['-1', ''], ['', '-1'], ['100', '50'], ['abc', ''], ['', 'Infinity'], ['NaN', '100']])(
    'reports invalid %j–%j without hiding products', (min, max) => {
      const filter = resolveShopPriceFilter(min, max);
      expect(filter.error).not.toBe('');
      expect(filter).toMatchObject({ min: 0, max: Infinity, active: false, label: 'Price: Any price' });
      expect(matchesShopPrice(12345, false, filter)).toBe(true);
      expect(matchesShopPrice(0, true, filter)).toBe(true);
    },
  );
});
