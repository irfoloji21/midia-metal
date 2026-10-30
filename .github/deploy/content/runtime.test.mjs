import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, request } from 'node:http';
import { createBackendProxy } from './backend-proxy.mjs';

let upstream;
let frontend;
let proxy;
let port;
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]);

before(async () => {
  upstream = createServer(async (req, res) => {
    if (req.url === '/sanctum/csrf-cookie') {
      res.writeHead(204, { 'Set-Cookie': 'XSRF-TOKEN=fixture; Domain=.midiawork.com; Path=/; Secure' });
      res.end();
      return;
    }
    if (req.url === '/storage/manual.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(pdf);
      return;
    }
    if (req.url === '/api/submit') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        origin: req.headers.origin,
        csrf: req.headers['x-xsrf-token'],
        cookie: req.headers.cookie,
        body: Buffer.concat(chunks).toString(),
      }));
      return;
    }
    res.writeHead(req.url === '/api/unauthorized' ? 401 : 200, { 'Content-Type': 'application/json' });
    if (req.url === '/api/empty') {
      res.end();
      return;
    }
    res.write('{"status":');
    setImmediate(() => res.end('"ok"}'));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  proxy = createBackendProxy(`http://127.0.0.1:${upstream.address().port}`);
  frontend = createServer((req, res) => {
    if (!proxy.handle(req, res)) res.end('frontend');
  });
  await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve));
  port = frontend.address().port;
});

after(async () => {
  proxy?.close();
  await Promise.all([frontend, upstream].filter(Boolean).map(server => new Promise(resolve => server.close(resolve))));
});

function send(path, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, ...options }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('JSON responses arrive complete with an explicit length for LiteSpeed', async () => {
  const response = await send('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  assert.equal(Number(response.headers['content-length']), response.body.length);
  assert.equal(response.headers['cache-control'], 'private, no-store, no-transform');
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow');
});

test('CSRF cookies stay on the frontend hostname', async () => {
  const response = await send('/sanctum/csrf-cookie');
  assert.equal(response.status, 204);
  assert.equal(response.body.length, 0);
  assert.match(response.headers['set-cookie'][0], /^XSRF-TOKEN=fixture;/);
  assert.doesNotMatch(response.headers['set-cookie'][0], /domain=/i);
});

test('authenticated writes preserve Origin, CSRF token, cookies and request body', async () => {
  const response = await send('/api/submit', {
    method: 'POST',
    headers: { Origin: 'https://test.midiawork.com', 'X-XSRF-TOKEN': 'fixture', Cookie: 'session=fixture' },
  }, '{"name":"fixture"}');
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(response.body), {
    origin: 'https://test.midiawork.com', csrf: 'fixture', cookie: 'session=fixture', body: '{"name":"fixture"}',
  });
});

test('PDF downloads preserve their binary bytes', async () => {
  const response = await send('/storage/manual.pdf');
  assert.equal(response.headers['content-type'], 'application/pdf');
  assert.deepEqual(response.body, pdf);
});

test('empty JSON fails clearly and authentication errors preserve their status', async () => {
  assert.equal((await send('/api/empty')).status, 502);
  assert.equal((await send('/api/unauthorized')).status, 401);
});

test('ordinary page routes are left to Astro', async () => {
  assert.equal((await send('/api-example')).body.toString(), 'frontend');
  assert.equal((await send('/shop')).body.toString(), 'frontend');
});

test('proxy rejects other websites and non-HTTPS remote targets', () => {
  for (const origin of ['https://staging-api.midiawork.com', 'https://example.com', 'http://api-test.midiawork.com', 'https://api-test.midiawork.com/other']) {
    assert.throws(() => createBackendProxy(origin), /dedicated HTTPS API origin/);
  }
});
