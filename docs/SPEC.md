# BrewCore — Product & Architecture Specification

> This is the full product specification. The working rules for Claude
> (workflow, quality checks, git/PR process) live in [`/CLAUDE.md`](../CLAUDE.md).
> When the spec and the code disagree, or the spec is ambiguous, ask — and
> update this file in the same PR as the decision.

## Project mission

Build **BrewCore**, a privacy-first, self-hosted coffee brewing and tracking application.

BrewCore should feel like the coffee-oriented sibling of NutriCore.

The application combines:

- coffee bean and coffee bag management
- grinder database and personal grinder profiles
- brewer/equipment management
- structured brewing recipes
- interactive guided brewing
- brew history
- tasting and rating
- recipe iteration / dial-in
- statistics and comparison
- optional smart-scale integration later

The core product loop is:

```
Coffee → Recipe → Guided Brew → Taste → Adjust → Repeat
```

The primary goal is not merely to store coffee recipes. The application should
help users reliably reproduce good coffee and understand which variables
changed the result.

---

## 1. Reference architecture

Use the existing NutriCore repository (`MacNite/NutriCore`) as the architectural
reference. See `CLAUDE.md` for how to get access to it in a session.

Do **not** redesign the project into a separately deployed frontend and REST
backend unless technically necessary. NutriCore uses a Next.js full-stack
architecture and BrewCore should retain that principle.

### Existing NutriCore stack to retain

- Node.js 22
- TypeScript
- Next.js 15 App Router
- React 19
- PostgreSQL
- Prisma
- Zod
- next-intl
- Vitest
- Playwright
- Docker / Docker Compose
- GitHub Actions
- GHCR image publishing
- standalone Next.js production build

Versions listed here reflect NutriCore at the time of writing. At bootstrap,
match the versions in NutriCore's `package.json` rather than this list.

Reuse the architectural patterns visible in NutriCore's `Dockerfile`,
`docker-compose.yml`, `src/app`, `src/server`, `src/lib`, `src/components`,
`src/i18n`, `messages`, `prisma` and `.github/workflows`.

---

## 2. Deployment model

BrewCore initially reproduces NutriCore's proven deployment design.

Compose services:

| Service  | Purpose                                   |
| -------- | ----------------------------------------- |
| `db`     | PostgreSQL                                |
| `migrate`| one-shot migration container              |
| `app`    | main application                          |
| `worker` | optional; omitted in MVP                  |

### db

PostgreSQL. Defaults: `POSTGRES_DB=brewcore`, `POSTGRES_USER=brewcore`.

- The database must **not** be exposed publicly by default.
- Persist PostgreSQL data through a configurable bind mount.

### migrate

One-shot migration container. It:

1. waits for PostgreSQL
2. runs `prisma migrate deploy`
3. exits successfully
4. must finish before `app` starts

Retain NutriCore's principle that the long-running application image does not
require the Prisma CLI.

Image: `ghcr.io/macnite/brewcore-migrate`

### app

Main BrewCore application.

- Image: `ghcr.io/macnite/brewcore`
- Internal port: `3000`, exposed via configurable `APP_PORT=3000`
- Health endpoint: `GET /api/health`

### worker

Do **not** introduce background processing simply because NutriCore contains a
worker. Only add it when BrewCore gains functionality that actually requires it.

Potential later uses: coffee-bag OCR, AI metadata extraction, image processing,
data imports, catalogue updates, asynchronous recommendation generation.

For the MVP the worker is omitted entirely. Keep the architecture worker-ready.

---

## 3. Naming

| Item                    | Value      |
| ----------------------- | ---------- |
| Repository              | `BrewCore` |
| npm package             | `brewcore` |
| Docker Compose project  | `brewcore` |
| Application             | BrewCore   |

- Container/service names should be derived from the Compose project rather
  than hard-coded wherever possible.
- Images: `ghcr.io/macnite/brewcore`, `ghcr.io/macnite/brewcore-migrate`.
- Session cookies must not retain NutriCore names. Use `brewcore_session` and
  `brewcore_password_change`.
- Replace all branding strings and identifiers.

---

## 4. Repository creation strategy

Do not start by modifying the NutriCore domain model. BrewCore is a separate
repository; use NutriCore as an implementation template and copy/reimplement
the infrastructure that is valuable.

**Retain:** Docker infrastructure, authentication, sessions, user management,
security helpers, rate limiting, environment validation, database wrapper, i18n
structure, theme handling, app shell architecture, testing infrastructure,
GitHub Actions, container publishing, health checks, logging conventions.

**Remove** nutrition-specific features, e.g. foods, nutrients, diary, weight,
body measurements, health imports, food sources, nutrition targets, meal types,
calorie calculations, body scan, food research.

Do not carry unused NutriCore database models into BrewCore. Start with a clean
initial Prisma migration.

---

## 5. Product architecture

BrewCore distinguishes four concepts clearly:

1. **Catalogue data** — grinder models, brewers, bundled recipes (shared)
2. **User equipment** — the user's own grinders
3. **Recipes** — structured, editable brewing procedures
4. **Actual brews** — immutable records of what happened

Never overwrite historical Brew data when a coffee, grinder or recipe changes.
A completed brew represents what actually happened at that moment, so Brew
records contain snapshots of important parameters (§19).

---

## 6. Core entities

MVP:

- `User`
- `Coffee`
- `Roaster`
- `GrinderModel`
- `UserGrinder`
- `Brewer`
- `Recipe`
- `RecipeStep`
- `Brew`
- `BrewStepResult`
- `Tasting`
- `Favorite`

v0.2:

- `RecipeGrinderPreset` (§17)

Future:

- `ScaleDevice`
- `ScaleSample`
- `RecipePublication`
- `CoffeeBagScan`
- `CoffeeInventoryTransaction`

### Catalogue vs. user-owned data

Catalogue-type entities (`Roaster`, `GrinderModel`, `Brewer`, `Recipe`) use a
**nullable `ownerId`**:

- `ownerId = null` → bundled/global entry, shipped via seeds, read-only for
  normal users.
- `ownerId = <user>` → entry created by that user, visible and editable only
  by them.

Purely personal entities (`Coffee`, `UserGrinder`, `Brew`, `Favorite`) always
have a non-null `ownerId`. `Tasting`, `BrewStepResult` and `RecipeStep`
inherit ownership from their parent.

---

## 7. Coffee model

A `Coffee` represents a specific coffee/bag owned by the user — not only a
generic bean name.

```
Coffee
  id
  ownerId

  name
  roasterId?
  roasterNameSnapshot

  country
  region
  farm
  producer

  varieties[]
  process
  processingNotes

  altitudeMinMasl
  altitudeMaxMasl

  roastLevel
  roastDate

  purchaseDate
  openedDate

  bagWeightG
  remainingWeightG

  roasterTastingNotes[]
  userTags[]

  description
  notes

  imagePath / image metadata

  createdAt
  updatedAt
  archivedAt
```

Roast levels: `LIGHT`, `MEDIUM_LIGHT`, `MEDIUM`, `MEDIUM_DARK`, `DARK`, `UNKNOWN`.

Processing must not be limited to a hard-coded list. Allow free text in
addition to common values: Washed, Natural, Honey, Anaerobic, Carbonic
Maceration, Experimental, Other.

