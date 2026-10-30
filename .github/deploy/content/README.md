# Content branch deployment

`.github/workflows/content-deploy.yml` runs on pushes to `content`. Pull requests targeting `content` run checks only. Deploy requires the frontend build, backend tests and Playwright tests to pass. As in the existing staging workflow, frontend lint runs and reports separately; it is not a deployment prerequisite.

The workflow uses the dedicated `CONTENT_HOSTINGER_SSH_PRIVATE_KEY` repository secret. Its dedicated configuration is loaded with `--config .github/deploy/content/astro.config.mjs`; the existing staging workflows and default application configuration are unchanged.

## Targets

| Component | Address / path |
| --- | --- |
| Frontend | `https://test.midiawork.com` |
| API | `https://api-test.midiawork.com/api` |
| Frontend releases | `/home/u993999906/domains/test.midiawork.com/hbuilds/versions/content-<run_id>-<attempt>/nodejs` |
| Active frontend | `/home/u993999906/domains/test.midiawork.com/hbuilds/current` |
| Laravel application | `/home/u993999906/domains/api-test.midiawork.com/.midia-deploy/backend-20261024-01` |
| MySQL database | `u993999906_test_midia` on `localhost:3306` |

These paths were verified against the test sites' existing Passenger and PHP front-controller configuration. The workflow preserves both sites' `public_html` routing files, the backend `.env`, storage/uploads, and server-managed files outside the synchronized code directories. Only the configured test database receives migrations; database credentials stay on the server.

`verify-backend.php` checks both `.env` and effective Laravel configuration before syncing code and again before migrations. It rejects unexpected application paths, URLs, database settings, database URL/write overrides, and enabled admin workflow dispatch. Keep `FRONTEND_DEPLOY_TRIGGER_ENABLED=false` in this environment: the requested trigger is a `content` push, and the separate admin dispatch workflow still belongs to staging.

## Runtime and release behavior

Browser calls use `/api` and `/sanctum` on the frontend hostname. The dedicated Node proxy forwards them to `api-test.midiawork.com`, preserving the current host-only session/CSRF cookies and the existing LiteSpeed response handling. SSR and build-time fetches call the test API directly. The test runtime uses Node 22, the existing test-mode Stripe public key, and `X-Robots-Tag: noindex, nofollow`.

After backend deployment, the frontend is rebuilt against the updated API. It is uploaded into a new release directory and its production dependencies are installed before the `current` symlink is switched. HTTP checks verify the release header, a rendered content page and the proxied API. Failed activation/HTTP checks restore the previous frontend symlink when it still points to this workflow's release. Backend code and migrations are not automatically rolled back. Old frontend releases are retained.

## Local checks

```bash
node --test .github/deploy/content/runtime.test.mjs
npm run check -- --config .github/deploy/content/astro.config.mjs
PUBLIC_API_URL=/api API_BACKEND_URL=https://api-test.midiawork.com npm run build -- --config .github/deploy/content/astro.config.mjs
bash .github/deploy/content/validate-build.sh
```

The workflow files must be committed and pushed to `content` to activate this pipeline. Preparing or validating these files locally does not deploy either site.
