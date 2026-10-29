import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import AdminProducts from './AdminProducts';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/ImageUpload', () => ({ default: () => null }));
vi.mock('@/components/admin/SectionTemplateEditor', () => ({ default: () => null }));

type Mode = 'legacy' | 'combination';
type Unit = 'mm' | 'cm' | 'm';
type Axis = 'Length' | 'Width' | 'Height';

const fetchMock = vi.mocked(apiFetch);
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const sizeValue = 'Size : H 500 x W 1000 x D 200mm (20" x 40" x 8")';

function product(mode: Mode = 'legacy', id = 83) {
  return {
    id, name: `Measurement product ${id}`, price: '£12.50', old_price: '£20.00', active: true,
    track_stock: true, stock_quantity: 7, variant_mode: mode,
    variant_options: mode === 'combination' ? ['Finish'] : null,
    frontend_variant_layout: 'default', specifications: { Material: 'Steel' }, tags: ['metal'],
    shipping_weight_kg: 2.75, shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20,
    shipping_class: 'freight', freight_delivery_price: 35, ships_separately: true,
    variant_table_columns: {
      size: [
        { key: 'shipping_length_cm', label: 'Overall length (cm)', visible: true, frontendVisible: true },
        { key: 'custom:part_number', label: 'Part number', visible: true, frontendVisible: true },
      ],
      general: [],
      combination: [
        { key: 'custom:part_number', label: 'Part number', visible: true, frontendVisible: true },
      ],
    },
    variants: [{
      ...(mode === 'combination' ? { attributes: { Finish: 'Brushed' } } : { option: 'Size', value: sizeValue }),
      price: '12.50', stock: 7, shipping_weight_kg: 2.75,
      shipping_length_cm: 100 as number | null, shipping_width_cm: 50 as number | null, shipping_height_cm: 20 as number | null,
      shipping_class: 'freight', ships_separately: true, custom_fields: { part_number: 'KEEP-100' },
    }],
  };
}

const saves = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT');
const savedProduct = () => JSON.parse(saves().at(-1)![1]!.body as string);
const unitSelect = () => screen.getByRole('combobox', { name: 'Measurement unit' });
const changeUnit = (unit: Unit) => fireEvent.change(unitSelect(), { target: { value: unit } });
const dimensionInputs = (axis: Axis, unit: Unit) => screen.getAllByRole('spinbutton', { name: `${axis} (${unit})` });
const existingDimension = (axis: Axis, unit: Unit) => dimensionInputs(axis, unit)[0];
const draftDimension = (axis: Axis, unit: Unit) => dimensionInputs(axis, unit).at(-1)!;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
});
afterEach(cleanup);

async function mountProducts(fixtures = [product()]) {
  let products = copy(fixtures);
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/admin/product-category-list') return [];
    if (options?.method === 'PUT') {
      const saved = JSON.parse(options.body as string);
      products = products.map(item => item.id === saved.id ? copy(saved) : item);
      return copy(saved);
    }
    if (url === '/admin/products?per_page=500') return { data: copy(products) };
    throw new Error(`Unexpected mocked API request: ${url}`);
  });
  render(<AdminProducts />);
  await editProduct(fixtures[0].name);
}

async function editProduct(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }));
  await screen.findByRole('combobox', { name: 'Measurement unit' });
}

async function saveProduct() {
  const previousCount = saves().length;
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(saves()).toHaveLength(previousCount + 1));
  await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Measurement unit' })).not.toBeInTheDocument());
  return savedProduct();
}