---

## 8. Roaster

```
Roaster
  id
  ownerId?      // null = global catalogue entry (later), set = user-created
  name
  country
  city
  website
  notes
  createdAt
  updatedAt
  archivedAt
```

In the MVP roasters are user-created (`ownerId` set). A global community
catalogue may be added later using `ownerId = null`. Do not block the MVP on a
public roaster database.

---

## 9. Grinder architecture

Separate the generic grinder model from the user's physical grinder.

### GrinderModel

The catalogue entry, e.g. Comandante C40 MK4, 1Zpresso K-Ultra, Fellow Ode
Gen 2, DF64 Gen 2, Niche Zero.

```
GrinderModel
  id
  ownerId?      // null = bundled, set = user-added custom model
  manufacturer
  model
  slug

  type
  burrType
  burrDiameterMm

  adjustmentType
  settingUnit

  minSetting
  maxSetting

  notes

  createdAt
  updatedAt
```

Types: `HAND`, `ELECTRIC`, `BUILT_IN`.

Adjustment types: `CLICK`, `NUMBER`, `STEPLESS`, `MICRON`, `CUSTOM`.

Users must be able to add a custom grinder model when theirs is not in the
bundled catalogue.

---

## 10. UserGrinder

The user's actual grinder.

```
UserGrinder
  id
  ownerId
  grinderModelId

  nickname

  burrDescription
  burrInstallDate

  zeroPoint
  calibrationNotes

  defaultForFilter
  defaultForEspresso

  createdAt
  updatedAt
  archivedAt
```

Why the separation matters: two users may both own a Comandante C40, but their
zero point and preferred settings may differ. A recipe must never assume that
"24 clicks" universally means the same grind.

---

## 11. Grind setting representation

Grind settings use one consistent field set everywhere they are stored
(`Brew`, `RecipeGrinderPreset`):

```
grindSettingText      // human-readable, always stored: "24 clicks", "1.3 rotations + 4 clicks"
grindSettingNumeric?  // optional numeric value: 24, 5.2, 650
grindSettingUnit?     // optional unit: "clicks", "µm", ...
grindSettingNote?
```

Examples: `24 clicks`, `5.2`, `650 µm`, `1.3 rotations + 4 clicks`.

Always preserve the human-readable representation, even when a numeric one
exists. The grinder is referenced by the parent record (`userGrinderId`).

---

## 12. Brewer catalogue

BrewCore also needs a Brewer catalogue, e.g. Hario V60 02, AeroPress, Chemex
6 Cup, Kalita Wave 185, Clever Dripper, French Press, Moka Pot, Espresso
Machine, Origami, April Brewer, Orea V4.

```
Brewer
  id
  ownerId?      // null = bundled, set = user-added custom brewer
  manufacturer
  model
  methodType
  capacityMl
  description
  createdAt
  updatedAt
  archivedAt
```

Method types: `POUR_OVER`, `IMMERSION`, `HYBRID`, `AEROPRESS`, `ESPRESSO`,
`MOKA`, `FRENCH_PRESS`, `COLD_BREW`, `CUPPING`, `OTHER`.

---

## 13. Recipe model

Recipes must be structured data. Do **not** store the brewing procedure only as
a Markdown or text field.

```
Recipe
  id
  ownerId?              // null = bundled recipe (see §42)
  bundledKey?           // stable slug for bundled recipes, unique
  forkedFromRecipeId?   // set when duplicated from another recipe

  name
  description

  brewerId?
  methodType

  defaultCoffeeDoseG
  defaultWaterG
  targetYieldG?         // espresso: beverage weight (§88)

  waterTemperatureC

  grindDescription      // generic guidance, see §17
  targetBrewTimeSeconds

  servings

  tags[]

  sourceName?           // provenance, see §43
  sourceUrl?
  authorName?

  createdAt
  updatedAt
  archivedAt
```

- Favorites are stored in `Favorite` (§64), not as a flag on Recipe, so users
  can favorite bundled recipes too.
- **Ratio is derived**, not stored as an independent input:
  `ratio = defaultWaterG / defaultCoffeeDoseG` (e.g. `16` for 1:16). Display
  as `1:16`.

Optional later: `publicationId` (recipe sharing, §44).

---

## 14. RecipeStep

One of the most important data structures in the project. Each recipe consists
of ordered, executable steps.

```
RecipeStep
  id
  recipeId
  position

  type
  title
  instruction

  durationSeconds?          // how long this step lasts (e.g. bloom 45 s)
  targetElapsedSeconds?     // target brew-clock time when the step should end (e.g. 1:15)
  targetElapsedMaxSeconds?  // optional upper bound for ranges (e.g. 2:45–3:15)

  waterTargetG?             // cumulative scale target after this step (canonical)

  temperatureC?

  requiresConfirmation
  autoAdvance

  metadata JSON
```

Step types: `PREPARE`, `TARE`, `ADD_COFFEE`, `BLOOM`, `POUR`, `WAIT`, `STIR`,
`SWIRL`, `PRESS`, `BREAK_CRUST`, `DRAW_DOWN`, `STOP`, `SERVE`, `CUSTOM`.

The step system must be extensible. Do not encode every brewing method into
application code — recipes define the workflow.

---

## 15. Recipe semantics

Water targets are stored **cumulatively** (`waterTargetG`) — this is the
canonical value. The incremental amount is **derived** from the previous
step's cumulative target, so the two can never disagree.

Example V60:

| Step | Instruction      | waterTargetG | Derived add |
| ---- | ---------------- | ------------ | ----------- |
| 1    | Bloom to 60 g    | 60           | +60 g       |
| 2    | Pour to 180 g    | 180          | +120 g      |
| 3    | Pour to 300 g    | 300          | +120 g      |

The UI may display: `Target: 180 g · Add: +120 g`.

---

## 16. Recipe scaling

Recipes scale automatically.

Example recipe: Coffee 20 g, Water 320 g, Ratio 1:16. User selects 25 g
coffee → BrewCore calculates 400 g water.

Step targets scale by the same factor (here ×1.25):

| Original | Scaled |
| -------- | ------ |
| 60 g     | 75 g   |
| 180 g    | 225 g  |
| 320 g    | 400 g  |

- Scaling rules must be deterministic and covered by unit tests (§76).
- Do not mutate the original recipe when starting a scaled brew; scaled values
  live on the Brew and its snapshot.

---

## 17. Grind guidance and grinder presets

Recipes contain generic grind guidance: Fine, Medium-fine, Medium,
Medium-coarse, Coarse.

A user's specific grinder setting belongs on the **Brew** (MVP) and, from v0.2,
optionally in a **RecipeGrinderPreset**:

```
RecipeGrinderPreset          // v0.2
  id
  ownerId
  recipeId
  userGrinderId

  grindSettingText
  grindSettingNumeric?
  grindSettingUnit?
  grindSettingNote?

  createdAt
  updatedAt
```

Example: Recipe "Hoffmann V60", Grinder "Comandante C40", Setting "23 clicks".

This eventually lets BrewCore say:
*"Last successful setting with this recipe + coffee + grinder: 22 clicks"*.

In the MVP, the brew setup screen pre-fills the grind setting from the most
recent Brew with the same recipe + grinder (if any).

---

## 18. Brew model

