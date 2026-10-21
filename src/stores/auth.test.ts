import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $customer, $isAuthLoading, $authError, fetchCurrentCustomer, loginCustomer, logoutCustomer, type Customer } from './auth';

const customer = { id: 2, name: 'Test Customer', email: 'test@example.com' } as Customer;
const response = (status: number, data: unknown = customer) => ({ ok: status === 200, status, json: async () => data }) as Response;

beforeEach(() => { logoutCustomer(); $isAuthLoading.set(true); });
afterEach(() => { logoutCustomer(); vi.unstubAllGlobals(); });

describe('shared customer session', () => {
  it('coalesces concurrent checks and does not decide guest while the request is pending', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn((_url: string) => new Promise<Response>(r => { resolve = r; }));
    vi.stubGlobal('fetch', fetch);
    const first = fetchCurrentCustomer();
    const second = fetchCurrentCustomer();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect($isAuthLoading.get()).toBe(true);
    resolve(response(200));
    await first;
    expect($customer.get()?.id).toBe(2);
    expect($isAuthLoading.get()).toBe(false);
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/customer/me');
  });

  it('treats 401 as guest', async () => {
    loginCustomer(customer);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));
    await fetchCurrentCustomer();
    expect($customer.get()).toBeNull();
    expect($authError.get()).toBeNull();
    expect($isAuthLoading.get()).toBe(false);
  });

  it.each([403, 429, 500])('keeps HTTP %s separate from a signed-out session and supports retry', async status => {
    loginCustomer(customer);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(status)).mockResolvedValueOnce(response(200)));
    await fetchCurrentCustomer();
    expect($authError.get()).toBeTruthy();
    expect($customer.get()).toEqual(customer);
    await fetchCurrentCustomer();
    expect($authError.get()).toBeNull();
    expect($customer.get()).toEqual(customer);
  });

  it('reports a network failure without declaring the visitor signed out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
    await fetchCurrentCustomer();
    expect($authError.get()).toBeTruthy();
    expect($isAuthLoading.get()).toBe(false);
  });

  it.each(['login', 'logout'])('ignores a stale request after %s', async action => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
    const pending = fetchCurrentCustomer();
    await Promise.resolve();
    if (action === 'login') loginCustomer(customer);
    else logoutCustomer();
    resolve(response(200, { ...customer, id: 999 }));
    await pending;
    expect($customer.get()).toEqual(action === 'login' ? customer : null);
    expect($isAuthLoading.get()).toBe(false);
  });
});
