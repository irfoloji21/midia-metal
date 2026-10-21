import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const catalogue = JSON.parse(await fs.readFile('backend/database/content/reference-shop-catalogue.json', 'utf8'));
const assets = new Set();
let checkedProducts = 0;
let checkedImages = 0;

for (const expected of catalogue.products) {
  const [apiResponse, pageResponse] = await Promise.all([
    fetch(`http://127.0.0.1:8000/api/v1/products/${expected.slug}`),
    fetch(`http://localhost:3000/shop/${expected.slug}`),
  ]);
  assert.equal(apiResponse.status, 200, expected.slug);
  assert.equal(pageResponse.status, 200, expected.slug);
  assert.ok(pageResponse.url.endsWith(`/shop/${expected.slug}`), 'Unexpected redirect');
  const actual = await apiResponse.json();
  assert.deepEqual(actual.gallery, expected.gallery, `${expected.slug}: gallery`);
  assert.deepEqual(actual.variants, expected.variants, `${expected.slug}: variants`);
  assert.deepEqual(Object.entries(actual.specifications), Object.entries(expected.specifications), `${expected.slug}: specifications`);
  assert.equal(Number(actual.price), Number(expected.price), `${expected.slug}: price`);
  assert.equal(new Set([actual.image, ...actual.gallery]).size, 3, `${expected.slug}: three distinct views`);
  for (const image of [actual.image, ...actual.gallery]) assets.add(image);

  // This check inspects SSR text, not CSS; the installed JSDOM predates modern CSS syntax.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => {
    if (error.type !== 'css parsing') throw error;
  });
  const dom = new JSDOM(await pageResponse.text(), { virtualConsole });
  dom.window.document.querySelectorAll('script,style').forEach(node => node.remove());
  const text = dom.window.document.body.textContent;
  assert.ok(!/\b(?:abc|qq|www|drainer postion)\b/i.test(text), `${expected.slug}: placeholder copy`);
  dom.window.close();
  checkedProducts++;
}

for (const image of assets) {
  const response = await fetch(`http://localhost:3000${image}`, { method: 'HEAD' });
  assert.equal(response.status, 200, image);
  assert.ok(response.headers.get('content-type')?.startsWith('image/'), image);
  checkedImages++;
}

console.log(JSON.stringify({ checkedProducts, galleryEntries: checkedProducts * 3, checkedImages, status: 'passed' }));