A Brew represents one actual brewing event. It is the central historical entity.

```
Brew
  id
  ownerId

  recipeId?
  coffeeId?
  userGrinderId?        // optional: built-in grinder, pre-ground coffee
  brewerId?
  parentBrewId?         // set when created via "Brew Again" (§62, §94)

  startedAt?            // set when the timer starts (client timestamp)
  completedAt?

  status

  coffeeDoseG
  waterTargetG
  waterActualG?
  beverageWeightG?      // espresso yield / final beverage weight

  ratio                 // derived at creation: waterTargetG / coffeeDoseG

  waterTemperatureC

  grindSettingText?
  grindSettingNumeric?
  grindSettingUnit?

  targetDurationSeconds
  actualDurationSeconds?

  notes

  // snapshots — see §19
  recipeNameSnapshot
  coffeeNameSnapshot
  roasterSnapshot
  roastDateSnapshot
  grinderSnapshot
  brewerSnapshot
  recipeSnapshot JSON

  createdAt
  updatedAt
```

Statuses: `IN_PROGRESS`, `COMPLETED`, `ABORTED`.

A Brew is only created when the user confirms Start (§56, §62), so there is no
`PLANNED` status.

---

## 19. Brew snapshots

Historical records must remain reproducible even after a recipe changes.

Snapshot fields on Brew: `recipeNameSnapshot`, `coffeeNameSnapshot`,
`roasterSnapshot`, `roastDateSnapshot`, `grinderSnapshot`, `brewerSnapshot`,
`recipeSnapshot` (JSON: the scaled recipe including all steps as used).

- Do not rely exclusively on live foreign-key relations for historical display.
- If the user changes a recipe tomorrow, yesterday's Brew must still describe
  yesterday's recipe.
- `roastDateSnapshot` makes "how old was the coffee?" answerable even if the
  Coffee record is edited later.

---

## 20. Interactive Live Brewing Mode

BrewCore's signature feature.

Routes:

- `/brew/new` — brew setup. Accepts optional query parameters
  `coffeeId`, `recipeId`, `fromBrewId` to pre-fill.
- `/recipes/[id]/brew` — convenience entry; opens the same setup with the
  recipe pre-selected.

Setup flow:

1. select Coffee
2. select Recipe
3. select Grinder (optional)
4. select Brewer if not implied by the recipe
5. adjust dose
6. adjust temperature
7. adjust grind
8. review calculated targets (§90)
9. tap **Start Brew** → Brew is created (§56) and the live screen opens

Then open a distraction-free brewing screen at `/brew/live/[id]`.

---

## 21. Live Brew UI

Prioritize readability from approximately arm's length.

Main display example:

```
03:42

POUR 3 / 4

Pour to
240 g

Target time
02:15        ← from RecipeStep.targetElapsedSeconds

Current
212 g

Next
Wait 30 sec
```

Controls: Pause, Previous, Next, Finish, Cancel.

- Avoid small controls; use large touch targets.
- Prevent accidental navigation away.
- Use the Wake Lock API while brewing if supported (§73).

---

## 22. Brew state machine

Do not implement guided brewing as scattered React timers. Create a proper
state machine / domain controller in `src/lib/brewing/`.

Logical states: `READY`, `RUNNING`, `PAUSED`, `STEP_COMPLETE`, `FINISHED`,
`ABORTED`.

State contains:

```
brewId
currentStepIndex
brewStartedAt
stepStartedAt
elapsedBrewMs
elapsedStepMs
pausedAt
totalPausedMs
currentWeight
manualOverrides
completedSteps
```

The timer must derive elapsed time from timestamps. Do **not** increment an
integer every second — browser throttling/backgrounding would make timing
inaccurate.

```ts
elapsed = Date.now() - startedAt - totalPausedMs
```

The live screen opens in `READY`; the server Brew already exists with status
`IN_PROGRESS`. `Brew.startedAt` is set from the moment the timer starts.

---

## 23. Live Brew persistence

A brewing session must survive:

- page refresh
- temporary connectivity loss
- PWA backgrounding
- accidental browser restart where feasible

Persist active-brew state locally in **IndexedDB** as a local active-brew
snapshot. On reconnect/load, offer *"Resume Brew?"*.

The server remains the authoritative long-term store. The live session must
remain usable locally if the server connection briefly disappears.

If the local state is lost but the server still has an `IN_PROGRESS` Brew,
the home screen's "Continue active brew" offers to resume from the server
snapshot or to abort it.

---

## 24. PWA architecture

NutriCore has a Web App Manifest and standalone PWA presentation. BrewCore goes
further with an actual offline strategy for the brewing interface.

At minimum cache: app shell, active recipe, selected coffee, selected grinder,
active brew state, required icons/assets.

The user must not lose an active brew because Wi-Fi momentarily drops.

Do not attempt full offline synchronization for every screen in the MVP.
Priority: **the active brew works offline.**

---

## 25. Live brewing events

Record actual execution of recipe steps.

```
BrewStepResult
  id                    // client-generated (UUID) so retries are idempotent
  brewId
  recipeStepId?

  position
  type

  startedAt
  completedAt

  targetWeightG
  actualWeightG

  targetDurationSeconds
  actualDurationSeconds

  skipped
  notes
```

This will later enable useful analytics.

---

## 26. Manual mode

Live brewing must work without any smart scale:

- timer runs automatically
- step changes can be automatic or manual
- weight target is displayed
- user taps Next when appropriate

This must be excellent before Bluetooth support is implemented. Bluetooth is an
enhancement, not a prerequisite.

---

## 27. Smart scale architecture

Design the domain now, implement later.

```ts
interface ScaleAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  tare(): Promise<void>;
  getWeight(): number | null;
  subscribe(callback: (weightG: number) => void): () => void;
}
```

- Scale-specific protocols live behind adapters.
- Never put Acaia/Felicita/etc. BLE logic into the Brew UI.

Suggested layout:

```
src/lib/scales/
  types.ts
  manager.ts
  adapters/
```

Possible later adapters: Acaia, Bookoo, DiFluid, Felicita, Timemore,
generic/custom.

Web Bluetooth availability varies by browser/platform, so BrewCore must remain
fully functional without BLE.

---

## 28. Scale samples

Later, optionally store high-frequency samples:

```
ScaleSample
  brewId
  timestampMs
  weightG
  flowRateGps
```

Do **not** write every scale measurement directly to PostgreSQL. During live
brewing: collect client-side → downsample → persist meaningful samples/batches.

---

## 29. Brew graph

Later show: X axis = time, Y axis = weight, secondary series = flow rate.
Overlay recipe targets. Useful comparison: planned pour vs. actual pour.

---

## 30. Tasting model

After finishing a brew, immediately offer *"How was it?"*. Keep the first
interaction quick:

- overall rating 1–5
- would brew again
- quick tags (§31)

Then optional detail.

```
Tasting
  id
  brewId            // unique — one tasting per brew
  rating

  wouldBrewAgain?
  tags[]            // quick descriptive tags, §31

  acidity?
  sweetness?
  bitterness?
  body?
  clarity?
  aftertaste?

  notes

  createdAt
  updatedAt
```

Attribute values are initially integer scales 1–5.

---

## 31. Quick taste feedback

