import type { APIContext } from 'astro';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../pages/sitemap-content.xml';

const context = { site: new URL('https://midiammetal.com') } as APIContext;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('live content sitemap', () => {
  it('renders canonical URLs and valid XML for fresh API entries', async () => {
    // jsdom 20 has no AbortSignal.timeout; Node's server runtime does.
    vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { path: '/shop/fan', lastmod: '2026-10-23T12:00:00Z' },
      { path: '/blog/a&b', lastmod: null },
    ])));
    const response = await GET(context);
    expect(response.status).toBe(200);
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    expect([...xml.querySelectorAll('loc')].map(node => node.textContent)).toEqual(['https://midiammetal.com/shop/fan', 'https://midiammetal.com/blog/a&b']);
    expect(xml.querySelectorAll('lastmod')).toHaveLength(1);
  });

  it('returns a retryable failure instead of caching an empty sitemap when the API is down', async () => {
    vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    const response = await GET(context);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
