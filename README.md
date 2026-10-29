# Midia Metal

Commercial kitchen equipment, ventilation systems, and stainless steel products — e-commerce platform with admin panel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 6 + React Islands + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Nanostores (cross-island shared state) |
| Backend | Laravel 12 (PHP 8.2+) |
| Database | MySQL 8 |
| Payments | Stripe (Elements + PaymentIntents) |
| Admin | React SPA (React Router) mounted via Astro catch-all route |

## Prerequisites

- **Node.js** >= 18 (tested with v22)
- **npm** >= 9
- **PHP** >= 8.2 with extensions: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `gd` (including WebP support for product PDFs)
- **Composer** >= 2
- **MySQL** >= 8.0

## Project Structure

```
midia-metal/
├── src/
│   ├── pages/              # 29 Astro file-based routes (→ 86 generated pages)
│   ├── islands/            # 28 React island components
│   ├── layouts/            # BaseLayout.astro (header, footer, SEO, cookie banner)
│   ├── stores/             # Nanostores (cart, auth, wishlist)
│   ├── components/         # Shared React components + shadcn/ui (48 files)
│   ├── lib/                # Utilities (api, pricing, variants, stock, seo, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React Contexts (kept for reference, unused by islands)
│   └── pages-react/admin/  # 19 admin pages (React Router SPA)
├── backend/                # Laravel 12 API
├── public/                 # Static assets (images, fonts, logo)
├── astro.config.mjs        # Astro configuration
├── tailwind.config.ts      # Tailwind configuration
└── package.json
```

## Getting Started (Local Development)

### 1. Clone and install frontend dependencies

```bash
git clone <REPO_URL>
cd midia-metal
npm install
```

### 2. Set up the database

```bash
# Start MySQL (macOS with Homebrew)
brew services start mysql

# Create database and user
mysql -u root -e "
  CREATE DATABASE IF NOT EXISTS midia_metal_local;
  CREATE USER IF NOT EXISTS 'midia_metal_local'@'localhost' IDENTIFIED BY 'your_password';
  GRANT ALL PRIVILEGES ON midia_metal_local.* TO 'midia_metal_local'@'localhost';
  FLUSH PRIVILEGES;
"
```

### 3. Set up the backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed     # if seeders exist
php artisan storage:link
```

**Backend `.env`** — key variables:

```env
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=midia_metal_local
DB_USERNAME=midia_metal_local
DB_PASSWORD=your_password
SESSION_DRIVER=database
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
SANCTUM_STATEFUL_DOMAINS=localhost:3000,127.0.0.1:3000,localhost:4323,127.0.0.1:4323
SESSION_DOMAIN=localhost
```

### 4. Set up the frontend environment

Create `.env` in the project root:

```env
PUBLIC_STRIPE_KEY=pk_test_your_stripe_publishable_key
```

### 5. Start both servers

```bash
# Terminal 1: Backend
cd backend && php artisan serve
# → http://127.0.0.1:8000

# Terminal 2: Frontend
npm run dev -- --host localhost --port 3000
# → http://localhost:3000
```

The Astro dev server proxies `/api`, `/sanctum`, and `/storage` to the Laravel backend.

On Windows, start the backend with `powershell -NoProfile -ExecutionPolicy Bypass -File backend/start-local.ps1` from the project root. The execution policy applies only to this process. This enables the required PHP extensions and uses Laravel's development router so uploaded images are served correctly. It listens only on `127.0.0.1:8000`.

### 6. Open in browser

- **Public site**: http://localhost:3000
- **Admin panel**: http://localhost:3000/admin/dashboard

### 7. Run Playwright E2E

Playwright starts its own isolated Astro frontend on `http://127.0.0.1:4323` so you can keep your manual dev server running on `http://localhost:3000` while tests execute.

```bash
npx playwright test
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev -- --host localhost --port 3000` | Start Astro dev server with HMR for manual development (port 3000) |
| `npx playwright test` | Run Playwright E2E suite on isolated frontend port 4323 |
| `npm run build` | Production build — generates 86 static HTML pages |
| `npm run preview` | Preview production build locally |
| `npm run check` | Run Astro type checking (0 errors expected) |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |

## Architecture

### Product PDF downloads

Products default to `pdf_download_enabled: true`, including existing products after migration. Admins can disable the option below the description editor. `GET /api/v1/products/{id-or-slug}/pdf` creates a fresh PDF from the current active product, gallery, rich description, specifications and visible option details. Disabled or inactive products return 404; responses are downloads with `no-store` caching and a 10-per-minute rate limit.

Run `composer install` and `php artisan migrate` when deploying this change. Enable PHP GD with JPEG/PNG/WebP support and keep `storage/framework` writable for the PDF renderer. The PDF embeds the product's main image, gallery, and description images. Bundled images are read from backend and frontend `public/images` directories; `PRODUCT_PDF_FRONTEND_IMAGES_PATH` can override the frontend images directory. Separate deployments fall back to the configured HTTPS `FRONTEND_URL` for missing bundled images. If externally hosted images are used, add their trusted HTTPS hostnames to `PRODUCT_PDF_REMOTE_IMAGE_HOSTS` (comma-separated); other remote resources are not fetched. Unavailable description images retain their descriptive text. The DD7 migration removes its old static PDF links without replacing the rest of its edited description.

