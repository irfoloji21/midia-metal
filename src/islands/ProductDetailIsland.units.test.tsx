import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetailIsland from './ProductDetailIsland';
import { logoutCustomer } from '@/stores/auth';
import { $cart } from '@/stores/cart';

const product = {
  id: 58,
  slug: 'dimension-display-fixture',
  name: 'Dimension display fixture',
  price: '£25.00',
  description: 'Product description',
  image: '/filter.jpg',
  gallery: [],
  reviews: [],
  track_stock: true,
  stock_quantity: 50,
  show_variant_in_title: true,
};

const dimensions = { shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20 };
const rawSize = 'Size : H 500 x W 1000 x D 200mm (20" x 40" x 8")';
const rawSecondSize = 'Size : H 1000 x W 2000 x D 400mm (40" x 80" x 16")';
const sizeVariant = { option: 'Size', value: rawSize, price: 25, stock: 7, ...dimensions };
const unitCases = [
  { savedUnit: undefined, unit: 'cm', values: ['100', '50', '20'], summary: 'H 50 x W 100 x D 20cm (20" x 40" x 8")' },
  { savedUnit: 'cm', unit: 'cm', values: ['100', '50', '20'], summary: 'H 50 x W 100 x D 20cm (20" x 40" x 8")' },
  { savedUnit: 'mm', unit: 'mm', values: ['1000', '500', '200'], summary: 'H 500 x W 1000 x D 200mm (20" x 40" x 8")' },
  { savedUnit: 'm', unit: 'm', values: ['1', '0.5', '0.2'], summary: 'H 0.5 x W 1 x D 0.2m (20" x 40" x 8")' },
];

beforeEach(() => {
  logoutCustomer();
  $cart.set([]);
});

afterEach(() => {
  cleanup();
  logoutCustomer();
  $cart.set([]);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderProduct(fixture: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const method = options?.method ?? (input instanceof Request ? input.method : 'GET');
    if (method !== 'GET') throw new Error('Product display tests must not submit requests');
    const url = String(input);
    if (!url.includes('/v1/products/')) throw new Error(`Unexpected request: ${url}`);
    return { ok: true, status: 200, json: async () => url.endsWith('/related') ? [] : fixture } as Response;
  }));
  render(<ProductDetailIsland id={String(fixture.slug)} initialProduct={fixture} initialRelated={[]} />);
  await act(async () => {});
}

function expectSpecification(label: string, value: string) {
  const specifications = screen.getByRole('complementary', { name: 'Product specifications' });
  const row = within(specifications).getByText(label, { exact: true }).parentElement!;
  expect(within(row).getByText(value, { exact: true })).toBeInTheDocument();
}

