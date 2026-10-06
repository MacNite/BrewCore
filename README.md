# BrewCore

Privacy-first, self-hosted coffee brewing and tracking — the coffee-oriented
sibling of [NutriCore](https://github.com/MacNite/NutriCore).

```
Coffee → Recipe → Guided Brew → Taste → Adjust → Repeat
```

BrewCore helps you reliably reproduce good coffee: pick a coffee and a recipe,
follow a guided, timed brew (it keeps working offline once started), rate the
result, and brew it again tomorrow with every parameter carried over.

- Coffees (with optional bag photo) and roasters shared across the instance:
  what is on the bag is visible to everyone, your bag (roast date, weights,
  notes) stays private; similar coffees are suggested while adding one, others
  can fill in missing info for the creator to accept, and administrators merge
  duplicates
- Personal grinders on top of a bundled grinder catalogue, bundled and custom
  brewers
- Structured recipes with ordered, reorderable steps, cumulative water targets
  and deterministic scaling from the coffee or the water; a bundled recipe catalogue (V60, AeroPress,
  French Press, Chemex, Kalita Wave, Clever Dripper, Espresso, Moka Pot)
- Guided Live Brew: large timer, current instruction and target, next-step
  preview, pause/resume, manual or automatic step changes, sound/vibration
  cues, screen wake lock
- Brew history with snapshots (later edits never change past brews), tasting
  and rating, Brew Again, favorite coffees and recipes, JSON export
- Installable PWA; an active brew survives reloads and network loss, and its
  completion is synced exactly once when the connection returns
- English and German

The product and architecture spec is [`docs/SPEC.md`](docs/SPEC.md).

**Website and demo:** <https://macnite.github.io/BrewCore/> — a feature
overview and an interactive [static demo](https://macnite.github.io/BrewCore/demo/)
(sample data, runs entirely in the browser). See *Website* below.

## Running with Docker Compose

Requirements: Docker with Compose v2.

```sh
cp .env.example .env
# set POSTGRES_PASSWORD (and APP_URL if not http://localhost:3000)
docker compose up -d
```

Open <http://localhost:3000> and create the first account — it becomes the
administrator. After that, sign-up closes (`REGISTRATION_MODE=bootstrap`) and
new people join through invitation links created under **Settings →
Administration**. Each new link is also shown as a QR code (generated on the
server, never by an external service) that the person can scan with their
phone, or that you can save and send. Invitation links and QR codes are built
from `APP_URL`, so set it to the address other people's devices can reach.

The stack has three services:

| Service   | What it does |
| --------- | ------------ |
| `db`      | PostgreSQL 17; not published outside the compose network; data in `POSTGRES_DATA_PATH` |
| `migrate` | one-shot: waits for the database, runs `prisma migrate deploy`, seeds the bundled catalogue, exits |
| `app`     | the BrewCore server on port `APP_PORT` (default 3000); starts only after `migrate` succeeded; health check `GET /api/health` |

Images are published to `ghcr.io/macnite/brewcore` and
`ghcr.io/macnite/brewcore-migrate` (tags: `latest`, `main`, semver, short SHA;
amd64, plus arm64 for releases). Pin **both** `APP_IMAGE` and `MIGRATE_IMAGE`
to the same tag for a reproducible deployment. `docker compose up -d --build`
builds both from source instead.

### Configuration

All variables are documented in [`.env.example`](.env.example). The important
ones:

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `POSTGRES_PASSWORD` | — (required) | database password |
| `APP_URL` | `http://localhost:3000` | public URL; `https://` marks cookies `Secure`, except for a sign-in from a browser that is itself on plain `http://` (e.g. the LAN address of an instance whose `APP_URL` is its HTTPS name), which would otherwise drop the cookie. A production start refuses a public plain-HTTP URL unless `ALLOW_INSECURE_APP_URL=true` |
| `APP_PORT` | `3000` | published port |
| `REGISTRATION_MODE` | `bootstrap` | `bootstrap` (= `invite`), `open`, `disabled` |
| `DEFAULT_LOCALE` | `de` | language for new accounts and signed-out pages (`de`/`en`) |
| `IMAGE_UPLOAD_MAX_MB` | `5` | bag photo size limit (max 15) |
| `TRUSTED_PROXY_HOPS` | `0` | reverse proxies that append `X-Forwarded-For` (for rate limiting) |
| `OIDC_ENABLED` / `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | `false` / — | optional single sign-on, see [Single sign-on](#single-sign-on-openid-connect--authentik) |
| `OIDC_AUTO_CREATE` / `OIDC_REQUIRE_VERIFIED_EMAIL` / `OIDC_SINGLE_LOGOUT` | `false` / `true` / `true` | account creation, email verification and provider logout for single sign-on |
| `OIDC_SCOPES` / `OIDC_PROVIDER_NAME` | `openid email profile` / `authentik` | requested scopes and the sign-in button label |
| `AUTH_PASSWORD_LOGIN` | `true` | `false` makes single sign-on the only way in, apart from the administrators' break-glass at `/login?local=1` |

Behind a reverse proxy, terminate TLS there, set `APP_URL` to the `https://`
URL and set `TRUSTED_PROXY_HOPS` to the number of proxies (the outermost must
strip inbound `X-Forwarded-For`).

### Single sign-on (OpenID Connect / authentik)

BrewCore can sign people in through any OpenID Connect provider. It is written
and documented against [authentik](https://goauthentik.io/), but uses nothing
authentik-specific: discovery, the authorization-code flow with PKCE, a signed
ID token, and optionally the userinfo and end-session endpoints.

**In authentik:**

1. *Applications → Providers → Create → OAuth2/OpenID Provider.*
   - Client type: *Confidential*.
   - Redirect URIs: `https://brewcore.example.com/api/auth/oidc/callback`
     (your `APP_URL` plus that path). For single logout also add
     `https://brewcore.example.com/login`.
   - Scopes: the default `openid`, `email` and `profile` mappings.
   - Signing key: any certificate (RS256). Leaving it empty also works; authentik
     then signs with the client secret (HS256), which BrewCore accepts.
2. *Applications → Create*, slug e.g. `brewcore`, using that provider. Bind
   users or groups to the application to decide who may sign in at all.
3. In `.env`:

   ```env
   OIDC_ENABLED=true
   OIDC_ISSUER=https://auth.example.com/application/o/brewcore/
   OIDC_CLIENT_ID=<Client ID from the provider>
   OIDC_CLIENT_SECRET=<Client Secret from the provider>
   ```

   The issuer is the provider's *OpenID Configuration Issuer*, shown on its
   overview page. Restart the app; the sign-in page now has a
   *Sign in with authentik* button.

**How accounts are matched.** On a person's first single sign-on, the email the
provider releases is matched, case-insensitively, against BrewCore's accounts. A
match is then **bound to the provider's subject (`sub`)**: from then on the
sign-in is recognised by that subject, so changing the email on either side does
not move it onto a different account, and an account bound to one identity is
never taken over by another. When no account has the email:

| Situation | Result |
| --- | --- |
| An open invitation exists for the email | The account is created with the invitation's role, and the invitation is used up |
| The instance has no account yet (and `REGISTRATION_MODE` is not `disabled`) | The account is created as the administrator, like the first password registration |
| `OIDC_AUTO_CREATE=true` | The account is created as a normal member |
| Otherwise | Refused: *There is no account for your email address* |

Accounts created this way have no usable password; the settings page says the
provider manages it. Administrator rights stay managed inside BrewCore;
authentik groups do not change them.

`OIDC_REQUIRE_VERIFIED_EMAIL` (default `true`) refuses to match or create an
account from an email the provider does not mark `email_verified`. Email is the
key that decides which account a sign-in reaches, so if users can edit their own
email in authentik, an unverified one could claim somebody else's not-yet-linked
account. If your authentik email mapping reports `email_verified: false` and
only administrators can change emails there, set it to `false`, or adjust the
`email` scope mapping to return `True`.

**Single sign-on only.** `AUTH_PASSWORD_LOGIN=false` makes the provider the only
way in: the password form, the sign-up page and the password form on invitation
links disappear (an invitation is honoured on the first single sign-on with its
email), and password sign-in is refused for everyone **except administrators**,
who keep a break-glass form at `/login?local=1` (not linked anywhere) for the
day the provider is down. The switch is ignored, with a warning in the log at
start-up, while single sign-on is not fully configured, so a typo cannot lock
everybody out.

**Signing out.** With `OIDC_SINGLE_LOGOUT=true` (default), signing out of a
single sign-on session also ends the authentik session through its end-session
endpoint and returns to `/login`. Otherwise only the BrewCore session ends.

### Backups

The database directory is bind-mounted (`POSTGRES_DATA_PATH`) and a backup
directory is mounted into the `db` container at `/backups` (`BACKUP_PATH`).
Bag photos live in the database, so a database dump is a complete backup.

```sh
# Back up
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /backups/brewcore-$(date +%F).dump'

# Restore into an empty database (stop the app first)
docker compose stop app
docker compose exec db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/brewcore-YYYY-MM-DD.dump'
docker compose start app
```

Schedule the backup command with the host's cron or NAS scheduler; BrewCore
has no internal backup scheduler. Every user can also download their own data
as JSON under **Settings**.

### Upgrading

```sh
docker compose pull && docker compose up -d
```

`migrate` applies new migrations and refreshes the bundled catalogue before the
new app starts. Bundled recipes are updated by key; your own recipes and copies
are never touched.

## Development

Requirements: Node.js 22, PostgreSQL 16+.

```sh
npm ci
cat > .env <<'ENV'
DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore?schema=public
TEST_DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore?schema=public
SHADOW_DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore_shadow?schema=public
APP_URL=http://localhost:3000
ENV
npx prisma generate
npm run db:migrate       # apply migrations
npm run db:seed          # bundled grinders, brewers, recipes
npm run dev              # http://localhost:3000
```

Optional demo data (development only): `SEED_PASSWORD=some-long-password npm
run db:seed:demo` creates `demo@brewcore.invalid` with example coffees.

### Checks

These are what CI runs (see `.github/workflows/ci.yml`):

```sh
npm run lint
npm run typecheck
npm test                 # unit tests; DB integration tests when TEST_DATABASE_URL is set
npx prisma validate
npm run db:drift         # schema.prisma must match the committed migrations (needs SHADOW_DATABASE_URL)
npm run db:migrate       # against a fresh database
npm run build
npm run test:e2e         # Playwright; starts the production server on port 3100
docker build -t brewcore .
docker build -t brewcore-migrate --target migrate .
```

A schema change needs a migration: `npm run db:migrate:dev -- --name <change>`.

### Layout

| Path | Contents |
| ---- | -------- |
| `src/app` | routes and page composition (App Router) |
| `src/components` | UI; `components/live` is the guided brew screen |
| `src/server` | business operations and persistence; every query is ownership-scoped |
| `src/lib/brewing` | pure domain logic: ratio, scaling, timer, state machine, recipe, tasting |
| `src/lib/offline` | IndexedDB active-brew store and completion outbox |
| `src/lib/catalogue` | bundled grinders, brewers and recipes (EN/DE) |
| `public/sw.js` | service worker |
| `prisma` | schema, migrations, seeds |
| `messages` | `en.json`, `de.json` |

## License

[AGPL-3.0-only](LICENSE).

## Website

`site/` holds the project website and the static demo: plain HTML, CSS and
JavaScript with no build step and no external requests, in English and German.
`.github/workflows/pages.yml` publishes it to GitHub Pages on every push to
`main` that touches `site/` (or manually via *Run workflow*). One-time setup:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

The demo mirrors the app's behaviour (bundled recipes, deterministic dose
scaling, a timestamp-derived brew timer, tasting, history snapshots, Brew
Again) but shares no code with it and keeps its sample data in the browser's
`localStorage`. Preview locally with `python3 -m http.server -d site 8080`.
