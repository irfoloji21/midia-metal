import { priceRangeError } from './price-filter';

export type ShopPriceFilter = {
  error: string;
  min: number;
  max: number;
  active: boolean;
  label: string;
};

export function resolveShopPriceFilter(minimum: string, maximum: string): ShopPriceFilter {
  const error = priceRangeError(minimum, maximum);
  const min = error || !minimum.trim() ? 0 : Number(minimum);
  const max = error || !maximum.trim() ? Infinity : Number(maximum);
  const active = min > 0 || Number.isFinite(max);

  let label = 'Price: Any price';
  if (Number.isFinite(max)) {
    label = min > 0 ? `Price: £${min} — £${max}` : `Price: Up to £${max}`;
  } else if (min > 0) {
    label = `Price: From £${min}`;
  }

  return { error, min, max, active, label };
}

export function matchesShopPrice(price: number, priceOnRequest: boolean, filter: ShopPriceFilter): boolean {
  if (filter.error) return true;
  if (priceOnRequest) return !filter.active;
  return price >= filter.min && price <= filter.max;
}
