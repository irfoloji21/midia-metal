import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

await fs.mkdir('reports/product-pdf', { recursive: true });
await fs.mkdir('output/pdf', { recursive: true });
const catalogue = await fetch('http://127.0.0.1:8000/api/v1/products?per_page=500').then(r => r.json());
assert.ok(catalogue.data.every(p => p.pdf_download_enabled === true));
let product = catalogue.data.find(p => p.id === 59);
assert.ok(product && !product.description.includes('longwell-lwdd7-5-ec-datasheet.pdf'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
let writes = 0;
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:3000/shop/${product.slug}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: 'astro-dev-toolbar { display:none!important; }' });
    const decline = page.getByRole('button', { name: 'Decline', exact: true });
    if (await decline.isVisible()) await decline.click();
    const button = page.getByRole('button', { name: 'Download product information (PDF)', exact: true });
    await button.scrollIntoViewIfNeeded();
    await button.locator('..').screenshot({ path: `reports/product-pdf/download-${width}.png` });
    const downloadPromise = page.waitForEvent('download');
    const requestPromise = page.waitForRequest(request => request.url().endsWith('/v1/products/59/pdf'));
    await button.click();
    assert.equal((await requestPromise).headers()['x-site-origin'], 'http://localhost:3000');
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'lwdd7-5-ec-product-information.pdf');
    await download.saveAs('output/pdf/dd7-current-product-information.pdf');
    assert.equal(await download.failure(), null);
    await button.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }

  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  admin.on('pageerror', error => errors.push(error.message));
  await admin.route('**/api/admin/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/admin/me') return route.fulfill({ json: { id: 0, name: 'PDF check' } });
    if (pathname === '/api/admin/products') return route.fulfill({ json: { data: [product] } });
    if (pathname === '/api/admin/product-category-list') return route.fulfill({ json: [product.category] });
    if (pathname === '/api/admin/products/59' && route.request().method() === 'PUT') {
      product = { ...product, ...route.request().postDataJSON() };
      writes++;
      return route.fulfill({ json: product });
    }
    return route.fulfill({ status: 404, json: { message: 'Unstubbed test route' } });
  });
  await admin.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await admin.goto('http://localhost:3000/admin/products', { waitUntil: 'networkidle' });
  const edit = () => admin.locator('tbody tr').filter({ hasText: 'LONGWELL DD7-5 EC Centrifugal Fan' }).getByRole('button').first().click();
  const toggle = admin.getByRole('checkbox', { name: /Show PDF download below the description/ });
  await edit();
  assert.equal(await toggle.isChecked(), true);
  await toggle.uncheck();
  await admin.getByRole('button', { name: 'Save Product', exact: true }).click();
  await edit();
  assert.equal(await toggle.isChecked(), false);
  await toggle.check();
  await admin.getByRole('button', { name: 'Save Product', exact: true }).click();
  await edit();
  assert.equal(await toggle.isChecked(), true);
  await toggle.scrollIntoViewIfNeeded();
  await toggle.locator('..').screenshot({ path: 'reports/product-pdf/admin-setting.png' });
  await admin.reload({ waitUntil: 'networkidle' });
  await admin.getByRole('button', { name: 'Add Product', exact: true }).click();
  assert.equal(await toggle.isChecked(), true);
  assert.equal(writes, 2);
  assert.deepEqual(errors, []);
  await fs.writeFile('reports/product-pdf/browser-verification.json', JSON.stringify({ publicProductsEnabled: catalogue.data.length, downloadViewports: [1440, 390], adminSaveReopen: true, newProductDefault: true, isolatedAdminWrites: writes, liveAdminWrites: 0, errors }, null, 2));
  console.log('Actual desktop/mobile PDF downloads and admin default, disable, enable and reopen passed.');
} finally { await browser.close(); }
