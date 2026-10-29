import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import AdminProducts from './AdminProducts';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/admin/ImageUpload', () => ({ default: () => null }));
vi.mock('@/components/admin/RichTextEditor', () => ({ default: () => null }));
const fetchMock = vi.mocked(apiFetch);
const product = {
  id: 83, name: 'QA matrix', price: '£10.00', old_price: '', active: true,
  track_stock: true, stock_quantity: 5, variant_mode: 'combination',
  variant_options: ['Finish'], frontend_variant_layout: 'default',
  variants: [
    { attributes: { Finish: 'Brushed' }, price: '10.00', stock: 2, shipping_weight_kg: 1, shipping_length_cm: 10, shipping_width_cm: 10, shipping_height_cm: 10 },
    { attributes: { Finish: 'Polished' }, price: '15.00', stock: 3, shipping_weight_kg: 1, shipping_length_cm: 10, shipping_width_cm: 10, shipping_height_cm: 10 },
  ],
};

beforeEach(() => fetchMock.mockReset());
afterEach(cleanup);

it.each(['default', 'selection_table'])('preserves the saved combination structure and %s layout through edit and save', async layout => {
  const fixture = { ...product, frontend_variant_layout: layout, selection_table_config: layout === 'selection_table' ? { tab_option: 'Finish' } : null };
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/admin/product-category-list') return [];
    if (options?.method === 'PUT') return fixture;
    return { data: [fixture] };
  });
  render(<AdminProducts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit QA matrix' }));
  expect(screen.getByRole('radio', { name: /Combination matrix/ })).toBeChecked();
  expect(screen.getAllByDisplayValue('Brushed').length).toBeGreaterThan(0);
  expect(screen.getAllByDisplayValue('Polished').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
  const [, options] = fetchMock.mock.calls.find(([, request]) => request?.method === 'PUT')!;
  const saved = JSON.parse(options!.body as string);
  expect(saved.variant_mode).toBe('combination');
  expect(saved.variant_options).toEqual(['Finish']);
  expect(saved.frontend_variant_layout).toBe(layout);
  expect(saved.variants).toEqual(expect.arrayContaining([
    expect.objectContaining({ attributes: { Finish: 'Brushed' }, stock: 2 }),
    expect.objectContaining({ attributes: { Finish: 'Polished' }, stock: 3 }),
  ]));
});
