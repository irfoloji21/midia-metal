import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const services = JSON.parse(await fs.readFile('backend/database/content/service-editorial-layout.json', 'utf8'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [];
try {
  for (const width of [1440, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const service of services) {
      const response = await page.goto(`http://localhost:3000/services/${service.slug}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      const rows = page.locator('.service-rich-content .service-section');
      assert.equal(await rows.count(), 2);
      for (const row of await rows.all()) {
        await row.scrollIntoViewIfNeeded();
        await row.locator('img').evaluate(img => img.decode());
      }
      await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
      await page.evaluate(() => scrollTo(0, 0));
      const result = await page.evaluate(() => ({
        title: document.querySelector('h1')?.textContent,
        overflow: document.documentElement.scrollWidth > innerWidth,
        activeNav: document.querySelector('nav[aria-label="Our services"] [aria-current="page"]')?.getAttribute('href'),
        rows: [...document.querySelectorAll('.service-section')].map(row => {
          const image = row.querySelector('img');
          const copy = row.querySelector('.service-copy').getBoundingClientRect();
          const media = row.querySelector('.service-media').getBoundingClientRect();
          return { loaded: image.complete && image.naturalWidth > 0, alt: image.alt,
            fit: getComputedStyle(image).objectFit, textX: copy.x, imageX: media.x, textY: copy.y, imageY: media.y,
            background: getComputedStyle(row).backgroundColor };
        }),
      }));
      assert.equal(result.overflow, false, `Overflow at ${service.slug} ${width}`);
      assert.equal(result.activeNav, `/services/${service.slug}`);
      result.rows.forEach(row => { assert.ok(row.loaded && row.alt); assert.equal(row.fit, 'contain'); });
      if (width >= 768) {
        assert.ok(result.rows[0].textX < result.rows[0].imageX);
        assert.ok(result.rows[1].imageX < result.rows[1].textX);
      } else {
        result.rows.forEach(row => assert.ok(row.textY < row.imageY));
      }
      assert.notEqual(result.rows[0].background, result.rows[1].background);
      await page.screenshot({ path: `reports/service-layout/${service.slug}-${width}.png`, fullPage: true });
      checks.push({ slug: service.slug, width, ...result });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const portfolio = await fetch('http://127.0.0.1:8000/api/v1/portfolio').then(r => r.json());
  const records = Array.isArray(portfolio) ? portfolio : portfolio.data;
  assert.equal(records.length, 3);
  await fs.writeFile('reports/service-layout/verification.json', JSON.stringify({ checks, portfolioActive: records.length, browserErrors: [] }, null, 2));
  console.log(JSON.stringify({ pagesChecked: checks.length, portfolioActive: records.length, browserErrors: [] }));
} finally { await browser.close(); }
