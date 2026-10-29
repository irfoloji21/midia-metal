import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loginCustomer, logoutCustomer, type Customer } from '@/stores/auth';
import AccountIsland from './AccountIsland';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  loginCustomer({ id: 24, name: 'Test Customer', email: 'account@example.test' } as Customer);
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
});
afterEach(() => {
  cleanup();
  logoutCustomer();
  document.cookie = 'XSRF-TOKEN=; max-age=0; path=/';
  vi.unstubAllGlobals();
});

it('sends saved-card removal through the CSRF-protected API transport and refreshes the list', async () => {
  let deleted = false;
  const network = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return { ok: true, status: 204 };
    if (url === '/api/v1/customer/orders') return { ok: true, status: 200, json: async () => [] };
    if (url === '/api/v1/customer/payment-methods') return { ok: true, status: 200, json: async () => deleted ? [] : [{ id: 7, brand: 'visa', last4: '4242', exp_month: '12', exp_year: 2030 }] };
    if (url === '/api/v1/customer/payment-methods/7' && options?.method === 'DELETE') {
      const token = new Headers(options.headers).get('X-XSRF-TOKEN');
      if (token !== 'test-csrf-token') return { ok: false, status: 419, json: async () => ({ message: 'CSRF token mismatch' }) };
      deleted = true;
      return { ok: true, status: 200, json: async () => ({ message: 'Card removed successfully' }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', network);
  render(<AccountIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'Saved Cards' }));
  fireEvent.click(await screen.findByTitle('Remove card'));
  await waitFor(() => expect(deleted).toBe(true));
  expect(await screen.findByText('No saved cards')).toBeInTheDocument();
  const removal = network.mock.calls.find(([url]) => url.endsWith('/payment-methods/7'));
  expect(removal?.[1]?.credentials).toBe('include');
});
