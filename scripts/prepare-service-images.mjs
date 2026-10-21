import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const prepared = path.join(root, 'portfolio-preparation/2026-10-19/installed-kitchens-v4-clean');
const services = JSON.parse(await fs.readFile('backend/database/content/service-editorial-layout.json', 'utf8'));
const inventory = JSON.parse(await fs.readFile(path.join(prepared, 'portfolio-content.json'), 'utf8'));
const photos = inventory.flatMap(project => project.photos);
const manifest = [];

for (const service of services) {
  for (const section of service.sections) {
    const file = `${section.image}.jpg`;
    const source = photos.find(photo => photo.photo === `photos/${file}`);
    if (!source) throw new Error(`Missing source record for ${file}`);
    const sourcePath = path.join(prepared, 'photos', file);
    const url = `/images/services/installed-kitchens/${section.image}.webp`;
    const buffer = await sharp(sourcePath)
      .resize({ width: 1680, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 87, effort: 6 })
      .toBuffer();
    for (const base of ['public', 'backend/public']) {
      const destination = path.join(root, base, url);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, buffer);
    }
    const { width, height } = await sharp(buffer).metadata();
    manifest.push({
      service: service.slug, image: url, width, height, bytes: buffer.length,
      alt: section.alt, originalPreparedPhoto: sourcePath,
      sourceVideo: source.source_url, timestamp: source.timestamp,
      treatment: 'Previously prepared photograph; only resized and converted to WebP for this service page.',
    });
  }
}
await fs.mkdir('reports/service-layout', { recursive: true });
await fs.writeFile('reports/service-layout/images.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ images: manifest.length, totalBytes: manifest.reduce((sum, row) => sum + row.bytes, 0) }));
