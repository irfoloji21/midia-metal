import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Exercise the real admin UI with isolated API fixtures; no live admin writes.
const services = await fetch('http://127.0.0.1:8000/api/v1/services').then(r => r.json());
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let writes = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/admin/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/admin/me') {
      return route.fulfill({ json: { id: 0, name: 'Service layout preview' } });
    }
    if (pathname === '/api/admin/services') {
      return route.fulfill({ json: { data: services } });
    }
    if (pathname === '/api/admin/upload') {
      return route.fulfill({ json: { url: services[0].image } });
    }
    if (pathname.startsWith('/api/admin/services/') && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON();
      const index = services.findIndex(service => service.id === data.id);
      assert.ok(index >= 0);
      services[index] = data;
      writes++;
      return route.fulfill({ json: data });
    }
    return route.fulfill({ status: 404, json: { message: 'Unstubbed test request' } });
  });
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.goto('http://localhost:3000/admin/services', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Edit Custom Fabrication', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Content', exact: true });
  await editor.scrollIntoViewIfNeeded();
  assert.equal(await editor.locator('.service-section').count(), 2);
  await editor.locator('img').first().evaluate(img => img.decode());
  await editor.locator('img').first().click();
  await page.addStyleTag({ content: 'astro-dev-toolbar { display:none !important; }' });
  await editor.locator('..').screenshot({ path: 'reports/service-layout/admin-editor.png' });
  await editor.locator('h2').first().click();
  await page.getByRole('button', { name: 'Swap sides', exact: true }).click();
  assert.ok(await editor.locator('.service-section').first().evaluate(row => row.classList.contains('service-section--image-left')));
  await editor.locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Editor persistence check.');
  await page.getByRole('button', { name: 'Save Service', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Custom Fabrication', exact: true }).click();
  await editor.scrollIntoViewIfNeeded();
  assert.ok((await editor.innerHTML()).includes('Editor persistence check.'));
  assert.ok(await editor.locator('.service-section').first().evaluate(row => row.classList.contains('service-section--image-left')));
  await editor.locator('img').first().click();
  assert.ok(await page.getByRole('button', { name: 'Replace photo', exact: true }).isEnabled());
  assert.ok(await page.getByRole('button', { name: 'Image description', exact: true }).isEnabled());
  await page.getByRole('button', { name: 'Add image + text', exact: true }).click();
  assert.equal(await editor.locator('.service-section').count(), 3);
  const addedSection = editor.locator('.service-section').filter({ has: page.getByRole('heading', { name: 'Section heading', exact: true }) });
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload Image', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles('public' + services[0].image);
  await addedSection.locator('.service-media img').waitFor();
  assert.equal(await editor.locator('.service-media img').count(), 3);
  assert.deepEqual(errors, []);
  assert.equal(writes, 1);
  await fs.writeFile('reports/service-layout/editor-verification.json', JSON.stringify({
    api: 'Isolated browser fixtures; backend persistence and sanitization tested separately with PHPUnit.',
    liveAdminWrites: 0, saveReopenPassed: true, imageControlsPassed: true, sectionUploadPassed: true, errors,
  }, null, 2));
  console.log('Editor side swap, text editing, save/reopen and photo controls passed. No live admin writes.');
} finally { await browser.close(); }
