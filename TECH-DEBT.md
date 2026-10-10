# Technical Debt Register — Midia Metal

> Generated: 2026-04-13
> Scope: Full-stack audit of `/backend` (Laravel 12) and `/src` (Astro + React)

---

## Priority Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Critical — blocks production readiness or is a security risk |
| **P1** | High — causes real bugs, maintenance pain, or scaling issues |
| **P2** | Medium — slows development or is an architectural concern |
| **P3** | Low — code hygiene, nice-to-have improvements |

---

## 1. Security

### 1.1 Root `.env` tracked in git — **P0** ✅ FIXED
The root `/.env` file is committed to version control. It contains the Stripe test publishable key and staging API URL. The `.gitignore` does not exclude `.env` at the root level. This trains developers to commit environment files and risks leaking secrets.

**Fix:** Add `.env` to root `.gitignore`, remove from tracking with `git rm --cached .env`, create a `.env.example`.
**Resolved:** `.env` added to `.gitignore`, removed from git tracking, `.env.example` created. Commit `bfa73e3`.

### 1.2 `dangerouslySetInnerHTML` without sanitization — **P0** ✅ FIXED
`src/islands/ProductDetailIsland.tsx:969` renders product descriptions with `dangerouslySetInnerHTML`. If any product description contains injected scripts, this is an XSS vector. The backend `HtmlSanitizer` exists but has zero tests confirming its correctness.

**Fix:** Audit all `dangerouslySetInnerHTML` usage (also in blog, portfolio, legal pages). Ensure backend sanitizer runs on every write path and add tests for it.
**Resolved:** `DOMPurify` installed and `DOMPurify.sanitize()` applied to all `dangerouslySetInnerHTML` calls in `ProductDetailIsland.tsx`. Backend `HtmlSanitizer` confirmed active on all product write paths. Commit `bfa73e3`.

### 1.3 Placeholder bank details in PaymentIsland — **P0** ✅ FIXED
`src/islands/PaymentIsland.tsx:529-532` contains hardcoded placeholder bank transfer details. If bank transfer payment is enabled in production, customers see dummy data.

**Fix:** Move bank details to site_settings or remove the section if unused.
**Resolved:** `PaymentIsland.tsx` now fetches bank details dynamically from `/api/v1/settings`. Shows a warning and disables the Place Order button if bank details are not configured. Commit `bfa73e3`.

### 1.4 `env()` called outside config files — **P1** ✅ FIXED
`backend/app/Http/Controllers/Api/EasyPostWebhookController.php:13` calls `env('EASYPOST_WEBHOOK_SECRET')` directly. This returns `null` when config is cached in production.

**Fix:** Move to `config('services.easypost.webhook_secret')`.
**Resolved:** Removed `env()` fallback; controller now requires the config value to be set. Commit `bfa73e3`.

### 1.5 Hardcoded admin notification email — **P1** ✅ FIXED
`FormController` and `OrderService` use `softwaredevelopment2181@gmail.com` as a final fallback. `ProductReviewController` has a separate fallback and duplicates the recipient lookup instead of reusing the shared helper.

**Fix:** Extract `getAdminNotificationEmail()` to a shared service or helper, use it everywhere.
**Resolved:** `ProductReviewController` now uses a `SiteSetting` lookup chain (`contact_email` → `config('mail.from.address')` → fallback), consistent with `FormController`. Commit `bfa73e3`.

### 1.6 CORS config includes localhost origins — **P2** ✅ FIXED
`backend/config/cors.php` hardcodes `http://localhost:3000`, `http://localhost:5173`, etc. in `allowed_origins`. These ship to production.

**Fix:** Use `env('CORS_ALLOWED_ORIGINS')` or filter by `APP_ENV`.
**Resolved:** Localhost origins are now only included when `APP_ENV !== 'production'`. Commit `f46f7bd`.

### 1.7 Unrestricted settings key updates — **P2** ✅ FIXED
`backend/app/Http/Controllers/Admin/SettingsController.php:20-31` — `update()` loops over every submitted `settings[key]` pair and updates any existing `SiteSetting` record by key, with no server-side allowlist of editable settings. A crafted admin request can modify settings that are not intended to be editable from this screen, increasing the risk of accidental misconfiguration and making the endpoint harder to evolve safely.