Quick descriptive tags: Sour, Bitter, Sweet, Balanced, Weak, Strong, Dry,
Astringent, Hollow, Juicy, Clean, Muddy.

Store tags as stable keys (e.g. `SOUR`) and translate them in the UI.

Do not require SCA-level cupping forms for ordinary brewing. Advanced tasting
can be added later.

---

## 32. Dial-in workflow

BrewCore should eventually help answer *"What should I change next?"*.

Start rule-based, not AI-based. Example rules:

| Observation         | Suggestion                         |
| ------------------- | ---------------------------------- |
| Sour + fast brew    | grind finer                        |
| Bitter + slow brew  | grind coarser                      |
| Weak                | increase dose or reduce water      |
| Strong              | decrease dose or increase water    |

Always present this as a suggestion, not a factual diagnosis.

"What the user changed between brews" is derived by diffing a Brew against its
`parentBrewId` (and snapshots) — see §94.

---

## 33. Brew comparison

Users can compare two brews. Show differences for: coffee, recipe, dose,
water, ratio, temperature, grinder, grind setting, brew time, rating, tasting
attributes. Highlight changed variables.

```
            Brew A     Brew B
Grind       22 clicks  21 clicks
Time        2:48       3:06
Rating      4/5        5/5
```

This is a key BrewCore differentiator.

---

## 34. Coffee detail screen

Route: `/coffees/[id]`

Show: coffee metadata, roaster, origin, processing, roast date, days since
roast, bag amount remaining, favorite recipe, last grinder setting, average
rating, number of brews, best-rated brews, recent brews.

Primary CTA: **Brew this coffee** (→ `/brew/new?coffeeId=…`).

---

## 35. Grinder detail screen

Route: `/grinders/[id]`

Show: model, nickname, calibration, recent settings, brews, coffee/recipe
combinations, best-rated settings.

---

## 36. Recipe detail screen

Route: `/recipes/[id]`

Show: recipe metadata, brew parameters, ordered steps, estimated brew
duration, compatible brewer, grind guidance, personal grinder presets (v0.2),
recent brews, average rating.

Primary CTA: **Start Brew**.

Secondary actions: Edit (own recipes only), Duplicate, Favorite, Share (later).
Editing a bundled recipe first creates a user copy (§42).

---

## 37. Home screen

Home answers: *"What do I want to brew now?"* Do not make analytics the main
home screen.

Sections: Quick Brew, Continue active brew, Recent coffees, Favorite recipes,
Recent brews.

Primary floating or prominent action: **Start Brew**.

---

## 38. Navigation

Suggested mobile navigation: Home · Coffee · **Brew** · Recipes · More

Alternative: Today · Coffee · Recipes · History

The central action should always make starting a Brew easy — e.g. a persistent
center **Brew** button.

---

## 39. Search

Fast search across: Coffee, Roasters, Recipes, Grinder models, Brewers, Brews.

For the MVP, server-side PostgreSQL search is sufficient. Do not introduce
Elasticsearch or another search service.

---

## 40. Coffee inventory

Track an optional remaining amount (`Coffee.remainingWeightG`).

- MVP: remaining amount is edited manually.
- v0.2: each completed brew can subtract its dose automatically (e.g. 250 g
  bag, 18 g per brew). The user must be able to disable or correct this.

Never make brew completion fail because inventory data is missing.

Useful indicators: `132 g remaining`, `~7 brews remaining`.

---

## 41. Coffee freshness

Calculate **days since roast**. Do not present a universal claim that coffee
is good/bad based on age — simply expose the factual age. Later allow
user-defined preferred rest windows.

---

## 42. Recipe library

Ship BrewCore with a small, high-quality bundled recipe catalogue covering:
V60, AeroPress, French Press, Chemex, Kalita Wave, Clever Dripper, Espresso,
Moka Pot.

Bundled vs. user recipes:

- Bundled recipes have `ownerId = null` and a unique `bundledKey`.
- Seeds upsert bundled recipes **by `bundledKey` and only where
  `ownerId = null`**. App updates may change bundled recipes, but never touch
  user recipes.
- Users cannot edit bundled recipes directly. Duplicate/Edit creates a user
  copy (`ownerId = user`, `forkedFromRecipeId = <bundled id>`,
  `bundledKey = null`) that is independently editable.

Users must be able to duplicate, modify (own copies), favorite and archive
(own copies) recipes.

---

## 43. Recipe provenance

Fields: `sourceName`, `sourceUrl`, `authorName` (on Recipe, §13).

A recipe inspired by another source must preserve attribution. Do not silently
label third-party recipes as BrewCore recipes. Duplicates keep the provenance
fields of the original.

---

## 44. Recipe sharing

Not MVP-critical. The architecture should later support: public read-only
recipe URL, QR code, import recipe, fork recipe.

A copied recipe becomes independently editable and preserves attribution.

---

## 45. Database ownership

Private user records must have explicit ownership, following NutriCore
patterns: `Coffee.ownerId`, `UserGrinder.ownerId`, `Recipe.ownerId`,
`Brew.ownerId`, `Favorite.ownerId`, `Roaster.ownerId`.

Rules:

- Every server-side read/update/delete must enforce ownership.
- Catalogue rows with `ownerId = null` are readable by every signed-in user
  and writable only by seeds/admin.
- Child records (`RecipeStep`, `BrewStepResult`, `Tasting`) are checked via
  their parent's owner.
- References must be checked too: a Brew may only reference the user's own
  coffee/grinder and recipes that are either theirs or bundled.
- Never rely on the UI to prevent cross-user access.

---

## 46. Authentication

Reuse NutriCore's security model:

- Argon2id password hashes
- random opaque session tokens
- SHA-256 session token storage
- HttpOnly cookies, `SameSite=Lax`, `Secure` when HTTPS
- 30-day session expiry
- same-origin checks
- admin/user roles if required

Rename all NutriCore cookie names/constants (§3).

---

## 47. Registration

Keep BrewCore self-hosting friendly. Modes: `bootstrap`, `invite`, `open`,
`disabled`.

The default is conservative (`bootstrap`: only the first user can register and
becomes admin). A new private installation should be easy to bootstrap.

**Decision (v0.1):** BrewCore keeps NutriCore's three modes — `bootstrap`,
`open`, `disabled` — and accepts `invite` as an alias for `bootstrap`.
`bootstrap` already becomes invitation-only once the first account exists, and
a mode that closed registration before any administrator existed would lock the
operator out. Administrators create single-use invitation links (hashed,
expiring) and copy them by hand; there is no SMTP mailer in v0.1.

**Decision:** each newly created invitation link is also shown once as a QR
code (PNG, dark on white, downloadable) so it can be scanned from the admin's
screen or sent as an image. The code encodes the same single-use link and is
rendered on the server with the `qrcode` package; the link never goes to a
third-party QR service. A QR code for the bare base URL is not offered: in
`bootstrap` mode that URL leads to a closed sign-up page, and in `open` mode
anyone can already register there.

---

## 48. Internationalization

Start with English and German, using NutriCore's `next-intl` architecture.

Translations: `messages/en.json`, `messages/de.json`.

- Do not hard-code UI strings in components.
- Coffee names, roasters and user content are not translated automatically.
- Enum values (step types, roast levels, taste tags) are stored as keys and
  translated in the UI.

---

## 49. Units

