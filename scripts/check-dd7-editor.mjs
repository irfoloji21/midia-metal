import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

let product = await fetch('http://127.0.0.1:8000/api/v1/products/centrifugal-fan-d-7-J3VG').then(r => r.json());
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let writes = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Exercise the actual admin form without writing to the live database.
  await page.route('**/api/admin/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/admin/me') return route.fulfill({ json: { id: 0, name: 'DD7 content check' } });
    if (pathname === '/api/admin/products') return route.fulfill({ json: { data: [product] } });
    if (pathname === '/api/admin/product-category-list') return route.fulfill({ json: [product.category] });
    if (pathname === '/api/admin/products/59' && route.request().method() === 'PUT') {
      product = route.request().postDataJSON();
      writes++;
      return route.fulfill({ json: product });
    }
    return route.fulfill({ status: 404, json: { message: 'Unstubbed test request' } });
  });
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.goto('http://localhost:3000/admin/products', { waitUntil: 'networkidle' });
  const edit = () => page.locator('tbody tr').filter({ hasText: 'LONGWELL DD7-5 EC Centrifugal Fan' }).getByRole('button').first().click();
  await edit();
  const editor = page.getByRole('textbox', { name: 'Description', exact: true });
  await editor.scrollIntoViewIfNeeded();
  assert.equal(await editor.locator('.product-section').count(), 7);
  assert.equal(await editor.locator('.product-spec-slot').count(), 1);
  assert.equal(await editor.locator('table tbody tr').count(), 9);
  assert.equal(await editor.locator('img').count(), 5);
  await editor.locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Editor persistence check.');
  await page.getByRole('button', { name: 'Save Product', exact: true }).click();
  await edit();
  await editor.scrollIntoViewIfNeeded();
  assert.ok((await editor.innerHTML()).includes('Editor persistence check.'));
  assert.equal(await editor.locator('.product-spec-slot').count(), 1);
  assert.equal(product.variants[0].value, 'LWDD7-5-EC');
  assert.deepEqual(product.specifications['Motor power'], '200 W');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display:none!important; }' });
  await editor.screenshot({ path: 'reports/dd7-product/admin-description.png' });
  assert.equal(writes, 1);
  assert.deepEqual(errors, []);
  await fs.writeFile('reports/dd7-product/editor-verification.json', JSON.stringify({
    saveReopenPassed: true, imageCount: 5, performanceRows: 9, specificationSlotPreserved: true,
    modelOptionPreserved: true, liveAdminWrites: 0,
    method: 'Real admin UI with isolated API fixtures. Backend persistence separately tested with PHPUnit.',
    errors,
  }, null, 2));
  console.log('Admin text editing, save/reopen, images, tables and model option passed; no live admin writes.');
} finally { await browser.close(); }