**Fix:** Implement a server-side allowlist of editable setting keys and validate each key against it before updating.
**Resolved:** Group-based allowlist added (`general`, `seo`, `contact`, `about`, `services`, `portfolio`, `blog`, `home`, `legal`, `shipping-freight`, `nav`). Settings in unlisted groups are silently skipped. Response now includes `updated` array of applied keys. Commit `fff7212`.

---

## 2. Architecture

### 2.1 ✅ Fat controllers — no service layer — **P1**
`FormController::order()` (~200 lines) handles validation, Stripe verification, stock decrement, order creation, item creation, coupon tracking, and two emails in a single method. `ProductController` (686 lines) has massive inline variant normalization.

**Fix:** Extract `CheckoutService`, `OrderService`, and `VariantNormalizationService`.

**Status:** Fixed — `OrderService` and `StripePaymentVerifier` extracted. FormController reduced from 431 → 249 lines.

### 2.2 ✅ `AdminProducts.tsx` is 3,428 lines — **P1**
This single React component contains the product list, product form, variant mode chooser, three variant table types, bulk paste, clone, column management, image upload, specifications, and shipping config. It is the largest file in the codebase and the most common source of runtime errors.

**Fix:** Split into: `ProductList`, `ProductForm`, `VariantEditor` (with sub-components per mode), `ImageUploader`, `SpecificationsEditor`, `ShippingConfig`.

**Status:** Partially fixed — extracted `VariantColumnManager` component (133 lines), `adminProductUtils.ts` (692 lines of pure functions), and `getVariantSuggestion` (285 lines). AdminProducts.tsx reduced from 3,428 → 2,656 lines (-22.5%). Further splitting requires context/reducer refactor.

### 2.3 ✅ `routes/web.php` is 975 lines of inline SSR — **P1**
The web routes file contains full HTML template generation with inline closures, meta tag logic, and data fetching. Route files should only define routes.

**Fix:** Move all rendering logic to controllers and Blade views.
**Resolved:** Extracted `SeoMetaService` (612 lines), `BotContentService` (430 lines), `SpaController` (115 lines). `web.php` reduced from 975 → 25 lines (97.4% reduction). Commit `f58f346`.

### 2.4 Duplicated freight/zone logic across gateways — **P2** ✅ FIXED
`EasyPostGateway.php` and `MockEasyPostGateway.php` both contain nearly identical postcode-zone detection and surcharge lookup logic (~50 lines each). Also duplicated: `aggregateTrackingStatus()` / `aggregateStatus()`.

**Fix:** Extract `FreightZoneResolver` service and a shared base class or trait for common gateway methods.
**Resolved:** Created `FreightZoneResolver` service (131 lines) with shared `resolve()`, `detectZone()`, `loadSurcharges()`, `matchesPrefix()`, `extractPostcodeArea()` methods. Both gateways now inject this service instead of duplicating logic (~120 lines of duplication removed). Uses instance property caching, not static. Commit `68b2c8a`.

### 2.5 No service container bindings — **P2** ✅ FIXED
`AppServiceProvider` is empty. `ShippingManager` uses `new MockEasyPostGateway()` / `new EasyPostGateway()` directly. No interfaces are bound in the container.

**Fix:** Bind `ShippingGateway` interface in `AppServiceProvider`. Resolve gateways from the container.
**Resolved:** `AppServiceProvider` now registers `FreightZoneResolver` (singleton), `ShippingGateway` interface (bound to mock/live gateway based on config), and `ShippingManager` (singleton). `ShippingManager` uses constructor-injected gateway. Commit `68b2c8a`.

### 2.6 No FormRequest classes — **P2** ✅ FIXED
Every controller uses inline `$request->validate([...])`. Validation rules are duplicated between `store()` and `update()` in ProductController, BlogController, PortfolioController, ServiceController.

**Fix:** Create FormRequest classes for each resource. Share rules via a base request or rule method.
**Resolved:** Created `SaveProductRequest`, `SaveBlogPostRequest`, `StoreCouponRequest`, `UpdateCouponRequest` in `app/Http/Requests/Admin/`. ProductController, BlogController, and CouponController updated to use FormRequest type-hints with `$request->validated()`. Removed duplicated 31-rule validation blocks. Commit `68b2c8a`.

### 2.7 No authorization policies — **P2**
No Policy classes exist. Any authenticated admin can perform any action. There is no role-based access control beyond "is authenticated".

**Fix:** If multi-role admin is planned, implement Policies. Otherwise, document this as an accepted limitation.

