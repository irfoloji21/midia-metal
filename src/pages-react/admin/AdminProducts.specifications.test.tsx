import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import AdminProducts from './AdminProducts';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/admin/ImageUpload', () => ({ default: () => null }));
vi.mock('@/components/admin/RichTextEditor', () => ({ default: () => null }));

const fetchMock = vi.mocked(apiFetch);
const fixture = {
  id: 59, name: 'Specification test product', price: '£10.00', active: true,
  variant_mode: 'legacy', specifications: { color: 'silver', material: 'steel' },
  variants: [{ option: 'Size', value: 'Standard', price: '10.00' }],
};
const saves = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT');
const savedProduct = () => JSON.parse(saves().at(-1)![1]!.body as string);

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
});
afterEach(cleanup);

async function edit(specifications: unknown = fixture.specifications, failFirstSave = false) {
  let attempts = 0;
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/admin/product-category-list') return [];
    if (options?.method === 'PUT') {
      if (failFirstSave && attempts++ === 0) throw new Error('Connection interrupted');
      return fixture;
    }
    return { data: [{ ...fixture, specifications }] };
  });
  render(<AdminProducts />);
  const row = (await screen.findByText(fixture.name)).closest('tr')!;
  fireEvent.click(within(row).getAllByRole('button')[0]);
}

it.each([
  fixture.specifications,
  [{ key: 'color', value: 'silver' }, { key: 'material', value: 'steel' }],
])('edits existing specification names and values without losing focus, including legacy data', async specifications => {
  await edit(specifications);
  const name = screen.getByRole('textbox', { name: 'Specification 1 name' });
  name.focus();
  for (const value of ['', 'F', 'Finish']) fireEvent.change(name, { target: { value } });
  expect(screen.getByRole('textbox', { name: 'Specification 1 name' })).toBe(name);
  expect(name).toHaveFocus();
  fireEvent.change(screen.getByRole('textbox', { name: 'Specification 1 value' }), { target: { value: 'brushed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(savedProduct()).toMatchObject({ name: fixture.name, specifications: { Finish: 'brushed', material: 'steel' } });
  expect(savedProduct().specifications).toEqual({ Finish: 'brushed', material: 'steel' });
});

it('rejects duplicate names without overwriting either row, then allows correction', async () => {
  await edit();
  fireEvent.change(screen.getByRole('textbox', { name: 'Specification 1 name' }), { target: { value: ' MATERIAL ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Specification names must be unique');
  expect(saves()).toHaveLength(0);
  expect(screen.getByRole('textbox', { name: 'Specification 1 value' })).toHaveValue('silver');
  expect(screen.getByRole('textbox', { name: 'Specification 2 value' })).toHaveValue('steel');
  fireEvent.change(screen.getByRole('textbox', { name: 'Specification 1 name' }), { target: { value: 'finish' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(savedProduct().specifications).toEqual({ finish: 'silver', material: 'steel' });
});

it.each(['Specification 1 name', 'Specification 1 value'])('keeps an incomplete existing %s until the user corrects or removes it', async label => {
  await edit();
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter both a name and a value');
  expect(saves()).toHaveLength(0);
  expect(screen.getByRole('textbox', { name: label })).toHaveValue(' ');
});

it('saves a pending new row without the plus button and preserves it after a failed request', async () => {
  await edit(fixture.specifications, true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Specification 1 value' }), { target: { value: 'black' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'New specification name' }), { target: { value: 'weight' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'New specification value' }), { target: { value: '5 kg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Connection interrupted'));
  expect(screen.getByRole('textbox', { name: 'New specification name' })).toHaveValue('weight');
  expect(screen.getByRole('textbox', { name: 'New specification value' })).toHaveValue('5 kg');
  expect(screen.getByRole('textbox', { name: 'Specification 1 value' })).toHaveValue('black');
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(saves()).toHaveLength(2));
  expect(savedProduct().specifications).toEqual({ color: 'black', material: 'steel', weight: '5 kg' });
});

it('adds, edits and removes rows while preserving the remaining row identities', async () => {
  await edit();
  fireEvent.change(screen.getByRole('textbox', { name: 'New specification name' }), { target: { value: 'weight' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(saves()).toHaveLength(0);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter both a name and a value');
  fireEvent.change(screen.getByRole('textbox', { name: 'New specification value' }), { target: { value: '5 kg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add specification' }));
  const weight = screen.getByRole('textbox', { name: 'Specification 3 value' });
  fireEvent.click(screen.getByRole('button', { name: 'Remove specification 1' }));
  expect(screen.getByRole('textbox', { name: 'Specification 2 value' })).toBe(weight);
  fireEvent.change(weight, { target: { value: '6 kg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(savedProduct().specifications).toEqual({ material: 'steel', weight: '6 kg' });
});

it('discards specification drafts and validation errors when editing is cancelled', async () => {
  await edit();
  fireEvent.change(screen.getByRole('textbox', { name: 'Specification 1 value' }), { target: { value: 'changed' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'New specification name' }), { target: { value: 'unfinished' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  const row = screen.getByText(fixture.name).closest('tr')!;
  fireEvent.click(within(row).getAllByRole('button')[0]);
  expect(screen.getByRole('textbox', { name: 'Specification 1 value' })).toHaveValue('silver');
  expect(screen.getByRole('textbox', { name: 'New specification name' })).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(saves()).toHaveLength(0);
});
