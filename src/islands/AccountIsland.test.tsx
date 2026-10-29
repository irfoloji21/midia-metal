import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api';
import { $customer, loginCustomer, logoutCustomer, type Customer } from '@/stores/auth';
import { toast } from 'sonner';
import AccountIsland from './AccountIsland';

vi.mock('@/lib/api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const customer = { id: 24, name: 'Test Customer', email: 'account@example.test' } as Customer;
const quote = { id: 9, service: 'Canopy installation', description: 'Our saved quotation request', status: 'new', created_at: '2026-10-24T00:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('location', { href: '/account' });
  loginCustomer(customer);
  vi.mocked(apiFetch).mockResolvedValue([]);
});
afterEach(() => { cleanup(); logoutCustomer(); vi.unstubAllGlobals(); });

it.each([
  ['Profile', 'Save Changes', 'name', 'Test Customer', 'Updated Customer'],
  ['Addresses', 'Save Addresses', 'billing_address', '12 Old Street', '34 New Street'],
])('saves %s changes without resubmitting a legacy customer’s business details', async (tab, saveLabel, field, original, updated) => {
  const legacyCustomer = {
    ...customer,
    billing_address: '12 Old Street',
    is_business: true,
    company_name: 'Previous Company Ltd',
    company_vat_number: 'GB123456789',
  };
  loginCustomer(legacyCustomer);
  vi.mocked(apiFetch).mockImplementation(async (endpoint, options) => {
    if (endpoint === '/v1/customer/profile') {
      return { ...legacyCustomer, ...JSON.parse(options?.body as string) };
    }
    return [];
  });
  render(<AccountIsland />);
  fireEvent.click(screen.getByRole('button', { name: tab }));
  expect(screen.queryByText('I am a business')).not.toBeInTheDocument();
  expect(screen.queryByText('Company Name')).not.toBeInTheDocument();
  expect(screen.queryByText('Company VAT Number')).not.toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue(original), { target: { value: updated } });
  fireEvent.click(screen.getByRole('button', { name: saveLabel }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  const save = vi.mocked(apiFetch).mock.calls.find(([endpoint]) => endpoint === '/v1/customer/profile');
  const payload = JSON.parse(save?.[1]?.body as string);
  expect(payload[field]).toBe(updated);
  for (const key of ['is_business', 'company_name', 'company_vat_number']) {
    expect(payload).not.toHaveProperty(key);
  }
  expect($customer.get()).toMatchObject({
    [field]: updated,
    is_business: true,
    company_name: legacyCustomer.company_name,
    company_vat_number: legacyCustomer.company_vat_number,
  });
});

it('keeps the customer signed in when logout fails, then retries successfully', async () => {
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/customer/logout') throw new ApiError('Bad gateway', 502);
    return [];
  });
  render(<AccountIsland />);
  await screen.findByText("You haven't placed any orders yet.");
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  fireEvent.change(screen.getByDisplayValue('Test Customer'), { target: { value: 'Unsaved contact name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect($customer.get()).toEqual(customer);
  expect(window.location.href).toBe('/account');
  expect(screen.getByDisplayValue('Unsaved contact name')).toBeInTheDocument();
  vi.mocked(apiFetch).mockResolvedValueOnce({ message: 'Logged out' });
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  await waitFor(() => expect($customer.get()).toBeNull());
  expect(window.location.href).toBe('/');
});

it('shows a retryable quote loading error instead of claiming the customer has no quotes', async () => {
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/customer/quotes') throw new ApiError('Unavailable', 500);
    return [];
  });
  render(<AccountIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'My Quotes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your quotes');
  expect(screen.queryByText("You haven't submitted any quotes yet.")).not.toBeInTheDocument();
  vi.mocked(apiFetch).mockResolvedValueOnce([quote]);
  fireEvent.click(screen.getByRole('button', { name: 'Retry quotes' }));
  expect(await screen.findByText(quote.description)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not let an old quote response replace the result after leaving and reopening the tab', async () => {
  let resolveOld!: (value: unknown[]) => void;
  let count = 0;
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint !== '/v1/customer/quotes') return [];
    if (++count === 1) return new Promise<unknown[]>(resolve => { resolveOld = resolve; });
    return [quote];
  });
  render(<AccountIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'My Quotes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'My Quotes' }));
  expect(await screen.findByText(quote.description)).toBeInTheDocument();
  await act(async () => { resolveOld([{ ...quote, id: 1, description: 'Outdated request' }]); });
  expect(screen.getByText(quote.description)).toBeInTheDocument();
  expect(screen.queryByText('Outdated request')).not.toBeInTheDocument();
});

it.each([
  ['Orders', '/v1/customer/orders', 'Retry orders', "You haven't placed any orders yet."],
  ['Saved Cards', '/v1/customer/payment-methods', 'Retry saved cards', 'No saved cards'],
])('keeps an unavailable %s list distinct from an empty list', async (tab, endpoint, retryLabel, emptyLabel) => {
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path === endpoint) throw new ApiError('Unavailable', 503);
    return [];
  });
  render(<AccountIsland />);
  fireEvent.click(screen.getByRole('button', { name: tab }));
  const retry = await screen.findByRole('button', { name: retryLabel });
  expect(screen.queryByText(emptyLabel)).not.toBeInTheDocument();
  vi.mocked(apiFetch).mockResolvedValueOnce([]);
  fireEvent.click(retry);
  expect(await screen.findByText(emptyLabel)).toBeInTheDocument();
});

it('prevents duplicate logout requests while waiting and accepts an already-expired session', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(apiFetch).mockImplementation(async endpoint => {
    if (endpoint === '/v1/customer/logout') return new Promise((_resolve, no) => { reject = no; });
    return [];
  });
  render(<AccountIsland />);
  await screen.findByText("You haven't placed any orders yet.");
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  const pending = screen.getByRole('button', { name: 'Logging out…' });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/v1/customer/logout')).toHaveLength(1);
  await act(async () => { reject(new ApiError('Unauthenticated', 401)); });
  expect($customer.get()).toBeNull();
  expect(window.location.href).toBe('/');
  expect(toast.error).not.toHaveBeenCalled();
});

it('returns an expired customer session to login when a protected account request returns 401', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new ApiError('Unauthenticated', 401));
  render(<AccountIsland />);
  await waitFor(() => expect(window.location.href).toBe('/login'));
  expect($customer.get()).toBeNull();
  expect(screen.queryByText("You haven't placed any orders yet.")).not.toBeInTheDocument();
});
