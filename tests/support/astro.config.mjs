import { mergeConfig } from 'astro/config';
import base from '../../astro.config.mjs';

export default mergeConfig(base, {
  vite: { server: { proxy: Object.fromEntries(
    ['/api', '/sanctum', '/storage'].map(route => [route, { target: 'http://127.0.0.1:8013', changeOrigin: true }]),
  ) } },
  integrations: [{
    name: 'e2e-vite-cache',
    hooks: { 'astro:config:setup': ({ updateConfig }) => updateConfig({ vite: { cacheDir: './node_modules/.vite/e2e' } }) },
  }],
});