Canonical internal units:

| Quantity    | Unit                  |
| ----------- | --------------------- |
| mass        | grams                 |
| water       | grams                 |
| temperature | Celsius               |
| time        | milliseconds/seconds  |

Do not store locale-formatted numeric strings; formatting belongs in the UI.

Potential later display preferences: °C/°F, g/oz, ml where relevant. For
specialty coffee, grams are the primary water representation.

---

## 50. Data precision

Use sensible decimal database types:

| Field       | Type           |
| ----------- | -------------- |
| dose        | `Decimal(8,2)` |
| water       | `Decimal(8,2)` |
| temperature | `Decimal(5,2)` |
| ratio       | `Decimal(8,4)` |

Do not use floating point for persisted quantities where precision matters.
Convert Prisma `Decimal` explicitly when passing values to client components.

---

## 51. Server architecture

Follow NutriCore's layering:

| Directory        | Responsibility                               |
| ---------------- | -------------------------------------------- |
| `src/app`        | routing and page composition                 |
| `src/components` | reusable UI                                  |
| `src/server`     | business operations and persistence          |
| `src/lib`        | pure domain logic and reusable utilities     |

Avoid Prisma calls directly in React components.

---

## 52. Suggested server modules

```
src/server/auth-actions.ts
src/server/session.ts

src/server/coffees.ts
src/server/coffee-actions.ts

src/server/roasters.ts
src/server/roaster-actions.ts

src/server/grinders.ts
src/server/grinder-actions.ts

src/server/brewers.ts
src/server/brewer-actions.ts

src/server/recipes.ts
src/server/recipe-actions.ts

src/server/brews.ts
src/server/brew-actions.ts

src/server/tastings.ts
src/server/tasting-actions.ts

src/server/favorites.ts
src/server/favorite-actions.ts

src/server/export.ts
```

---

## 53. Suggested domain library

```
src/lib/brewing/
  ratio.ts
  scaling.ts
  timer.ts
  state-machine.ts
  recipe.ts
  tasting.ts
  dial-in.ts
```

Functions in these files should be pure and unit-tested.

---

## 54. Routes

```
/

/login
/register
/onboarding

/coffees
/coffees/new
/coffees/[id]
/coffees/[id]/edit

/roasters
/roasters/[id]

/grinders
/grinders/new
/grinders/[id]

/brewers
/brewers/[id]

/recipes
/recipes/new
/recipes/[id]
/recipes/[id]/edit
/recipes/[id]/brew      → opens /brew/new with the recipe pre-selected

/brew/new               ?coffeeId= &recipeId= &fromBrewId=
/brew/live/[id]

/brews
/brews/[id]
/brews/[id]/taste

/settings

/admin
```

---

## 55. API routes

Do not build an unnecessary REST API for internal operations. Prefer Next
Server Actions for ordinary mutations, matching NutriCore. Use route handlers
where an endpoint makes technical sense:

- `GET /api/health`
- `GET /api/export/json` (MVP, §68)
- later: `/api/import`, `/api/device/...`

---

## 56. Brew creation sequence

Starting a Brew creates a server-side Brew record before entering live mode.
This step requires connectivity; everything after it must survive going
offline (§95).

```
select configuration
↓
validate (Zod + ownership of referenced records)
↓
create Brew(status = IN_PROGRESS) + snapshots   (one transaction)
↓
initialize local live session (IndexedDB)
↓
navigate to /brew/live/[id]
```

If local state is lost, the application can reconstruct most of the Brew from
the server snapshot.

---

## 57. Completing a Brew

```
Finish
↓
capture actual duration
↓
capture actual water / beverage weight if available
↓
write completion payload to local outbox (IndexedDB)
↓
send to server: persist step results + Brew.status = COMPLETED   (one transaction)
↓
(v0.2) optionally decrement coffee inventory
↓
open tasting dialog
```

Offline-safe completion:

- If the server is unreachable, the completion stays in the local outbox and
  is retried on reconnect / next app load. The user can still see the
  post-brew screen and enter a tasting, which is queued the same way.
- The completion action must be **idempotent**: keyed by `brewId`, with
  client-generated `BrewStepResult` IDs. Re-sending the same completion for an
  already completed Brew is a no-op, never a duplicate.
- Timestamps (`startedAt`, `completedAt`, step times) come from the client's
  recorded values, not from the time the request reaches the server.

The tasting form may be skipped. A Brew does not require tasting data to be
valid.

---

## 58. Abort handling

If the user cancels: `Brew.status = ABORTED`. Do not delete it automatically.
Deleting an aborted brew is an explicit user action. Aborted data can later
help diagnose workflows.

---

## 59. Recipe versioning strategy

Do not initially implement a version table. Use Brew snapshots: the Recipe
remains editable, and each Brew stores the recipe configuration used during
that session. Add formal version history later only if it becomes useful.

---

## 60. Analytics MVP

Useful metrics: number of brews, brews per week/month, average rating,
most-used coffee/recipe/grinder, average brew time.

More interesting: rating by grind setting, rating by recipe, rating by coffee,
rating vs. brew time.

Do not build a large dashboard before the core Brew flow is polished.

---

## 61. Dial-in history

For a coffee + recipe + grinder combination show:

| Brew | Grind     | Time | Rating | Tag      |
| ---- | --------- | ---- | ------ | -------- |
| 1    | 24 clicks | 2:31 | 3/5    | Sour     |
| 2    | 23 clicks | 2:48 | 4/5    | Balanced |
| 3    | 22 clicks | 3:04 | 5/5    | Sweet    |

One of BrewCore's most useful differentiators.

---

## 62. "Brew Again"

Every completed Brew has a **Brew Again** action that opens
`/brew/new?fromBrewId=<id>` pre-loaded with: coffee, recipe, grinder, dose,
water, temperature, grind.

- The user can change any parameter before starting.
- Do **not** create a new Brew until Start is confirmed.
- The new Brew stores `parentBrewId = <id>`.

---

## 63. "Use last successful settings"

On Coffee and Recipe screens, later provide *Use last settings* / *Best recent
settings*.

Define "best" transparently; do not invent opaque AI scoring. MVP rule:
most recent brew rated ≥ 4, or a brew the user has marked as favorite
(*Favorite result*, §64).

---

## 64. Favorites

Favorites for Coffee, Recipe and Brew, stored in one entity:

```
Favorite
  id
  ownerId
  coffeeId?
  recipeId?
  brewId?
  createdAt
```

- Exactly one of `coffeeId` / `recipeId` / `brewId` is set (enforce with a
  check constraint or validation).
- Unique per owner + target.
- Users can favorite bundled recipes.

A favorite Brew is particularly useful because it represents a known
successful configuration.

MVP: favorite coffees and recipes (home screen, §37). v0.2: favorite Brew.

---

## 65. Images

Coffee bags support an optional photo. Use NutriCore's image safety/size
patterns where applicable. Store metadata responsibly. Do not require images.
Future OCR must use a separate, explicit workflow.

**Decision (v0.1):** the photo is part of v0.1. Like NutriCore's meal images it
is stored in PostgreSQL (`Coffee.imageData`, `imageMime`, `imageUpdatedAt`
instead of an `imagePath`), so backups include it and no upload volume is
needed. The type is decided from the bytes (JPEG/PNG/WebP), the size limit is
`IMAGE_UPLOAD_MAX_MB` (default 5), oversized photos are shrunk in the browser
first, and the image is served only to its owner.