describe('product dimension display units', () => {
  it.each(unitCases)('shows $unit labels and values with saved preference $savedUnit, retaining inches', async ({ savedUnit, unit, values, summary }) => {
    const fixture = {
      ...product,
      ...(savedUnit ? { variant_table_columns: { dimension_unit: savedUnit } } : {}),
      variants: [sizeVariant],
    };
    const original = JSON.stringify(fixture);
    await renderProduct(fixture);

    ['Length', 'Width', 'Height'].forEach((label, index) => {
      expectSpecification(`${label} (${unit})`, `${values[index]} ${unit} (${['39.37', '19.69', '7.87'][index]} in)`);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${product.name} - Size : ${summary}`);
    expectSpecification('Size', `Size : ${summary}`);
    expect(JSON.stringify(fixture)).toBe(original);
  });

  it.each([
    { unit: 'mm', values: ['0.1', '0.2', '0.3'] },
    { unit: 'cm', values: ['0.01', '0.02', '0.03'] },
    { unit: 'm', values: ['0.0001', '0.0002', '0.0003'] },
  ])('keeps sub-centimetre dimensions nonzero in $unit and inches', async ({ unit, values }) => {
    await renderProduct({
      ...product,
      variant_table_columns: { dimension_unit: unit },
      variants: [{ ...sizeVariant, value: 'Tiny panel', shipping_length_cm: 0.01, shipping_width_cm: 0.02, shipping_height_cm: 0.03 }],
    });

    ['Length', 'Width', 'Height'].forEach((label, index) => {
      expectSpecification(`${label} (${unit})`, `${values[index]} ${unit} (${['0.0039', '0.0079', '0.0118'][index]} in)`);
    });
    expectSpecification('Size', 'Tiny panel');
  });

  it('converts generated option text while retaining raw selection, cart identity, price and stock', async () => {
    const secondVariant = {
      ...sizeVariant, value: rawSecondSize, price: 32.5, stock: 3,
      shipping_length_cm: 200, shipping_width_cm: 100, shipping_height_cm: 40,
    };
    const fixture = { ...product, variant_table_columns: { dimension_unit: 'm' }, variants: [sizeVariant, secondVariant] };
    const original = JSON.stringify(fixture);
    await renderProduct(fixture);

    const select = screen.getByRole('combobox', { name: 'Size:' });
    expect(within(select).getByRole('option', { name: 'Size : H 0.5 x W 1 x D 0.2m (20" x 40" x 8")' })).toHaveValue(rawSize);
    expect(within(select).getByRole('option', { name: 'Size : H 1 x W 2 x D 0.4m (40" x 80" x 16")' })).toHaveValue(rawSecondSize);
    fireEvent.change(select, { target: { value: rawSecondSize } });
    expect(select).toHaveValue(rawSecondSize);
    expectSpecification('Length (m)', '2 m (78.74 in)');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Size : H 1 x W 2 x D 0.4m (40" x 80" x 16")');
    fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    await act(async () => {});

    expect($cart.get()).toHaveLength(1);
    expect($cart.get()[0]).toMatchObject({
      id: `58-Size-${rawSecondSize}`, price: '£32.50', qty: 1, available_stock: 3,
      selected_variants: { Size: secondVariant },
    });
    expect(JSON.stringify(fixture)).toBe(original);
  });

  it.each(unitCases)('uses $unit for combination summaries and headings without rewriting attributes', async ({ savedUnit, unit, values, summary }) => {
    const fixture = {
      ...product,
      variant_mode: 'combination', variant_options: ['Material'],
      ...(savedUnit ? { variant_table_columns: { dimension_unit: savedUnit } } : {}),
      variants: [
        { attributes: { Material: 'Steel' }, price: 25, stock: 7, ...dimensions },
        { attributes: { Material: 'Copper' }, price: 32.5, stock: 3, ...dimensions },
      ],
    };
    const original = JSON.stringify(fixture);
    await renderProduct(fixture);
    fireEvent.change(screen.getByRole('combobox', { name: 'Material:' }), { target: { value: 'Copper' } });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${product.name} - Copper / ${summary}`);
    expect(screen.getByText(summary, { exact: true })).toBeInTheDocument();
    expectSpecification('Length (' + unit + ')', `${values[0]} ${unit} (39.37 in)`);
    fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    await act(async () => {});
    expect($cart.get()[0]).toMatchObject({
      id: '58-Material-Copper', price: '£32.50', qty: 1, available_stock: 3,
      selected_variants: { Material: { option: 'Material', value: 'Copper' } },
    });
    expect(JSON.stringify(fixture)).toBe(original);
  });

  it('preserves custom dimension-like literals, custom column labels and explicit combination Size attributes', async () => {
    const literal = 'Custom panel 1000 x 500 mm';
    const fixture = {
      ...product,
      variant_mode: 'combination', variant_options: ['Size'],
      specifications: { 'Drawing dimensions': '1000 x 500 mm as drawn' },
      variant_table_columns: {
        dimension_unit: 'm',
        size: [{ key: 'shipping_length_cm', label: 'Panel length (cm)', visible: true, frontendVisible: true }],
        combination: [{ key: 'custom:drawing', label: 'Drawing (mm)', visible: true, frontendVisible: true }],
      },
      variants: [{ attributes: { Size: literal }, price: 25, stock: 7, ...dimensions, custom_fields: { drawing: '1000 mm nominal' } }],
    };
    await renderProduct(fixture);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${product.name} - ${literal}`);
    expectSpecification('Size', literal);
    expectSpecification('Drawing dimensions', '1000 x 500 mm as drawn');
    expectSpecification('Drawing (mm)', '1000 mm nominal');
    expectSpecification('Panel length (m)', '1 m (39.37 in)');
    fireEvent.click(screen.getByRole('button', { name: 'Add to basket' }));
    await act(async () => {});
    expect($cart.get()[0].selected_variants?.Size.value).toBe(literal);
  });
});
