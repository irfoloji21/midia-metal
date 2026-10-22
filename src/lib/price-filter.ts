export function priceRangeError(minimum: string, maximum: string): string {
  for (const value of [minimum, maximum]) {
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0)) return 'Enter prices of £0 or more.';
  }
  if (minimum.trim() && maximum.trim() && Number(minimum) > Number(maximum)) return 'Minimum price must not exceed maximum price.';
  return '';
}