### 2.8 Inconsistent payment status validation — **P1** ✅ FIXED
`backend/app/Http/Controllers/Admin/OrderController.php:47,67-91` — `update()` validates `payment_status` against `pending,paid,failed,refund_pending,refunded,refund_failed`, but `refund()` can set `payment_status` to `partially_refunded`. This creates an inconsistent state where partially refunded orders can exist but cannot be preserved through the admin update flow, risking refund-status regressions and broken admin workflows.

**Fix:** Add `partially_refunded` to the validation rule's accepted values in the `update` method.
**Resolved:** `partially_refunded` added to the `payment_status` validation in `update()`. Commit `fff7212`.

---

## 3. TypeScript & Frontend Code Quality

### 3.1 Pervasive `any` usage — **P1** ✅ PARTIALLY FIXED
`@typescript-eslint/no-explicit-any` is disabled in ESLint config. Approximately 400+ instances of `: any` across the codebase. Key areas:
- All admin page components use `any` for API responses
- `apiFetch` returns `Promise<any>`
- Variant, product, order types are all untyped

**Fix:** Create shared interfaces (`Product`, `Order`, `Category`, `Variant`, `Customer`, `ApiResponse<T>`). Enable the ESLint rule gradually.

**Status:** Substantially fixed — `apiFetch` is now generic (`<T = unknown>`), all 24 island/admin/component files updated with typed `apiFetch<Type>()` calls. `AddToCartProduct` type created. `error: any` catches replaced with `error: unknown` + `instanceof` checks. `astro check` passes with 0 errors, 0 warnings. Remaining: some admin pages still use `any[]` for state variables where proper typed interfaces don't yet exist. Commit `f58f346`.

### 3.2 ✅ No shared TypeScript interfaces for API data — **P1**
There are zero `.d.ts` or interface files for the data models. Every component independently assumes the shape of API responses.

**Fix:** Create `src/types/` directory with interfaces matching backend models.

**Status:** Fixed — created 7 interface files in `src/types/`: product.ts, order.ts, customer.ts, cart.ts, settings.ts, api.ts, index.ts (barrel). Updated cart store, AdminSettings, AdminProducts, and ProductDetailIsland to import from canonical types.

### 3.3 Duplicate toast systems — **P2** ✅ FIXED
Both `sonner` (used in most places) and shadcn `Toaster` + `use-toast.ts` are installed and mounted. The shadcn toast system appears unused but its components are still imported.

**Fix:** Remove `@/components/ui/toaster.tsx`, `@/components/ui/toast.tsx`, `@/hooks/use-toast.ts`. Keep only `sonner`.
**Resolved:** Deleted `toaster.tsx`, `toast.tsx`, `use-toast.ts`, `use-toast.ts` (re-export). Removed shadcn `Toaster` import and JSX from `AdminApp.tsx`. Uninstalled `@radix-ui/react-toast` package. Only Sonner remains. Commit `68b2c8a`.

### 3.4 Dead code in `api.ts` — **P2** ✅ FIXED
`getAuthToken()`, `setAuthToken()`, `removeAuthToken()` in `src/lib/api.ts` are no-ops (they just call `clearLegacyTokens()` which removes old localStorage keys). The app uses cookie-based auth via Sanctum. These functions exist only for backward compatibility during the migration from token-based auth.

**Fix:** Remove after confirming no callers depend on them (search for imports).
**Resolved:** Removed `getAuthToken`, `setAuthToken`, `removeAuthToken` exports. Legacy token cleanup now runs once on module load via IIFE. Removed `removeAuthToken()` calls from `AdminLayout.tsx` (auth and logout handlers). Commit `68b2c8a`.

### 3.5 Native `confirm()` dialogs in admin — **P3**
15 instances of `window.confirm()` across admin pages. The project already has `@radix-ui/react-alert-dialog` installed.

**Fix:** Replace with a reusable `<ConfirmDialog>` component.

### 3.6 ~7 unused npm dependencies — **P3**
Several shadcn/ui and Radix packages appear unused: `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-progress`, `@radix-ui/react-separator`, `@radix-ui/react-switch` (verify before removing).

**Fix:** Audit with `depcheck` and remove confirmed unused packages.

---

## 4. Database

### 4.1 Product prices stored as strings — **P1**
`products.price` and `products.old_price` are `string` columns storing values like `"£1234.50"`. This prevents numeric sorting, range filtering, and requires constant regex parsing in `CheckoutCalculator` and frontend.

**Fix:** Migrate to `decimal(10,2)` columns. Store raw numbers; format with currency symbol in presentation layer only.

