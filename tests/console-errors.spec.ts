import { test, expect, API_BASE, hydrated, seedCheckout, mockCheckoutApi } from './support/fixtures';
import type { Page, BrowserContext, Request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const adminRoutes = [
  '/admin', '/admin/dashboard', '/admin/products', '/admin/product-categories', '/admin/blog',
  '/admin/portfolio', '/admin/portfolio-categories', '/admin/orders', '/admin/quotes', '/admin/coupons',
  '/admin/messages', '/admin/product-reviews', '/admin/customers', '/admin/faq', '/admin/services',
  '/admin/settings', '/admin/login', '/admin/forgot-password', '/admin/reset-password',
];
const publicAdminRoutes = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];
type CatalogItem = { id: number; slug?: string; name?: string };

function staticRoutes(directory = path.join(process.cwd(), 'src/pages'), prefix = ''): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('[')) return [];
    if (entry.isDirectory()) return staticRoutes(path.join(directory, entry.name), `${prefix}/${entry.name}`);
    if (!entry.name.endsWith('.astro')) return [];
    return [entry.name === 'index.astro' ? prefix || '/' : `${prefix}/${entry.name.slice(0, -6)}`];
  });
}

async function catalog(endpoint: string): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetch(`${API_BASE}${endpoint}?page=${page}`);
    expect(response.ok, endpoint).toBe(true);
    const payload = await response.json();
    items.push(...(Array.isArray(payload) ? payload : payload.data));
    if (!payload.next_page_url) return items;
  }
  throw new Error(`Pagination did not terminate: ${endpoint}`);
}

async function login(kind: 'admin' | 'customer') {
  const url = kind === 'admin' ? `${API_BASE.replace('/v1', '/admin')}/login` : `${API_BASE}/customer/login`;
  const response = await fetch(url, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(kind === 'admin'
      ? { email: 'admin@midiametal.com', password: 'password' }
      : { email: 'asd@asd.com', password: '12345678' }),
  });
  expect(response.ok, `Seeded ${kind} login: ${response.status}`).toBe(true);
  const cookies = response.headers.getSetCookie().map(header => {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), domain: '127.0.0.1', path: '/', httpOnly: true };
  }).filter(cookie => cookie.name === `${kind}_token`);
  expect(cookies).toHaveLength(1);
  return cookies;
}

function captureIssues(page: Page) {
  const issues: string[] = [];
  const responses = new WeakMap<Request, number>();
  page.on('pageerror', error => issues.push(`Runtime: ${error.message}`));
  page.on('console', message => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = message.text();
    const url = message.location().url;
    // Anonymous session probes and the deliberate 404 page are expected responses.
    if (text.includes('status of 401') && /\/api\/(v1\/customer|admin)\/me$/.test(url)) return;
    if (text.includes('status of 404') && /\/404$/.test(url)) return;
    if (text.startsWith('⚠️ React Router Future Flag Warning:')) return;
    issues.push(`Console (${url}): ${text}`);
  });
  page.on('requestfailed', request => {
    // Edge can report ERR_ABORTED after receiving a successful empty CSRF response.
    // Require the observed 204; actual bootstrap/network failures must still fail the test.
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/sanctum/csrf-cookie'
      && responses.get(request) === 204 && request.failure()?.errorText === 'net::ERR_ABORTED') return;
    issues.push(`Request: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on('response', response => {
    responses.set(response.request(), response.status());
    if (response.status() >= 500 && new URL(response.url()).hostname === '127.0.0.1') {
      issues.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return issues;
}

test('all discovered public and admin routes render without runtime errors', async ({ browser }, testInfo) => {
  test.setTimeout(600000);
  const [products, categories, posts, services, portfolio] = await Promise.all([
    catalog('/products'), catalog('/product-categories'), catalog('/blog'), catalog('/services'), catalog('/portfolio'),
  ]);
  expect(products.length).toBeGreaterThan(0);
  const productResponse = await fetch(`${API_BASE}/products/${products[0].id}`);
  expect(productResponse.ok).toBe(true);
  const firstProduct = await productResponse.json();
  const routes = [...new Set([
    ...staticRoutes(), ...adminRoutes,
    ...products.map(item => `/shop/${item.slug || item.id}`),
    ...categories.map(item => `/shop/category/${item.slug}`),
    ...posts.map(item => `/blog/${item.slug}`),
    ...services.map(item => `/services/${item.slug}`),
    ...portfolio.map(item => `/portfolio/${item.slug}`),
  ])].sort();
  const adminCookies = await login('admin');
  const customerCookies = await login('customer');
  const results: { route: string; status: number; issues: string[] }[] = [];
  for (const route of routes) {
    await test.step(route, async () => {
      // A fresh context prevents listeners, init scripts and mock routes leaking between pages.
      const context: BrowserContext = await browser.newContext();
      await context.route('https://fonts.googleapis.com/**', intercepted => intercepted.fulfill({ contentType: 'text/css', body: '' }));
      if (adminRoutes.includes(route) && !publicAdminRoutes.includes(route)) await context.addCookies(adminCookies);
      if (route === '/account') await context.addCookies(customerCookies);
      const page = await context.newPage();
      const issues = captureIssues(page);
      try {
        if (['/cart', '/checkout'].includes(route)) {
          await page.addInitScript(product => {
            localStorage.setItem('midia_cart', JSON.stringify([{
              id: String(product.id), product_id: product.id, name: product.name, price: product.price,
              image: product.image || '', qty: 1, selected_variants: {},
              track_stock: product.track_stock, stock_quantity: product.stock_quantity,
              available_stock: product.track_stock ? product.stock_quantity : null,
            }]));
          }, firstProduct);
        }
        if (route === '/payment') {
          await seedCheckout(page);
          await mockCheckoutApi(page);
        }
        const target = route.endsWith('/reset-password') ? `${route}?token=e2e-display-token&email=reset%40example.test` : route;
        const response = await page.goto(`http://127.0.0.1:4323${target}`, { waitUntil: 'networkidle' });
        await hydrated(page);
        if (route === '/payment') {
          expect((await context.cookies()).some(cookie => cookie.name === 'XSRF-TOKEN' && cookie.value), 'CSRF cookie was issued').toBe(true);
        }
        const status = response?.status() || 0;
        results.push({ route, status, issues });
        expect.soft(status, route).toBe(route === '/404' ? 404 : 200);
        expect.soft(new URL(page.url()).pathname, `${route} unexpectedly redirected`).toBe(route);
        await expect.soft(page.locator('body')).not.toBeEmpty();
        await expect.soft(page.getByText('Coming Soon', { exact: true })).toHaveCount(0);
        expect.soft(issues, `${route}: ${issues.join('\n')}`).toEqual([]);
      } finally { await context.close(); }
    });
  }
  await testInfo.attach('route-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  const log = fs.readFileSync('output/e2e/astro.log', 'utf8');
  const serverErrors = log.split('\n').filter(line => /\[ERROR\]|\[500\]|Unhandled|uncaught/i.test(line));
  expect(serverErrors, 'Astro server errors').toEqual([]);
});
