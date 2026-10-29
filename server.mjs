/**
 * server.mjs — Entry point for Astro standalone Node server.
 *
 * Wraps Astro's generated `dist/server/entry.mjs` with HTTP compression.
 * API calls go directly to https://staging-api.midiawork.com — no proxy needed.
 *
 * Usage:
 *   node server.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import { createServer } from 'node:http';

// Load .env from the app root so PUBLIC_API_URL etc. are available to SSR
// fetches when the process manager restarts the app (env vars from the SSH
// deploy session are NOT inherited by the restarted process).
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already defined (process manager vars take precedence)
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env is optional — no-op if missing
}

const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '0.0.0.0';

// This wrapper owns the listener. Disable the adapter's automatic listener
// before importing its entry, including when started without deployment env vars.
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler: astroHandler } = await import('./dist/server/entry.mjs');

const compress = compression({
  threshold: 1024,
  level: 6,
});

const server = createServer((req, res) => {
  compress(req, res, () => {
    astroHandler(req, res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