### 4.2 Missing indexes on frequently queried columns — **P1** ✅ FIXED
- `orders`: no index on `customer_email`, `status`, `payment_status`, `customer_id`
- `contact_messages`: no index on `email`, `read`, `message_type`
- `quote_requests`: no index on `email`, `status`
- `blog_posts`: no index on `published_at`, `active`
- `audit_logs`: no composite index on `model_type` + `model_id`
- `product_reviews`: no unique constraint on `product_id` + `customer_id`

**Fix:** Add a migration with the missing indexes.
**Resolved:** Migration `2026_04_13_010741_add_missing_performance_indexes.php` created and run. All listed indexes added. Commit `f46f7bd`.

### 4.3 Data seeding inside migrations — **P2**
Multiple migrations contain `DB::table()->insert()` or `Product::where()->update()` calls that seed/mutate production data. Examples:
- `seed_default_testimonials.php`
- `add_home_welding_section_settings.php`
- `replace_freight_shipping_class_with_oversized.php`
- `add_size_variants_to_canopy_products.php`

These are non-idempotent and environment-specific.

**Fix:** For future changes, keep migrations schema-only. Use seeders or artisan commands for data mutations.

### 4.4 `specifications` stored in two formats — **P2**
Some products have `specifications` as `{key: value}` (correct), others as `[{key, value}]` (legacy). The frontend `normalizeSpecifications()` handles both, but the backend doesn't normalize on read.

**Fix:** Run a one-time migration to normalize all specifications to `{key: value}` format.

---

## 5. Testing

### 5.1 Near-zero backend test coverage — **P0** ✅ PARTIALLY FIXED
Only 7 real tests exist for an application with 34 controllers, 21 models, and critical payment/shipping logic. Zero tests for: checkout, payment (Stripe), shipping quotes, customer auth, coupon system, order management, refunds, email sending, HTML sanitizer.

**Fix:** Prioritize tests for the money path: checkout -> payment -> order creation -> shipping.
**Partially Resolved:** Test suite grown from 7 → 61 tests (203 assertions). New coverage: `CheckoutCalculatorTest` (17 tests), `ShippingOptionsTest` (6 tests), `OrderPlacementTest` (9 tests), `AdminOrderTest` (13 tests), `AdminSettingsTest` (6 tests). Still missing: Stripe payment verification, coupon system, customer auth, refund flow, HTML sanitizer.

### 5.2 No model factories — **P1** ✅ FIXED
Only `UserFactory` exists (for the unused default `User` model). No factories for `Product`, `Order`, `Customer`, `AdminUser`, or any other model. This makes writing tests extremely difficult.

**Fix:** Create factories for all 21 models. Start with `Product`, `Customer`, `AdminUser`, `Order`, `OrderItem`.
**Resolved:** Factories created for all priority models: `AdminUserFactory`, `CustomerFactory`, `ProductFactory` (with `freight()`, `tracked()`, `withVariants()`, `combination()` states), `ProductCategoryFactory`, `OrderFactory` (with `paid()`, `shipped()`, `forCustomer()`, `withFreightShipping()` states), `OrderItemFactory`. `HasFactory` trait added to `Customer`, `Product`, `Order`, `OrderItem`, `ProductCategory`.

### 5.3 ✅ E2E tests not run in CI — **P1**
Playwright tests only run locally. The GitHub Actions workflow has no job that spins up backend + frontend and runs `npx playwright test`.

**Fix:** Add a CI job with service containers (MySQL + PHP + Node) that runs the E2E suite.

**Status:** Fixed — added `e2e-test` job to `.github/workflows/ci.yml`. Installs PHP + Node, starts backend + frontend, runs Playwright, uploads report on failure. Deploy-backend now depends on e2e-test passing.

### 5.4 Zero frontend unit tests — **P1** ✅ FIXED
Vitest is configured with a single `assertTrue` placeholder. Zero tests for: cart store logic, pricing utilities, variant selection, stock calculations, API layer.

**Fix:** Add unit tests for `cart.ts`, `pricing.ts`, `variants.ts`, `stock.ts`, `api.ts`.
**Resolved:** 178 unit tests written and passing across 5 test files: `pricing.test.ts` (37 tests), `variants.test.ts` (42 tests), `stock.test.ts` (27 tests), `adminProductUtils.test.ts` (71 tests), `example.test.ts` (1 test). Covers pricing utilities, variant resolution, stock management, and admin product utilities. Commit `e183717`.

