import { test, expect, API_BASE, hydrated } from './support/fixtures';

test('saved Word descriptions retain formatting and keep wide data tables inside a mobile scroller', async ({ page, request }) => {
  const admin = API_BASE.replace(/\/v1$/, '/admin');
  const login = await request.post(`${admin}/login`, { data: { email: 'admin@midiametal.com', password: 'password' } });
  expect(login.ok()).toBeTruthy();
  const description = '<div style="display:flex;justify-content:center"><div class="word-paste"><h1>Fan overview</h1><div class="word-table"><table style="width:100%"><tbody><tr><td style="width:55%"><p>A <strong>compact blower</strong> with adjustable speed. The description must stay readable on a phone.</p></td><td style="width:5%">&nbsp;</td><td style="width:40%"><img src="/images/ventilation-fan-circular.png" alt="Fan photo"></td></tr></tbody></table></div><div class="word-table word-table--bordered"><table><tbody><tr><td>Airflow</td><td>Static pressure</td><td>Total pressure</td><td>Speed</td><td>Noise</td></tr><tr><td>1400</td><td>0</td><td>65</td><td>1200</td><td>60.3</td></tr></tbody></table></div></div></div>';
  const saved = await request.post(`${admin}/products`, { data: {
    name: 'Word layout regression', price: '£10.00', active: true, image: '/images/ventilation-fan-circular.png',
    variants: [{ option: 'Model', value: 'Test', price: '£10.00' }], description,
  } });
  expect(saved.status()).toBe(201);
  const product = await saved.json();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/shop/${product.slug}`);
  await hydrated(page);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Fan overview', level: 2 })).toBeVisible();
  await expect(page.locator('.word-paste strong')).toHaveText('compact blower');
  await expect(page.locator('.word-paste table')).toHaveCount(2);
  const mobile = await page.locator('.word-paste').evaluate(element => {
    const cells = element.querySelectorAll('.word-table--layout td');
    const text = cells[0].getBoundingClientRect(), image = cells[2].getBoundingClientRect();
    const data = element.querySelector('.word-table--bordered')!;
    return { left: text.x, width: text.width, imageBelowText: image.y >= text.bottom, pageWidth: document.documentElement.scrollWidth,
      tableScrolls: data.scrollWidth > data.clientWidth, tableViewport: data.clientWidth };
  });
  expect(mobile.left).toBeGreaterThanOrEqual(0);
  expect(mobile.width).toBeGreaterThan(300);
  expect(mobile.width).toBeLessThanOrEqual(390);
  expect(mobile.imageBelowText).toBe(true);
  expect(mobile.pageWidth).toBeLessThanOrEqual(390);
  expect(mobile.tableViewport).toBeLessThanOrEqual(390);
  expect(mobile.tableScrolls).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await page.locator('.word-table--layout td').evaluateAll(cells => {
    const text = cells[0].getBoundingClientRect(), image = cells[2].getBoundingClientRect();
    return { imageRightOfText: image.x >= text.right, sameRow: Math.abs(image.y - text.y) < 2 };
  });
  expect(desktop.imageRightOfText).toBe(true);
  expect(desktop.sameRow).toBe(true);
});
