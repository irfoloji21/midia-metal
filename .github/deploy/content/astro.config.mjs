import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import baseConfig from '../../../astro.config.mjs';

// Only the content workflow uses this config. Other builds keep their own URLs.
export default defineConfig({
  ...baseConfig,
  site: 'https://test.midiawork.com',
  image: {
    domains: ['test.midiawork.com', 'api-test.midiawork.com'],
    remotePatterns: [
      { protocol: 'https', hostname: 'test.midiawork.com' },
      { protocol: 'https', hostname: 'api-test.midiawork.com' },
    ],
  },
  integrations: baseConfig.integrations.map(integration =>
    integration.name === '@astrojs/sitemap'
      ? sitemap({
          customSitemaps: ['https://test.midiawork.com/sitemap-content.xml'],
          filter: page => !/\/(?:admin|login|register|forgot-password|reset-password|account|cart|checkout|payment|thank-you)(?:\/|$)/.test(new URL(page).pathname)
            && !page.includes('/sitemap-content.xml'),
        })
      : integration,
  ),
  vite: {
    ...baseConfig.vite,
    resolve: {
      ...baseConfig.vite.resolve,
      alias: {
        // SSR/prerender calls the dedicated API; the browser uses /api via Node.
        '@/lib/api-base': fileURLToPath(new URL('./api-base.ts', import.meta.url)),
        ...baseConfig.vite.resolve.alias,
      },
    },
  },
});