describe('product measurement units', () => {
  it.each<Mode>(['legacy', 'combination'])('defaults old %s products to cm and changes only unit metadata when switching existing rows', async mode => {
    const fixture = product(mode);
    await mountProducts([fixture]);
    expect(unitSelect()).toHaveValue('cm');
    expect(within(unitSelect()).getAllByRole('option').map(option => (option as HTMLOptionElement).value)).toEqual(expect.arrayContaining(['mm', 'cm', 'm']));
    const baseline = await saveProduct();
    await editProduct(fixture.name);

    for (const [unit, length, width, height] of [
      ['m', 1, 0.5, 0.2], ['mm', 1000, 500, 200], ['cm', 100, 50, 20], ['m', 1, 0.5, 0.2],
    ] as const) {
      changeUnit(unit);
      expect(existingDimension('Length', unit)).toHaveValue(length);
      expect(existingDimension('Width', unit)).toHaveValue(width);
      expect(existingDimension('Height', unit)).toHaveValue(height);
    }

    const saved = await saveProduct();
    expect(saved).toEqual({
      ...baseline,
      variant_table_columns: { ...baseline.variant_table_columns, dimension_unit: 'm' },
    });
    expect(saved.variants).toEqual(baseline.variants);
    expect(saved.variant_table_columns.size.find((column: { key: string }) => column.key === 'shipping_length_cm').label).toBe('Overall length (cm)');
  });

  it.each<Mode>(['legacy', 'combination'])('converts a new %s row while it is still a draft and saves canonical centimetres', async mode => {
    const fixture = product(mode);
    await mountProducts([fixture]);
    changeUnit('m');
    for (const [axis, value] of [['Length', '1.25'], ['Width', '0.5'], ['Height', '0.2']] as const) {
      fireEvent.change(draftDimension(axis, 'm'), { target: { value } });
    }
    const draftRow = draftDimension('Length', 'm').closest('tr')!;
    if (mode === 'combination') fireEvent.change(within(draftRow).getByPlaceholderText('Finish'), { target: { value: 'Polished' } });
    fireEvent.change(within(draftRow).getByPlaceholderText('12.50'), { target: { value: '31.50' } });
    fireEvent.change(within(draftRow).getByPlaceholderText('10'), { target: { value: '3' } });

    changeUnit('mm');
    expect(draftDimension('Length', 'mm')).toHaveValue(1250);
    expect(draftDimension('Width', 'mm')).toHaveValue(500);
    expect(draftDimension('Height', 'mm')).toHaveValue(200);
    changeUnit('cm');
    expect(draftDimension('Length', 'cm')).toHaveValue(125);
    fireEvent.click(within(draftDimension('Length', 'cm').closest('tr')!).getByRole('button', { name: 'Add' }));
    changeUnit('m');
    expect(dimensionInputs('Length', 'm')[1]).toHaveValue(1.25);
    expect(draftDimension('Length', 'm')).toHaveValue(null);

    const saved = await saveProduct();
    expect(saved.variant_table_columns.dimension_unit).toBe('m');
    expect(saved.variants).toHaveLength(2);
    expect(saved.variants[0]).toMatchObject({ shipping_length_cm: 100, shipping_width_cm: 50, shipping_height_cm: 20, stock: 7, custom_fields: { part_number: 'KEEP-100' } });
    expect(saved.variants[1]).toMatchObject({ shipping_length_cm: 125, shipping_width_cm: 50, shipping_height_cm: 20, stock: 3 });
    expect(Number(String(saved.variants[1].price).replace('£', ''))).toBe(31.5);
    if (mode === 'combination') expect(saved.variants[1].attributes).toEqual({ Finish: 'Polished' });
    else expect(saved.variants[1].value).toBe('Size : H 500 x W 1250 x D 200mm (20" x 50" x 8")');
  });

  it('persists the saved unit on reopen and keeps it isolated from other products and cancelled drafts', async () => {
    const first = product('legacy', 83);
    const second = product('legacy', 84);
    await mountProducts([first, second]);
    changeUnit('mm');
    await saveProduct();
    await editProduct(first.name);
    expect(unitSelect()).toHaveValue('mm');
    expect(existingDimension('Length', 'mm')).toHaveValue(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await editProduct(second.name);
    expect(unitSelect()).toHaveValue('cm');
    expect(existingDimension('Length', 'cm')).toHaveValue(100);
    changeUnit('m');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await editProduct(second.name);
    expect(unitSelect()).toHaveValue('cm');
    expect(saves()).toHaveLength(1);
  });

  it.each<Mode>(['legacy', 'combination'])('keeps empty %s dimension overrides null through unit switches and editing', async mode => {
    const fixture = product(mode);
    Object.assign(fixture.variants[0], { shipping_length_cm: null, shipping_width_cm: null, shipping_height_cm: null });
    await mountProducts([fixture]);
    changeUnit('m');
    expect(existingDimension('Length', 'm')).toHaveValue(null);
    expect(draftDimension('Length', 'm')).toHaveValue(null);
    fireEvent.change(existingDimension('Length', 'm'), { target: { value: '1' } });
    fireEvent.change(existingDimension('Length', 'm'), { target: { value: '' } });
    changeUnit('mm');
    for (const axis of ['Length', 'Width', 'Height'] as const) expect(existingDimension(axis, 'mm')).toHaveValue(null);
    const saved = await saveProduct();
    expect(saved.variants[0]).toMatchObject({ shipping_length_cm: null, shipping_width_cm: null, shipping_height_cm: null, stock: 7 });
    expect(saved.shipping_length_cm).toBe(100);
  });
});