---

## 66. Coffee bag scanner (later)

```
Take photo of coffee bag
↓
extract text
↓
propose: roaster, coffee, origin, variety, process, altitude, roast date, tasting notes
↓
user reviews
↓
save
```

Never write AI/OCR extraction directly to trusted Coffee fields without user
confirmation (the NutriCore pattern of human confirmation for generated or
imported information).

---

## 67. AI scope

AI is not required for the MVP. Do not make brewing dependent on an LLM.

Potential future AI: bag metadata extraction, natural-language recipe import,
brew comparison explanation, dial-in suggestions. Every AI recommendation must
remain optional.

---

## 68. Import/export

Privacy-first/self-hosted applications need export.

MVP: JSON export (`GET /api/export/json`) of the signed-in user's data:
coffees, roasters, grinders, brewers (user-created), recipes (user-owned),
brews (including snapshots and step results), tastings, favorites.

Include a format `version` field in the export so later imports can migrate
older files.

Later: CSV brew history, import. Imports must validate schema and ownership.

---

## 69. PWA manifest

```
name: BrewCore
short_name: BrewCore
display: standalone
orientation: portrait
categories: food, lifestyle, utilities
```

Add BrewCore-specific icons. Do not reuse NutriCore branding assets.

---

## 70. Theme

Support light, dark and system. Keep NutriCore's theme architecture but design
BrewCore independently. Avoid turning everything brown just because it is
coffee software. Prioritize contrast and usability.

---

## 71. Accessibility

Guided brewing is especially sensitive to accessibility. Requirements:

- large text
- high contrast
- large targets
- keyboard navigation
- screen reader labels
- no color-only state indication
- reduced-motion support

Optional later: spoken step prompts, vibration/haptics where available.

Live Brew instructions must remain understandable without relying on
animations.

---

## 72. Notifications and cues

During a live brew: step transition sound, optional vibration, visual state
change. All cues must be configurable. Do not rely on sound alone.

---

## 73. Wake Lock

Use the Screen Wake Lock API when available during an active brew:

| Event                 | Action                     |
| --------------------- | -------------------------- |
| Start Brew            | request wake lock          |
| Pause / background    | handle release             |
| Resume foreground     | reacquire if allowed       |
| Finish / abort        | release                    |

Failure to acquire a wake lock must not break brewing.

---

## 74. Browser lifecycle

Handle `visibilitychange`, `pagehide`, reload and PWA backgrounding.

Persist live state whenever meaningful state changes occur. Do not depend on
unload handlers to save critical data.

---

## 75. Timer tests

Unit test at least: normal running, pause, resume, multiple pauses, page
restore, step transitions, auto advance, manual advance, late browser tick,
clock calculation. Use fake timers where appropriate.

---

## 76. Recipe scaling tests

Test: 20 g → 320 g, 25 g → 400 g, step target scaling, rounding, ratio
preservation, custom water override.

Rounding rules (define in `scaling.ts` and test them):

- internal precision: 0.1 g
- recipe water targets displayed rounded to 1 g by default
- the final step target equals the scaled total water exactly (no rounding
  drift across steps)

---

## 77. Security

Port the relevant NutriCore protections. Retain/verify: secure cookies,
same-origin mutation checks, security headers, environment validation, rate
limiting for auth, ownership checking, safe URL handling, upload limits,
redacted logs, no secrets in Docker images.

Run the application as a non-root Docker user.

---

## 78. Environment variables

Start with a small `.env.example`:

```
POSTGRES_DB=brewcore
POSTGRES_USER=brewcore
POSTGRES_PASSWORD=

# Used by app and migrate. In Compose it can be composed from the POSTGRES_* values.
DATABASE_URL=postgresql://brewcore:${POSTGRES_PASSWORD}@db:5432/brewcore

POSTGRES_DATA_PATH=./data/postgres
BACKUP_PATH=./backups

APP_PORT=3000
APP_URL=http://localhost:3000

REGISTRATION_MODE=bootstrap
```

Only add `APP_SECRET` (or similar) if the ported NutriCore code actually uses
one — sessions are opaque random tokens and do not need a signing secret by
themselves.
**Decision:** NutriCore only used `APP_SECRET` to encrypt its SMTP password.
BrewCore has no SMTP, so there is no `APP_SECRET`. Additional variables that
are used: `DEFAULT_LOCALE` (default `de`), `INVITATION_EXPIRY_HOURS`,
`IMAGE_UPLOAD_MAX_MB`, `TRUSTED_PROXY_HOPS`, `ALLOW_INSECURE_APP_URL`,
`LOG_LEVEL`, `APP_IMAGE`/`MIGRATE_IMAGE`. Do not copy NutriCore's nutrition/AI environment variables unless
used.

---

## 79. CI

Retain the NutriCore CI philosophy. Every PR runs:

- `npm ci`
- `prisma generate`
- `prisma migrate deploy` against real PostgreSQL
- schema/migration drift check (schema matches migrations)
- lint
- typecheck
- unit tests
- build
- Playwright E2E
- Docker image build
- migration image build

Test against real PostgreSQL in CI.

---

## 80. Container publishing

Publish from GitHub Actions to `ghcr.io/macnite/brewcore` and
`ghcr.io/macnite/brewcore-migrate`.

Preserve: semver tags, `main` tag, SHA tag, `latest`, SBOM, provenance, amd64
and arm64 releases.

---

## 81. Backups

Retain a configurable backup mount for PostgreSQL. Document `pg_dump` and
`pg_restore`. Do not invent an internal backup scheduler in the MVP.

---

## 82. Development seed data

Two kinds of seeds:

- **Bundled catalogue** (runs in production too, idempotent upsert, `ownerId =
  null`): grinder models, brewers, bundled recipes.
- **Development/demo data** (dev only, clearly marked as example data):
  a demo user with coffees.

Content:

- Coffees (dev only): Ethiopia Guji Natural, Kenya Nyeri Washed, Brazil
  Fazenda Natural
- Grinder models: Comandante C40 MK4, Fellow Ode Gen 2, 1Zpresso K-Ultra,
  Niche Zero, DF64 Gen 2
- Brewers: Hario V60 02, AeroPress, Chemex, Kalita Wave 185, French Press,
  Espresso
- Recipes: Basic V60, Two-Pour V60, AeroPress Standard, French Press,
  Espresso 1:2

---

## 83. MVP definition (v0.1)

Version 0.1 must include:

- Authentication + registration modes
- English/German
- Coffee CRUD
- Roaster CRUD
- Grinder catalogue
- Personal grinder CRUD
- Brewer catalogue
- Recipe CRUD
- Structured RecipeSteps
- Recipe scaling
- Start Brew
- Interactive Live Brewing Mode
- Pause/resume
- Manual step progression
- Automatic timed step progression
- Offline-resilient active brew
- Brew history
- Tasting/rating
- Brew Again
- Favorite coffees/recipes
- PWA installability
- Docker deployment
- PostgreSQL
- CI
- JSON export

---

## 84. Explicitly excluded from 0.1

