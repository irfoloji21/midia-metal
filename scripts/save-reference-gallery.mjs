import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const records = JSON.parse(await fs.readFile('backend/storage/app/private/reference-gallery-results.json', 'utf8'));
const output = path.join(root, 'public/images/products/reference-catalogue');
const masters = path.join(root, 'backend/storage/app/private/reference-generated-masters');
await fs.mkdir(masters, { recursive: true });
let saved = 0;
for (const record of records) {
  if (!record.path || !/^product-\d+-angle-[ab]-v\d+\.webp$/.test(record.file)) throw new Error('Invalid gallery record');
  const target = path.join(output, record.file);
  try { await fs.access(target); continue; } catch {}
  await fs.copyFile(record.path, path.join(masters, record.file.replace(/\.webp$/, '.png')));
  await sharp(record.path).webp({ quality: 92 }).toFile(target);
  saved++;
}
console.log(JSON.stringify({ saved, total: records.length }));
