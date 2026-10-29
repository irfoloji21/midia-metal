import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const slug = 'centrifugal-fan-d-7-J3VG';
const detail = JSON.parse(await fs.readFile('backend/database/content/dd7-product-detail.json', 'utf8'));
const product = await fetch(`http://127.0.0.1:8000/api/v1/products/${slug}`).then(r => r.json());
assert.equal(product.product_code, detail.product_code);
assert.deepEqual(product.specifications, detail.specifications);
assert.equal(product.price, '£540.00');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
try {
  for (const width of [1440, 768, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`http://localhost:3000/shop/${slug}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.addStyleTag({ content: 'astro-dev-toolbar { display:none !important; }' });
    const declineCookies = page.getByRole('button', { name: 'Decline', exact: true });
    if (await declineCookies.isVisible()) await declineCookies.click();
    const story = page.locator('.product-story');
    await story.waitFor();
    assert.equal(await story.locator('.product-section').count(), 8);
    assert.equal(await story.locator('table').count(), 3);
    assert.equal(await story.locator('.product-reference-table tbody tr').count(), 7);
    assert.equal(await story.locator('.img-row--2 img').count(), 2);
    assert.equal(await story.locator('.img-row--3 img').count(), 3);
    // The selected model option duplicates the same specification and must be deduplicated.
    assert.equal(await story.locator('table').first().locator('tbody tr').count(), 26);
    assert.equal(await story.locator('.product-performance-table tbody tr').count(), 9);
    for (const img of await story.locator('img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(img => img.decode());
    }
    const result = await page.evaluate(() => ({
      title: document.querySelector('h1')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth,
      imageCount: document.querySelectorAll('.product-story img').length,
      images: [...document.querySelectorAll('.product-story img')].map(img => ({
        alt: img.alt, loaded: img.complete && img.naturalWidth > 0, fit: getComputedStyle(img).objectFit,
      })),
      specificationRows: document.querySelectorAll('.product-story table')[0].querySelectorAll('tbody tr').length,
      performanceRows: document.querySelectorAll('.product-performance-table tbody tr').length,
      tables: [...document.querySelectorAll('.product-table-wrap')].map(el => ({
        available: el.clientWidth, content: el.scrollWidth, right: el.getBoundingClientRect().right,
      })),
      productSchema: [...document.querySelectorAll('script[type="application/ld+json"]')]
        .flatMap(el => { const obj = JSON.parse(el.textContent); return obj['@graph'] || obj; })
        .find(obj => obj['@type'] === 'Product'),
    }));
    assert.equal(result.overflow, false, `Overflow at ${width}`);
    result.images.forEach(img => assert.ok(img.loaded && img.alt));
    for (const columns of [2, 3]) {
      const row = story.locator(`.img-row--${columns}`);
      const boxes = await row.locator('img').evaluateAll(images => images.map(img => {
        const { x, y, width, right } = img.getBoundingClientRect();
        return { x, y, width, right };
      }));
      assert.ok(boxes.every(box => box.width > 0 && box.right <= width), `Image row bounds at ${width}`);
      if (width > 540) {
        assert.ok(boxes.every(box => Math.abs(box.y - boxes[0].y) < 2), `${columns} images are side by side at ${width}`);
        assert.ok(boxes[1].x > boxes[0].x + boxes[0].width, 'Gutter separates images');
      } else {
        assert.ok(boxes[1].y > boxes[0].y, 'Images stack on mobile');
      }
      await row.screenshot({ path: `reports/dd7-product/row-${columns}-${width}.png` });
    }
    await story.locator('.product-reference-table').screenshot({ path: `reports/dd7-product/reference-table-${width}.png` });
    assert.equal(result.productSchema.brand.name, 'LONGWELL');
    assert.equal(result.productSchema.sku, 'LWDD7-5-EC');
    await page.getByRole('button', { name: 'View product image 2', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'View product image 2', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Enlarge product image' }).click();
    const lightbox = page.locator('.fixed.inset-0').filter({ has: page.locator('img[src$="motor-side.webp"]') });
    await lightbox.waitFor();
    await lightbox.screenshot({ path: `reports/dd7-product/gallery-${width}.png` });
    await page.getByRole('button', { name: 'Close product gallery' }).click();
    await lightbox.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'View product image 1', exact: true }).click();
    await page.getByRole('button', { name: 'Download product information (PDF)' }).waitFor();
    const pdf = await page.request.get(new URL('/api/v1/products/59/pdf', page.url()).href);
    assert.equal(pdf.status(), 200);
    assert.match(pdf.headers()['content-type'], /pdf/);
    assert.ok((await pdf.body()).byteLength > 50000);
    if (width === 1440) {
      await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
      const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('midia_cart') || '[]'));
      assert.ok(cart.some(item => item.product_id === 59 && item.name.includes('LONGWELL') && item.selected_variants.Model.value === 'LWDD7-5-EC'));
      result.cart = cart.map(({ id, name, price, qty }) => ({ id, name, price, qty }));
      await page.getByText('Added to basket!', { exact: true }).first().waitFor({ state: 'hidden', timeout: 10000 });
    }
    if (await declineCookies.isVisible()) await declineCookies.click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `reports/dd7-product/page-${width}.png`, fullPage: true });
    await page.screenshot({ path: `reports/dd7-product/top-${width}.png` });
    for (const [index, label] of [[0, 'introduction'], [3, 'dimensions'], [4, 'performance']]) {
      await story.locator('.product-section').nth(index).screenshot({ path: `reports/dd7-product/${label}-${width}.png` });
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}`);
    checks.push({ width, ...result, errors });
    await page.close();
  }
  const portfolio = await fetch('http://127.0.0.1:8000/api/v1/portfolio').then(r => r.json());
  const services = await fetch('http://127.0.0.1:8000/api/v1/services').then(r => r.json());
  assert.equal(portfolio.length, 3);
  assert.equal(services.length, 4);
  await fs.writeFile('reports/dd7-product/verification.json', JSON.stringify({ checks, portfolioActive: 3, servicesActive: 4 }, null, 2));
  console.log(JSON.stringify({ viewports: checks.length, specificationRows: 26, performanceRows: 9, imageGallery: product.gallery.length + 1, errors: [], pdf: '200 OK' }));
} finally {
  await browser.close();
}
