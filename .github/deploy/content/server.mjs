import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import compression from 'compression';
import { createBackendProxy } from './backend-proxy.mjs';

// Each release carries its own runtime configuration for Passenger restarts.
try {
  loadEnvFile(new URL('./.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
process.env.API_BACKEND_URL ||= 'https://api-test.midiawork.com';
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

const backend = createBackendProxy(process.env.API_BACKEND_URL);
const { handler: astroHandler } = await import('./dist/server/entry.mjs');
const compress = compression({ threshold: 1024, level: 6 });

const server = createServer((req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Midia-Release', process.env.MIDIA_RELEASE || 'content');
  if (backend.handle(req, res)) return;
  compress(req, res, () => astroHandler(req, res));
});

server.listen(process.env.PORT || 4321, process.env.HOST || '0.0.0.0', () => {
  console.log('Midia content frontend is running.');
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => { backend.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