The first page includes a locally generated QR code linking to the current product. Each download sends the browser's current origin, including its port, in `X-Site-Origin`; the backend accepts configured CORS/site origins and falls back to `FRONTEND_URL` for direct downloads. The QR and description links use that origin, so API proxy addresses are not printed. Keep `FRONTEND_URL` and allowed CORS origins aligned with deployed site domains. A QR generated on localhost points to localhost; downloads from the live domain point to that domain.

### Astro + React Islands

The site uses Astro's **static output mode** with **React islands** for interactivity:

- **Astro pages** (`.astro` files) handle routing, SEO meta, and page layout
- **React islands** handle all client-side interactivity (forms, cart, checkout, etc.)
- **BaseLayout.astro** provides the shared shell: `<head>`, HeaderIsland, FooterIsland, CookieBannerIsland
- **Admin panel** is a standalone React SPA mounted at `/admin/[...path].astro`

### Hydration Strategy

| Directive | Usage |
|-----------|-------|
| `client:load` | Most islands — SSR renders HTML, hydrates on page load |
| `client:only="react"` | ShopIsland, PaymentIsland, ResetPasswordIsland, AdminApp — skip SSR |
| `client:visible` | FooterIsland — hydrates when scrolled into view |
| `client:idle` | CookieBannerIsland — hydrates when browser is idle |

### State Management with Nanostores

All cross-island state uses **nanostores** (`src/stores/`):

| Store | Purpose |
|-------|---------|
| `cart.ts` | Cart items, totals, VAT, coupons, business mode |
| `auth.ts` | Customer profile, authentication state |
| `wishlist.ts` | Wishlist items (localStorage-persisted) |

Islands import directly from stores:
```tsx
import { useStore } from "@nanostores/react";
import { $cart, addToCart } from "@/stores/cart";

function MyIsland() {
  const cart = useStore($cart);
  // ...
}
```

### Error Boundaries

Critical islands (ProductDetail, Cart, Checkout, Payment, Account) are wrapped with `withErrorBoundary` HOC. If an island crashes, users see a retry button instead of a blank section.

## Deployment

### Build

```bash
npm run build
# Output: dist/ (86 HTML pages + assets)
```

### Static Hosting

Deploy the `dist/` folder to any static host:
- **Vercel**: `npx vercel --prod`
- **Netlify**: Build command `npm run build`, publish `dist`
- **Cloudflare Pages**: Same as Netlify
- **S3 + CloudFront**: Upload `dist/` contents

### Production Environment Variables

**Frontend** (set at build time):
```env
PUBLIC_API_URL=https://api.yourdomain.com/api
PUBLIC_STRIPE_KEY=pk_live_...
```

**Backend** (`backend/.env`):
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.yourdomain.com
SANCTUM_STATEFUL_DOMAINS=yourdomain.com,www.yourdomain.com
SESSION_DOMAIN=.yourdomain.com
```

### Reverse Proxy (Production)

The Vite dev proxy only works locally. In production, configure your web server:

```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location /sanctum/ { proxy_pass http://backend:8000; }
location /storage/ { proxy_pass http://backend:8000; }
```

## Admin Panel

React SPA at `/admin/*` with React Router navigation. Uses cookie-based auth (Sanctum).

Routes: dashboard, products, orders, customers, blog, services, portfolio, categories, coupons, quotes, reviews, FAQ, messages, settings.

## Troubleshooting

### Existing Word product descriptions

New product saves extract embedded raster images into public `product-content/` files without recompressing them. Word headings retain their appearance under the page title, and image layout tables stack on phones.

For existing records, run from `backend/`:

```bash
php artisan products:optimize-descriptions --id=81          # preview only
php artisan products:optimize-descriptions --id=81 --write  # back up and update this record
```

Omit `--id` to process all matching descriptions. Original descriptions and timestamps are saved in private `storage/app/private/description-backups/` JSON files before each database change. The command preserves product prices, stock, other fields and timestamps, skips concurrent edits, and does not trigger publishing hooks. Keep these backups for rollback; restore only the matching record's description after checking that it has not subsequently been edited. Ensure the public storage link and backend `APP_URL` are configured before running.

The sitemap index includes `/sitemap-content.xml`, which reads current active products, categories, services, projects and posts from the API. Cart, account and checkout pages are excluded.

### Vite cache issues (blank pages, 504 errors)
```bash
rm -rf node_modules/.vite && npm run dev
```

### API calls fail
- Verify backend is running (`php artisan serve`)
- Check Astro proxy config in `astro.config.mjs`
- For production, ensure `PUBLIC_API_URL` is set

### Build fails
```bash
npm run check    # Type errors
npm run build    # Full build — should produce 86 pages, 0 errors
```