Do not delay the MVP for: Bluetooth scales, OCR, AI, social network, community
recipes, roaster accounts, Shopify integration, Apple Watch, Wear OS, native
mobile application, advanced cupping, machine telemetry, complex
recommendations.

Architect for them where reasonable, but do not implement them prematurely.

---

## 85. Version 0.2

Focus: dial-in and insight.

- brew comparison
- automatic coffee inventory deduction
- favorite Brew
- last successful settings
- grinder-specific recipe presets (`RecipeGrinderPreset`)
- basic charts
- dial-in history
- rule-based brew suggestions
- CSV export
- recipe sharing/import

---

## 86. Version 0.3

Focus: hardware.

- Web Bluetooth abstraction
- first supported smart scale
- live weight
- auto tare if the device supports it
- target-weight indicator
- flow-rate calculation
- brew graph
- scale sample persistence/downsampling

Do not support ten scale brands at once. Build one adapter well and prove the
architecture first.

---

## 87. Version 0.4+

Possible: additional BLE scales, coffee bag OCR, recipe import from URL/text,
AI-assisted metadata, community recipe catalogue, roaster profiles, QR recipe
sharing, advanced espresso workflow, cupping workflow, brew statistics, native
companion applications.

---

## 88. Espresso support

Do not force espresso to behave exactly like pour-over.

An espresso Recipe supports: dose in (`defaultCoffeeDoseG`), target yield
(`targetYieldG`), target ratio (derived: yield / dose), target time,
temperature, grind, preinfusion and pressure note (in step `metadata` or
recipe description).

Brew result: actual dose, actual yield (`beverageWeightG`), actual time, actual
ratio, taste.

The RecipeStep engine can still represent espresso phases, but the main
espresso UI may eventually use a specialized presentation. The MVP may
implement simple espresso shot tracking without machine integration.

---

## 89. Recipe step example (V60)

Recipe: 20 g coffee, 320 g water, 94 °C.

| # | Type         | Instruction                         | waterTargetG | Timing                          |
| - | ------------ | ----------------------------------- | ------------ | ------------------------------- |
| 1 | `PREPARE`    | Rinse filter and preheat brewer     |              |                                 |
| 2 | `ADD_COFFEE` | Add 20 g coffee                     |              |                                 |
| 3 | `TARE`       | Tare scale                          |              |                                 |
| 4 | `BLOOM`      | Pour to 60 g                        | 60           | duration 45 s                   |
| 5 | `POUR`       | Pour to 200 g                       | 200          | target elapsed 1:15             |
| 6 | `POUR`       | Pour to 320 g                       | 320          | target elapsed 1:45             |
| 7 | `DRAW_DOWN`  | Wait until drawdown completes       |              | target elapsed 2:45–3:15        |
| 8 | `SERVE`      | Swirl and serve                     |              |                                 |

---

## 90. Brew-start review screen

Before the timer starts, show one compact review screen:

```
Coffee       Ethiopia Guji
Recipe       V60 Two Pour
Coffee       20.0 g
Water        320 g
Ratio        1:16
Temperature  94 °C
Grinder      Comandante C40
Setting      23 clicks

[ START BREW ]
```

---

## 91. Post-brew screen

Immediately after completion:

```
Brew complete
2:52

20.0 g → 320 g
94 °C
23 clicks

How was it?
★ ★ ★ ★ ★
```

Quick tags and optional notes. Buttons: Save, Brew Again, Details.

---

## 92. Product principle: progressive complexity

A beginner should be able to: choose coffee → choose recipe → press Start →
follow instructions → rate the result.

An advanced user can optionally access: exact grinder settings, flow data,
temperature, step timing, comparison, charts, advanced tasting.

Do not expose every field on every screen by default.

---

## 93. Product principle: reproducibility

For every completed Brew, BrewCore should eventually answer:

- Which coffee? How old was it?
- Which recipe?
- How much coffee? How much water?
- Which grinder? Which setting?
- Which brewer? What temperature?
- How long? What steps?
- What actually happened?
- How did it taste?

This guides the database design.

---

## 94. Product principle: change one variable

BrewCore encourages controlled iteration. *Brew Again* keeps everything
constant unless the user explicitly changes something.

Changes are recorded implicitly: the new Brew references its `parentBrewId`,
and the difference is computed from the two Brews' values and snapshots.

Later display:

```
Changed since previous brew:
Grind 24 → 23 clicks
```

This makes dial-in history understandable.

---

## 95. Product principle: local resilience

The most critical user moment is the active Brew.

- Authentication, catalogue browsing, analytics and **starting** a Brew may
  require the server.
- **But** an already-started Brew must survive temporary network loss, and
  its completion must be delivered once the connection returns (§57).

Treat this as an architectural requirement.

---

## 96. Development methodology

Moved to [`CLAUDE.md`](../CLAUDE.md) → *Per-phase workflow*.

---

## 97. Phase 0 — Bootstrap (v0.1)

Tasks:

- copy infrastructure patterns
- rename branding
- remove NutriCore domain code
- configure BrewCore package
- configure env validation
- configure Docker
- configure PostgreSQL
- configure Prisma
- configure CI
- configure GHCR publishing
- create health route
- verify login/session skeleton and registration modes
- fill in the *Commands* section of `CLAUDE.md`

Acceptance:

- `docker compose up` works
- database migrates
- app starts
- health endpoint succeeds
- login works
- CI passes

---

## 98. Phase 1 — Core catalogues (v0.1)

Implement: Roaster, Coffee, GrinderModel, UserGrinder, Brewer, bundled
catalogue seeds.

Acceptance:

- user can add/edit/archive coffee
- user can manage roasters and personal grinders
- bundled grinder models searchable; custom models can be added
- bundled brewers searchable; custom brewers can be added
- ownership enforced
- DE/EN complete
- E2E coverage

---

## 99. Phase 2 — Recipes (v0.1)

Implement: Recipe, RecipeStep, recipe editor, recipe detail, recipe scaling,
bundled recipes, recipe favorites.

Build a step editor that supports reordering.

Acceptance:

- recipe can be created
- steps can be reordered
- recipe can be duplicated (bundled → user copy with provenance)
- dose scaling works
- water targets scale
- tests pass

---

## 100. Phase 3 — Brewing engine (v0.1)

Before building the final Live Brew UI, implement pure state-machine logic:
start, tick calculation, pause, resume, next, previous, skip, auto advance,
finish, abort, restore.

Add extensive tests. No database code inside the state machine.

---

## 101. Phase 4 — Live Brew UI (v0.1)

Implement: brew setup screen (`/brew/new`), review screen, Brew creation with
snapshots, live screen, large timer, current instruction, current target, next
step preview, pause, resume, manual next, automatic next, finish, abort
confirmation, wake lock, local persistence (IndexedDB).

This phase deserves disproportionate UX attention — it is the main BrewCore
experience.

---

## 102. Phase 5 — Brew history, tasting and export (v0.1)

Implement: Brew history, Brew details, tasting, rating, tags, notes, Brew
Again, JSON export.

Acceptance — a user can complete this loop without friction:

```
open BrewCore
→ select coffee
→ select recipe
→ brew
→ rate
→ brew again tomorrow
```

…and can download their data as JSON.

---

## 103. Phase 6 — PWA resilience (v0.1)

