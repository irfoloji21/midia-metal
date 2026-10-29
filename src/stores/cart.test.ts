import { afterEach, expect, it, vi } from 'vitest';
import { $cart, $cartIssues, addToCart, refreshCartAvailability } from './cart';
import { apiFetch, ApiError } from '@/lib/api';
vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
afterEach(() => { $cart.set([]); vi.clearAllMocks(); });

it('does not report an addition when the basket already contains all available stock', () => {
  const product = { id: 83, name: 'Stocked product', price: '10.00', image: '', track_stock: true, stock_quantity: 2 };
  expect(addToCart(product, 2)).toBe(true);
  expect(addToCart(product, 1)).toBe(false);
  expect($cart.get()[0].qty).toBe(2);
});

it('reports a partial stock-limited addition only while the quantity actually increases', () => {
  const product = { id: 83, name: 'Stocked product', price: '10.00', image: '', track_stock: true, stock_quantity: 3 };
  addToCart(product, 2);
  expect(addToCart(product, 2)).toBe(true);
  expect($cart.get()[0].qty).toBe(3);
  expect(addToCart(product, 2)).toBe(false);
});

it('refreshes zero stock and price while preserving the requested quantity', async () => {
  $cart.set([{ id: '1-Material-Steel', product_id: 1, name: 'Steel', image: '', price: '£12.50', qty: 2, available_stock: 5, selected_variants: { Material: { option: 'Material', value: 'Steel' } } }]);
  vi.mocked(apiFetch).mockResolvedValue({ id: 1, price: '£12.50', variant_mode: 'combination', variants: [{ attributes: { Material: 'Steel' }, price: 24.75, stock: 0 }] });
  await refreshCartAvailability();
  expect($cart.get()[0]).toMatchObject({ qty: 2, price: '£24.75', available_stock: 0 });
  expect($cartIssues.get()[0]).toContain('out of stock');
});
it('reports inactive products instead of retaining their old availability', async () => {
  $cart.set([{ id: '1', product_id: 1, name: 'Steel', image: '', price: '£12.50', qty: 1, available_stock: 5 }]);
  vi.mocked(apiFetch).mockRejectedValue(new ApiError('Not found', 404));
  await refreshCartAvailability();
  expect($cartIssues.get()[0]).toContain('no longer available');
});
it('preserves a basket during a network failure', async () => {
  $cart.set([{ id: '1', product_id: 1, name: 'Steel', image: '', price: '£12.50', qty: 1, available_stock: 5 }]);
  vi.mocked(apiFetch).mockRejectedValue(new Error('Offline'));
  await expect(refreshCartAvailability()).rejects.toThrow('Offline');
  expect($cart.get()[0].available_stock).toBe(5);
});
