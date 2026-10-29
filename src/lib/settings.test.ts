import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./public-api', () => ({ fetchPublicJson: request }));
vi.mock('./api-base', () => ({ getApiBase: () => 'https://test.example/api' }));

describe('server-rendered shared settings recovery', () => {
  beforeEach(() => { vi.resetModules(); request.mockReset(); });
  afterEach(() => vi.restoreAllMocks());

  it('uses the resilient public GET helper and preserves successful company details during a later outage', async () => {
    request.mockResolvedValueOnce([{ key: 'contact_email', value: 'contact@example.test' }]).mockRejectedValueOnce(new Error('Upstream unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchSettings } = await import('./settings');
    expect(await fetchSettings()).toEqual({ contact_email: 'contact@example.test' });
    expect(await fetchSettings()).toEqual({ contact_email: 'contact@example.test' });
    expect(request).toHaveBeenCalledWith('https://test.example/api/v1/settings');
  });

  it('renders safely when no settings have ever been available', async () => {
    request.mockRejectedValueOnce(new Error('Upstream unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchSettings } = await import('./settings');
    expect(await fetchSettings()).toEqual({});
  });
});