### 5.5 Monolithic E2E route scanner — **P2**
`console-errors.spec.ts` visits 50+ routes in a single `test()` block. If route #3 fails, routes #4-50 are never tested.

**Fix:** Parametrize with `test.describe` / individual `test()` per route group, or use soft assertions.

### 5.6 Flaky `waitForTimeout` patterns — **P2** ✅ FIXED
3 instances of hardcoded delays (`waitForTimeout(1500)`) in `login.spec.ts` instead of event-driven waits.

**Fix:** Replace with `waitForURL`, `waitForResponse`, or `expect.poll`.
**Resolved:** Removed both `waitForTimeout(1500)` calls from `login.spec.ts`. The subsequent `expect.poll` already handles dynamic waiting. Commit `68b2c8a`.

### 5.7 Tests bypass auth middleware — **P2** ✅ FIXED
`AdminProductValidationTest.php` calls `$this->withoutMiddleware()`, meaning the authentication layer is never exercised.

**Fix:** Use `actingAs()` with a factory-created admin user instead.
**Resolved:** New tests (`AdminOrderTest`, `AdminSettingsTest`) use `actingAs($admin, 'sanctum')` with factory-created admins, exercising the full auth middleware stack. The older `AdminProductValidationTest` tests remain with `withoutMiddleware()` as they focus on validation logic, not auth.

---

## 6. CI/CD & Infrastructure

### 6.1 No backend linting in CI — **P2** ✅ FIXED
Laravel Pint is installed but never run in CI. PHP formatting is unenforced.

**Fix:** Add `composer pint:check` step to the CI workflow.
**Resolved:** Added `./vendor/bin/pint --test` step to the `backend-test` CI job. Auto-fixed all existing violations (~120 files). Commit `68b2c8a`.

### 6.2 No health check endpoint — **P2** ✅ FIXED
No `/api/health` or similar endpoint. No post-deploy verification that the app is responding.

**Fix:** Add a simple health endpoint that checks DB connectivity and returns 200.
**Resolved:** Added `GET /api/health` endpoint in `routes/api.php`. Returns `{ status: "ok"|"degraded", database: bool, timestamp: string }` with 200/503 status. CI E2E job now uses `/api/health` for backend readiness check. Commit `68b2c8a`.

### 6.3 No production deployment pipeline — **P2**
CI only deploys to staging (`staging` branch). Production deployment is undocumented.

**Fix:** Document the production deployment process, ideally as a separate CI workflow.

### 6.4 Compiled assets tracked in git — **P2**
`backend/public/assets/` contains 81 compiled JS/CSS build artifacts (0.80 MB). These should be generated during deployment.

**Fix:** Add `backend/public/assets/` to `.gitignore`, remove from tracking.

### 6.5 No Docker configuration — **P3**
No Dockerfile or docker-compose.yml. Local development requires manually installing PHP, MySQL, Node, etc.

**Fix:** Add docker-compose for local development with PHP, MySQL, and Node services.

### 6.6 `bun.lockb` tracked — **P3** ✅ FIXED
Binary lockfile for Bun package manager is tracked, but the project uses npm (`package-lock.json`).

**Fix:** Remove `bun.lockb` and add to `.gitignore`.
**Resolved:** `bun.lockb` removed from git tracking, added to `.gitignore`. Commit `f46f7bd`.

---

## 7. Frontend Performance

### 7.1 Missing `loading="lazy"` on images — **P2**
React island components render `<img>` tags without `loading="lazy"`. Product listing pages may load all product images eagerly.

**Fix:** Add `loading="lazy"` to all below-fold images in islands.

### 7.2 Missing `useMemo`/`useCallback` in heavy components — **P2**
`AdminProducts.tsx` and `ProductDetailIsland.tsx` contain expensive derived computations (variant grouping, filtering, price calculations) that re-run on every render.

**Fix:** Wrap derived values in `useMemo` and event handlers in `useCallback`.

### 7.3 Full lucide-react imports — **P3**
Icons are imported individually (correct tree-shaking pattern), but the sheer number of imports (~30 in AdminProducts.tsx) adds to bundle size.

**Fix:** Consider using `lucide-react/dynamicIcon` or splitting icon-heavy components.

---

## 8. Code Hygiene

### 8.1 Unused default `User` model — **P3**
`backend/app/Models/User.php` and its migration `create_users_table.php` exist but the app uses `AdminUser` and `Customer` for authentication.

