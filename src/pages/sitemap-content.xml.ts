import type { APIRoute } from 'astro';
import { getApiBase } from '@/lib/api-base';

export const prerender = false;
const xml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!);

export const GET: APIRoute = async ({ site }) => {
  try {
    const response = await fetch(`${getApiBase()}/v1/sitemap`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Sitemap API: ${response.status}`);
    const entries: Array<{ path: string; lastmod?: string }> = await response.json();
    const origin = (site || new URL('https://midiammetal.com')).origin;
    const urls = entries.map(entry => {
      if (!/^\/(shop|blog|services|portfolio)\//.test(entry.path)) throw new Error('Invalid sitemap path');
      const lastmod = entry.lastmod && !Number.isNaN(Date.parse(entry.lastmod)) ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : '';
      return `<url><loc>${xml(origin + entry.path)}</loc>${lastmod}</url>`;
    }).join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
