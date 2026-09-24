# BrewCore bootstrap report

This inventory was made before anything was copied, as CLAUDE.md's *Initial
task* requires. The reference was `MacNite/NutriCore` at its default branch
(shallow clone, read-only). Every file on the CLAUDE.md list exists in
NutriCore except where noted below.

| Requested file                    | Found | Notes                                                                                 |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| `package.json`                    | yes   |                                                                                       |
| `Dockerfile`                      | yes   | multi-stage: deps → build → prod-deps → `migrate` → runner                            |
| `docker-compose.yml`              | yes   | `db`, `migrate`, `app`, `worker`                                                      |
| `prisma/schema.prisma`            | yes   | ~1,400 lines, almost entirely nutrition domain                                        |
| `src/lib/auth.ts`                 | yes   | Argon2id, opaque tokens, cookie options, password policy                              |
| `src/server/session.ts`           | yes   | `getSessionUser`, `requireUser`, `requireAdmin`, `assertSameOrigin`, locale           |
| `src/components/app-shell.tsx`    | yes   | top bar + bottom navigation                                                           |
| `src/app/manifest.ts`             | yes   |                                                                                       |
| `src/server/recipe-actions.ts`    | yes   | Zod-validated Server Actions → `src/server/recipes.ts`                                |
| `src/server/recipes.ts`           | yes   | ownership-scoped persistence, transactions                                            |
| `next.config.ts`                  | yes   | standalone output, `serverExternalPackages: ["argon2"]`, body-size limits              |
| `.github/workflows/ci.yml`        | yes   | test job on real PostgreSQL, datasets job, docker job                                 |
| `.github/workflows/publish.yml`   | yes   | verify → publish app + migrate images to GHCR                                          |