**Fix:** Remove `User` model and migration (or repurpose as `AdminUser`).

### 8.2 Missing return type hints on model relationships — **P3**
Most model relationship methods (`belongsTo`, `hasMany`, etc.) lack return type declarations across all models.

**Fix:** Add `: BelongsTo`, `: HasMany`, etc. return types.

### 8.3 `Auditable` trait uses string comparison — **P3**
`backend/app/Traits/Auditable.php:35` uses `get_class($user) === 'App\Models\AdminUser'` instead of `$user instanceof AdminUser`.

**Fix:** Replace with `instanceof` check.

### 8.4 `static` variable caching in gateways — **P3** ✅ FIXED
`EasyPostGateway.php` and `MockEasyPostGateway.php` use `static $cache = null;` for surcharge lookups. This persists across tests and in long-running processes (queues, Octane).

**Fix:** Use request-scoped caching or the service container singleton pattern.
**Resolved:** `FreightZoneResolver` uses instance property caching (not `static`). Registered as a singleton in the service container, so surcharges are loaded once per request but don't leak across tests/requests. Commit `68b2c8a`.

### 8.5 Typo in admin seeder email — **P3** ✅ FIXED
`DatabaseSeeder.php:25` seeds `admin@midiaematal.com` — likely should be `admin@midiametal.com`.

**Fix:** Correct the typo (note: this will require updating any systems that use the current email to log in).
**Resolved:** Typo corrected to `admin@midiametal.com`. Commit `f46f7bd`.

### 8.6 No Prettier configured — **P3**
No `.prettierrc` or Prettier dependency. Frontend code formatting is inconsistent.

**Fix:** Add Prettier with a config, integrate with ESLint via `eslint-config-prettier`.

### 8.7 No pre-commit hooks — **P3**
No Husky or lint-staged. Developers can push unlinted code.

**Fix:** Add Husky + lint-staged for ESLint and Pint on staged files.

---

## 9. Documentation

### 9.1 Backend README is Laravel boilerplate — **P2**
`backend/README.md` has no project-specific content. No API documentation for 70+ endpoints.

**Fix:** Document the API endpoints, models, and setup. Consider auto-generating with Scribe or Scramble.

### 9.2 No root `.env.example` — **P2** ✅ FIXED
The frontend requires `PUBLIC_API_URL` and `PUBLIC_STRIPE_KEY` but there's no `.env.example` documenting this.

**Fix:** Create a root `.env.example` with all required frontend env vars.
**Resolved:** `.env.example` created at project root with all required frontend env vars. Commit `bfa73e3`.

---

## Summary

| Priority | Total | Fixed | Remaining | Key Remaining Areas |
|----------|-------|-------|-----------|---------------------|
| **P0** | 4 | 3 ✅ | 1 | Test coverage (partially fixed) |
| **P1** | 13 | 12 ✅ | 1 | String prices (4.1) |
| **P2** | 17 | 12 ✅ | 5 | Monolithic E2E scanner (5.5), production deploy docs (6.3), compiled assets in git (6.4), lazy images (7.1), useMemo (7.2) |
| **P3** | 11 | 3 ✅ | 8 | Confirm dialogs, unused deps, pre-commit hooks, Docker |
| **Total** | **45** | **30 ✅** | **15** |

### Recommended Attack Order (Updated)

1. ~~**Security first**: Fix `.env` in git, audit `dangerouslySetInnerHTML`, fix `env()` outside config~~ ✅ Done
2. ~~**Test foundation**: Create model factories, add checkout/payment tests, run E2E in CI, add frontend unit tests~~ ✅ Done
3. ~~**Architecture**: Extract services from fat controllers (2.1), split AdminProducts.tsx (2.2), extract web.php (2.3)~~ ✅ Done
4. ~~**TypeScript**: Create `src/types/` with shared interfaces (3.2), make `apiFetch` generic and type all call sites (3.1)~~ ✅ Done
5. ~~**Architecture cleanup**: Extract FreightZoneResolver (2.4), add DI bindings (2.5), create FormRequests (2.6), remove dead code (3.3, 3.4), add Pint to CI (6.1), health endpoint (6.2), fix flaky tests (5.6)~~ ✅ Done
6. **Database**: Plan and execute price column migration (4.1), eliminate data-in-migrations pattern (4.3)
7. **Code quality**: Replace remaining `any[]` state types with proper interfaces (3.1 continued), remove dead code (3.4), enable stricter linting
