import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Canonical site URL — sets import.meta.env.SITE globally
  site: 'https://midiammetal.com',

  server: {
    host: true,
    port: 4321,
  },

  // SSR mode: pages are server-rendered by default (fresh API data on every request).
  // Static pages opt in with `export const prerender = true`.
  output: 'server',

  // Node.js adapter for Hostinger Cloud deployment
  adapter: node({ mode: 'standalone' }),

  // Prefetch links on hover for SPA-like speed
  prefetch: {
    defaultStrategy: 'hover',
    prefetchAll: false,
  },

  // Image optimization: allow remote images from the backend
  image: {
    domains: ['127.0.0.1', 'localhost', 'midiammetal.com', 'staging-api.midiawork.com'],
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '8000' },
      { protocol: 'https', hostname: 'midiammetal.com' },
      { protocol: 'https', hostname: 'staging-api.midiawork.com' },
    ],
  },

  integrations: [
    react(),
    // Public stylesheet: scoped to public pages/islands (excludes admin UI components)
    tailwind({
      configFile: './tailwind.config.ts',
      applyBaseStyles: false, // We use our own base styles in index.css
    }),
    // Admin stylesheet: scoped to admin SPA files only (sidebar, data tables, etc.)
    tailwind({
      configFile: './tailwind.admin.config.ts',
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) =>
        // Exclude admin, auth, and utility pages from sitemap
        !page.includes('/admin/') &&
        !page.includes('/login') &&
        !page.includes('/register') &&
        !page.includes('/forgot-password') &&
        !page.includes('/reset-password') &&
        !page.includes('/account') &&
        !page.includes('/checkout') &&
        !page.includes('/payment') &&
        !page.includes('/thank-you'),
    }),
  ],

  vite: {
    optimizeDeps: {
      include: ['@radix-ui/react-popover', '@radix-ui/react-scroll-area'],
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/sanctum': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/storage': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  },

  srcDir: './src',
});