Implement/test: service worker, application shell cache, active recipe cache,
IndexedDB active brew state, completion outbox, reload recovery, offline active
brew, reconnection and idempotent completion sync.

Create Playwright coverage where practical (e.g. offline emulation).

Manual acceptance test:

```
start Brew
→ disable network
→ continue Brew
→ finish locally
→ restore network
→ final Brew is persisted exactly once
```

Completing Phase 6 completes v0.1.

---

## 104. Phase 7 — Insights (v0.2)

Implement: comparison, favorite Brew, last settings, grinder presets, coffee
history, grinder history, dial-in history, basic statistics, automatic
inventory deduction.

Do not build generic dashboards for their own sake. Every chart should answer a
brewing question.

---

## 105. Test strategy

Unit tests: recipe scaling, ratio calculation, timers, state machine, dial-in
rules, ownership helpers, validation, formatting.

Integration tests: Prisma persistence, Brew snapshots, recipe duplication,
Brew completion (including idempotent re-send), inventory deduction (v0.2).

E2E: login, create coffee, create grinder, create recipe, start brew, advance
steps, finish brew, rate brew, brew again.

---

## 106. Definition of done

See [`CLAUDE.md`](../CLAUDE.md) → *Definition of done*.

---

## 107. Coding rules

See [`CLAUDE.md`](../CLAUDE.md) → *Coding rules*.

---

## 108. Architectural decision: modular monolith

```
Browser / PWA
     │
     ▼
Next.js BrewCore
 ├── React UI
 ├── Server Actions
 ├── Route Handlers
 ├── Domain Logic
 └── Prisma
     │
     ▼
PostgreSQL
```

Optional later: worker, BLE devices on the client, external AI/OCR.

Do not start with microservices.

---

## 109. Prisma relationship overview

```
User
 ├── Coffee[]
 ├── Roaster[]
 ├── UserGrinder[]
 ├── Recipe[]
 ├── Brew[]
 └── Favorite[]

Roaster
 └── Coffee[]

GrinderModel
 └── UserGrinder[]

Brewer
 ├── Recipe[]
 └── Brew[]

Recipe
 ├── RecipeStep[]
 ├── RecipeGrinderPreset[]   (v0.2)
 ├── Recipe[]                (forks via forkedFromRecipeId)
 └── Brew[]

Coffee
 └── Brew[]

UserGrinder
 ├── RecipeGrinderPreset[]   (v0.2)
 └── Brew[]

Brew
 ├── BrewStepResult[]
 ├── Brew[]                  (children via parentBrewId)
 └── Tasting?
```

Use explicit `onDelete` behavior:

- `Brew → Coffee/Recipe/UserGrinder/Brewer`: `SetNull` or `Restrict` — never
  `Cascade`. Brews keep their snapshots.
- `RecipeStep → Recipe`, `BrewStepResult → Brew`, `Tasting → Brew`: `Cascade`.
- `Brew → parentBrewId`, `Recipe → forkedFromRecipeId`: `SetNull`.

Deleting catalogue entities should generally archive rather than destroy
history.

---

## 110. Soft deletion

Prefer archiving (`archivedAt DateTime?`) for: Coffee, Roaster, UserGrinder,
Brewer (user-created), Recipe.

Historical Brews must continue to display archived entities.

---

## 111. First implementation milestone

> A fresh BrewCore installation can create a user, add one coffee and one
> grinder, select a bundled V60 recipe, complete an interactive guided brew,
> rate it, then repeat that brew from history.

Until that works smoothly, avoid implementing peripheral features.

---

## 112. North-star UX

```
Home
↓
Brew
↓
Coffee + Recipe
↓
Start
↓
Guided Brew
↓
★★★★★
↓
Done
```

Everything else supports this loop.

---

## 113. Initial task

Moved to [`CLAUDE.md`](../CLAUDE.md) → *Initial task*.

---

## 114. Priority order

Moved to [`CLAUDE.md`](../CLAUDE.md) → *Priority order*.

---

## 115. Decision log

Decisions taken while implementing v0.1 (Phases 0–6), with the section they
refine. User decisions were asked for explicitly; the rest follow from the
spec, NutriCore, or the priority order.

| # | Decision | Refines |
| - | -------- | ------- |
| 1 | **User decision:** v0.1 (Phases 0–6) is delivered in one PR instead of one PR per phase. | CLAUDE.md workflow |
| 2 | **User decision:** licensed under AGPL-3.0-only. | — |
| 3 | **User decision:** registration keeps NutriCore's three modes; `invite` is an alias for `bootstrap`. | §47 |
| 4 | **User decision:** invitations are copy-link only; no SMTP, no `APP_SECRET`. | §47, §78 |
| 5 | **User decision:** the coffee bag photo is in v0.1, stored in PostgreSQL. | §7, §65 |
| 6 | **User decision:** `DEFAULT_LOCALE` defaults to `de`, as in NutriCore. | §48 |
| 7 | **User decision:** image publishing mirrors NutriCore: amd64 on `main`, amd64+arm64 on `v*.*.*` tags and on manual runs; semver/`main`/SHA/`latest` tags, SBOM, provenance. | §80 |
| 8 | **User decision:** no marketing website. | — |
| 9 | The `migrate` one-shot service also runs the bundled catalogue seed after `migrate deploy`, so a fresh `docker compose up` has grinders, brewers and recipes. The seed is idempotent and only touches `ownerId = null` rows. | §2, §82 |
| 10 | Brew completion, abort and the post-brew tasting are JSON route handlers (`POST /api/brews/[id]/complete|abort|tasting`), not Server Actions: the offline outbox retries them after reconnecting, possibly after a redeploy, when an old Server Action id would no longer resolve. | §55, §57 |
| 11 | Bundled recipes are stored in English; the reader's language is applied from the catalogue (`src/lib/catalogue/recipes.ts`) when they are displayed, snapshotted or copied. | §42, §48 |
| 12 | Recipe grind guidance is the enum `GrindLevel` (EXTRA_FINE … COARSE). | §17 |
| 13 | Live brew semantics: preparation steps (PREPARE / ADD_COFFEE / TARE without timing or water) can be confirmed before the timer starts; a step is due when its `durationSeconds` elapses or the brew clock reaches `targetElapsedSeconds`; a due `autoAdvance` step moves on at the exact due time even if the tick is late; the last step never auto-finishes; pressing Finish pauses the clock while optional actual weights are entered. | §14, §22 |
| 14 | Only ABORTED brews can be deleted; completed brews are history. | §58 |
| 15 | `Favorite` supports brews in the schema, but v0.1 only offers favorite coffees and recipes in the UI. | §64 |
| 16 | Search is per list (coffees, roasters, recipes, brewers, grinder models) with PostgreSQL `ILIKE`; a global search screen is left for later. | §39 |
| 17 | Deleting a user account deletes that user's data (including brews). Brews are never deleted because a coffee, recipe, grinder or brewer is deleted: those relations are `SetNull`. | §109 |
| 18 | Offline: a hand-written service worker (no dependency) caches static chunks, icons, the home page and live brew pages; the live screen warms these caches itself because it is reached by client-side navigation. Cached pages are cleared on sign-out. | §24, §103 |
| 19 | **User decision:** invitations can be handed over as a QR code of the single-use invitation link, rendered on the server (`qrcode`); no QR code for the bare base URL. | §47 |

