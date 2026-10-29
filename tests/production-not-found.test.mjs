import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
let server;
let origin;
let upstream;
const upstreamRequests = new Map();

before(async () => {
  upstream = createServer((req, res) => {
    const path = req.url;
    const attempts = (upstreamRequests.get(path) || 0) + 1;
    upstreamRequests.set(path, attempts);
    const missing = path.includes('qa-missing-product');
    const failure = path.includes('qa-unavailable')
      || (path.includes('qa-fails-once') && attempts === 1 && !path.endsWith('/related'))
      || (path.includes('qa-related-failure') && path.endsWith('/related'));
    res.writeHead(missing ? 404 : failure ? 500 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(missing || failure ? {} : path.endsWith('/related') ? [] : { id: 51, name: 'Fixture product', price: 12.5 }));
  });
  await new Promise(resolveReady => upstream.listen(0, '127.0.0.1', resolveReady));
  const output = join(root, 'output', 'e2e');
  await mkdir(output, { recursive: true });
  const fixture = await mkdtemp(join(output, 'not-found-production-'));
  await mkdir(join(fixture, 'src', 'pages', 'shop'), { recursive: true });
  await mkdir(join(fixture, 'src', 'layouts'), { recursive: true });
  await mkdir(join(fixture, 'src', 'lib'), { recursive: true });
  await mkdir(join(fixture, 'src', 'islands'), { recursive: true });
  await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
  await writeFile(join(fixture, 'astro.config.mjs'), `
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  output: 'server', site: 'https://test.example', adapter: node({ mode: 'standalone' }), integrations: [react()],
  vite: { ssr: { noExternal: ['@astrojs/react'] }, resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } },
});
`);
  // Compile the real error page; the small layout avoids unrelated API/backend dependencies.
  await writeFile(join(fixture, 'src', 'pages', '404.astro'), await readFile(join(root, 'src', 'pages', '404.astro')));
  await writeFile(join(fixture, 'src', 'layouts', 'BaseLayout.astro'), `---
const { title, noindex } = Astro.props;
---
<html lang="en"><head><title>{title}</title>{noindex && <meta name="robots" content="noindex, nofollow" />}</head><body><slot /></body></html>
`);
  await writeFile(join(fixture, 'src', 'pages', 'shop', '[slug].astro'), await readFile(join(root, 'src', 'pages', 'shop', '[slug].astro')));
  for (const name of ['api-base.ts', 'public-api.ts', 'pricing.ts', 'variants.ts', 'seo.ts']) {
    await writeFile(join(fixture, 'src', 'lib', name), await readFile(join(root, 'src', 'lib', name)));
  }
  await writeFile(join(fixture, 'src', 'islands', 'ProductDetailIsland.tsx'), `import React from 'react'; export default function ProductDetailIsland({initialProduct}) { return <h1>{initialProduct.name}</h1>; }`);
  await writeFile(join(fixture, 'server.mjs'), `
import { createServer } from 'node:http';
const { handler } = await import('./dist/server/entry.mjs');
const server = createServer(handler);
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', message => { if (message === 'stop') server.close(() => process.exit(0)); });
`);
  execFileSync(process.execPath, [join(root, 'node_modules', 'astro', 'astro.js'), 'build', '--root', fixture], {
    cwd: root, windowsHide: true, stdio: 'pipe', timeout: 60000,
  });
  server = fork(join(fixture, 'server.mjs'), [], {
    cwd: fixture,
    env: { ...process.env, ASTRO_NODE_AUTOSTART: 'disabled', PUBLIC_API_URL: `http://127.0.0.1:${upstream.address().port}/api` },
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error('Production fixture did not start.')), 15000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Production fixture exited: ${code}`)));
    server.once('message', ({ port }) => {
      clearTimeout(timer);
      origin = `http://127.0.0.1:${port}`;
      resolveReady();
    });
  });
});

after(async () => {
  if (server && server.exitCode === null) await new Promise(resolveStopped => {
    const timer = setTimeout(() => server.kill(), 3000);
    server.once('exit', () => { clearTimeout(timer); resolveStopped(); });
    server.send('stop');
  });
  if (upstream?.listening) await new Promise(resolveStopped => { upstream.closeAllConnections(); upstream.close(resolveStopped); });
});

for (const path of ['/404', '/404/', '/qa-unknown-route', '/shop/qa-missing-product']) {
  test(`production ${path} returns a useful 404 page`, async () => {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.match(html, /This page is off the radar/);
    assert.match(html, /Back to home/);
    assert.match(html, /href="\/shop"/);
    assert.match(html, /noindex, nofollow/);
  });
}

test('production product page survives one temporary upstream failure', async () => {
  const response = await fetch(`${origin}/shop/qa-fails-once`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Fixture product/);
  assert.equal(upstreamRequests.get('/api/v1/products/qa-fails-once'), 2);
});

test('production product page preserves the product when related products fail', async () => {
  const response = await fetch(`${origin}/shop/qa-related-failure`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Fixture product/);
});

test('persistent upstream failure returns a useful non-cacheable 503, not a missing-product redirect', async () => {
  const response = await fetch(`${origin}/shop/qa-unavailable`, { redirect: 'manual' });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '30');
  const html = await response.text();
  assert.match(html, /This product is temporarily unavailable/);
  assert.match(html, /Try again/);
  assert.match(html, /noindex, nofollow/);
  assert.equal(upstreamRequests.get('/api/v1/products/qa-unavailable'), 3);
});
