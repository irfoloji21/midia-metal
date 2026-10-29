import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const originals = path.join(root, 'reports/dd7-product/longwell-originals');
const imagePath = '/images/products/longwell-dd7-5-ec';
const target = path.join(root, 'public', imagePath);
const apiTarget = path.join(root, 'backend/public', imagePath);
await fs.mkdir(target, { recursive: true });
await fs.mkdir(apiTarget, { recursive: true });
const manifest = [];
for (const [source, filename] of [
  ['front.jpg', 'longwell-dd7-5-ec-front.webp'],
  ['side.jpg', 'longwell-dd7-5-ec-motor-side.webp'],
  ['rear.jpg', 'longwell-dd7-5-ec-rear.webp'],
  ['dimensions-original.jpg', 'longwell-dd7-5-ec-dimensions.webp'],
  ['performance-original.jpg', 'longwell-dd7-5-ec-manufacturer-curve.webp'],
]) {
  const buffer = await sharp(path.join(originals, source)).rotate().webp({ quality: 90, effort: 6 }).toBuffer();
  await fs.writeFile(path.join(target, filename), buffer);
  await fs.writeFile(path.join(apiTarget, filename), buffer);
  const { width, height } = await sharp(buffer).metadata();
  manifest.push({ source, file: `${imagePath}/${filename}`, width, height, bytes: buffer.length });
}
// Chart exported by the PDF preparation script from the exact published data points.
const chart = path.join(root, 'reports/dd7-product/performance.svg');
const chartBuffer = await sharp(chart, { density: 180 }).resize({ width: 1500 }).webp({ quality: 95 }).toBuffer();
for (const dir of [target, apiTarget]) await fs.writeFile(path.join(dir, 'longwell-dd7-5-ec-performance.webp'), chartBuffer);

// The saved HTML is the canonical description; asset preparation must not replace editor content.
const html = await fs.readFile('backend/database/content/dd7-product-description.html', 'utf8');
await fs.writeFile('reports/dd7-product/web-assets.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ images: manifest, htmlCharacters: html.length }, null, 2));
