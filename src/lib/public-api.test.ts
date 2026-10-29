import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicJson, PublicApiError } from './public-api';

const jsonResponse = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

describe('public API read recovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('recovers from a temporary server failure using GET only', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({}, 500)).mockResolvedValueOnce(jsonResponse({ id: 51 }));
    vi.stubGlobal('fetch', fetcher);
    const assertion = expect(fetchPublicJson('/api/v1/products/51')).resolves.toEqual({ id: 51 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({ method: 'GET', cache: 'no-store' });
  });

  it.each([401, 403, 404, 422])('does not retry HTTP %s', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, status));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchPublicJson('/api/v1/products/missing')).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops after three attempts when the server remains unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    vi.stubGlobal('fetch', fetcher);
    const assertion = expect(fetchPublicJson('/api/v1/settings')).rejects.toBeInstanceOf(PublicApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each(['network', 'json'])('recovers from a transient %s failure', async (failure) => {
    const fetcher = vi.fn();
    if (failure === 'network') fetcher.mockRejectedValueOnce(new TypeError('fetch failed'));
    else fetcher.mockResolvedValueOnce(new Response(''));
    fetcher.mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    const assertion = expect(fetchPublicJson('/api/v1/settings')).resolves.toEqual({ ok: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caps Retry-After so a rate-limited read cannot hold rendering indefinitely', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '3600' })).mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetcher);
    const assertion = expect(fetchPublicJson('/api/v1/settings')).resolves.toEqual([]);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not send a request when its caller already aborted', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchPublicJson('/api/v1/settings', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('cancels the backoff without retrying when the caller aborts', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    const assertion = expect(fetchPublicJson('/api/v1/settings', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bounds stalled requests and stops after two retries', async () => {
    const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const assertion = expect(fetchPublicJson('/api/v1/settings', { timeoutMs: 20 })).rejects.toMatchObject({ name: 'AbortError' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