Related files that turned out to matter: `docker/{entrypoint,healthcheck,migrate}.sh`,
`src/middleware.ts`, `src/lib/{env,security-headers,rate-limit,client-address,redact,logger,db,image-upload-limit,shrink-image}.ts`,
`src/server/{auth-actions,registration,durable-rate-limit,admin,admin-actions,image-upload,export}.ts`,
`src/instrumentation.ts`, `src/i18n/*`, `scripts/start-standalone.mjs`,
`playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `tests/i18n.test.ts`.

## KEEP (ported with renaming only)

- **Stack and versions**: Node 22, Next.js 15 App Router, React 19.1, Prisma 6.15,
  Zod 4, next-intl 4, Vitest 3, Playwright, ESLint 9 flat config, TypeScript 5.9.
- **Authentication** (`src/lib/auth.ts`): Argon2id (OWASP parameters), 256-bit
  opaque session tokens, SHA-256 token hashes in the database, HttpOnly +
  `SameSite=Lax` cookies, `Secure` derived from `APP_URL`, 30-day expiry,
  length-first password policy.
- **Sessions** (`src/server/session.ts`): per-request cached `getSessionUser`,
  `requireUser`/`requireAdmin`, `assertSameOrigin` for route handlers,
  `resolveLocale`.
- **Registration policy** (`src/server/registration.ts`): the decision taken
  inside a transaction behind `pg_advisory_xact_lock`, first account becomes
  admin.
- **Rate limiting**: in-memory fixed window plus the durable PostgreSQL bucket
  (`RateLimitBucket`) with in-memory fallback; `clientAddress` with
  `TRUSTED_PROXY_HOPS`; per-account login throttle keyed on a hash.
- **Security headers** in middleware with a per-request CSP nonce, the
  password-change gate, `assertSecureDeployment` in `instrumentation.ts`.
- **Logger** with key- and value-based redaction (`logger.ts`, `redact.ts`).
- **Image upload validation** by magic number, size policy from
  `IMAGE_UPLOAD_MAX_MB`, client-side shrinking before upload.
- **Docker**: the same multi-stage Dockerfile; the one-shot `migrate` image is
  the only one with the Prisma CLI; non-root user; `migrate.sh` with P3009
  recovery; `start-standalone.mjs` so E2E runs the production server.
- **Compose**: `db` (not published, bind-mounted data and backups), `migrate`
  (`service_completed_successfully` gate), `app` with healthcheck,
  `no-new-privileges`, `DATABASE_URL` composed from `POSTGRES_*`.
- **CI**: real PostgreSQL service, `migrate deploy`, lint, typecheck, unit
  tests, build, Playwright; docker job asserting the runtime image has no
  Prisma CLI but loads `@prisma/client`.
- **Publishing**: `publish.yml` unchanged in shape — verify job first; semver,
  `main`, SHA and `latest` tags; SBOM and provenance; amd64 on `main`,
  amd64+arm64 on release tags and on request.
- **i18n**: `messages/{en,de}.json`, `src/i18n/request.ts`, the catalogue
  parity test.
- **Theme**: `data-theme` + inline nonced `ThemeScript`, light/dark/system.
- **Admin invitations** (copy-link only): hashed single-use tokens with expiry.
- **JSON export** envelope with a format `version`.

## ADAPT

- **Branding**: `nutricore_*` cookies → `brewcore_session`,
  `brewcore_password_change`; theme storage key `brewcore-theme`; image names
  `ghcr.io/macnite/brewcore` and `-migrate`; Compose project `brewcore`; the
  advisory-lock key is new.
- **Environment** (`src/lib/env.ts`): reduced to what BrewCore uses. No
  `APP_SECRET` (NutriCore only used it to encrypt the SMTP password, and BrewCore
  has no SMTP); no AI, food-source or research variables.
- **Registration modes**: NutriCore's `bootstrap`/`open`/`disabled`, with
  `invite` accepted as an alias for `bootstrap` (decision recorded in SPEC §47).
- **Healthcheck/entrypoint**: worker branch removed — there is no worker in v0.1.
- **Security headers**: `Permissions-Policy` allows `camera=(self)` for the bag
  photo and denies everything else; `connect-src 'self'`; `worker-src 'self'`
  for the service worker.
- **Images**: stored as `Bytes` in PostgreSQL like NutriCore's meal images, so
  `pg_dump` backups include them and no upload volume is needed. One image per
  request, so the body limit is `IMAGE_UPLOAD_MAX_MB + 1`.
- **App shell**: BrewCore's own navigation (Home · Coffee · **Brew** · Recipes ·
  More) with a central Brew button (§38); its own palette.
- **Recipes**: NutriCore's ingredient recipes become structured brewing recipes
  with ordered steps; the Server Action → `src/server/*.ts` layering, Zod
  parsing and ownership-scoped `where` clauses are kept.
- **Favorites**: NutriCore's composite-key `Favorite(userId, foodId)` becomes
  one table with exactly one of `coffeeId`/`recipeId`/`brewId` (§64).
- **Manifest**: BrewCore name, categories `food, lifestyle, utilities`, new
  icons.
- **CI**: adds `prisma validate`, a schema/migration drift check and the
  catalogue seed; the `datasets` job is removed.

## REMOVE

Everything nutrition-specific: foods, nutrients, BLS/USDA datasets, Open Food
Facts, FatSecret, diary, meals, weight, body measurements, body scan, health
imports and device tokens, nutrition targets, calorie calculations, food
research, SearXNG, Ollama/AI jobs and the worker process, recipe publications,
food reports, enrichment, SMTP mailer and `MailSettings`, the marketing
`website/`, `AuditLog`, and all 33 NutriCore migrations (BrewCore starts with a
clean initial migration). Dependencies dropped: `@zxing/browser`,
`html-to-image`, `jose`, `nodemailer`, `sharp`, `undici`.

## NEW

- Prisma domain model: `Roaster`, `Coffee`, `GrinderModel`, `UserGrinder`,
  `Brewer`, `Recipe`, `RecipeStep`, `Brew`, `BrewStepResult`, `Tasting`,
  `Favorite`, with nullable `ownerId` for catalogue rows and `Decimal` columns.
- Bundled catalogue seed (grinders, brewers, recipes), idempotent, production-safe.
- Pure domain library `src/lib/brewing/` (ratio, scaling, timer, state machine,
  recipe, tasting) and `src/lib/scales/types.ts` (adapter interface only).
- Guided Live Brew UI with Wake Lock, cues and IndexedDB persistence.
- Offline completion outbox and idempotent completion/tasting route handlers.
- Service worker (hand-written, no dependency) for the app shell and active brew.
- Schema/migration drift check script.
- AGPL-3.0 license.
