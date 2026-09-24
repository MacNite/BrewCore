BrewCore

Project Mission

Build BrewCore, a privacy-first, self-hosted coffee brewing and tracking application.

BrewCore should feel like the coffee-oriented sibling of NutriCore.

The application should combine:

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

Coffee → Recipe → Guided Brew → Taste → Adjust → Repeat

The primary goal is not merely to store coffee recipes.

The application should help users reliably reproduce good coffee and understand which variables changed the result.

---

1. Reference architecture

Use the existing NutriCore repository as the architectural reference.

Repository:

"MacNite/NutriCore"

Do NOT redesign the project into a separately deployed frontend and REST backend unless technically necessary.

NutriCore currently uses a Next.js full-stack architecture and BrewCore should retain that principle.

Existing NutriCore stack to retain

Use:

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
- Docker
- Docker Compose
- GitHub Actions
- GHCR image publishing
- standalone Next.js production build

Reuse the architectural patterns visible in:

- "Dockerfile"
- "docker-compose.yml"
- "src/app"
- "src/server"
- "src/lib"
- "src/components"
- "src/i18n"
- "messages"
- "prisma"
- ".github/workflows"

---

2. Existing NutriCore deployment model

BrewCore should initially reproduce the proven deployment design.

Expected Compose services:

db
migrate
app
worker      optional initially

db

PostgreSQL.

Suggested defaults:

POSTGRES_DB=brewcore
POSTGRES_USER=brewcore

Database must NOT be exposed publicly by default.

Persist PostgreSQL data through a configurable bind mount.

---

migrate

One-shot migration container.

It:

1. waits for PostgreSQL
2. runs "prisma migrate deploy"
3. exits successfully
4. must finish before app starts

Retain NutriCore's principle that the long-running application image should not require the Prisma CLI.

Suggested image:

ghcr.io/macnite/brewcore-migrate

---

app

Main BrewCore application.

Suggested image:

ghcr.io/macnite/brewcore

Default internal port:

3000

Expose configurable:

APP_PORT=3000

Health endpoint:

GET /api/health

---

worker

Do NOT introduce background processing simply because NutriCore contains a worker.

Only retain the worker architecture if BrewCore gains functionality that actually requires it.

Potential later uses:

- coffee-bag OCR
- AI coffee metadata extraction
- image processing
- data imports
- catalogue updates
- asynchronous recommendation generation

For the MVP, the worker may be omitted entirely.

Keep the architecture worker-ready.

---

3. Repository naming

Use:

Repository: BrewCore
npm package: brewcore
Docker Compose project: brewcore
Application: BrewCore

Container/service names should be generated from the Compose project rather than hard-coded wherever possible.

Suggested images:

ghcr.io/macnite/brewcore
ghcr.io/macnite/brewcore-migrate

Session cookies must NOT retain NutriCore names.

Use:

brewcore_session
brewcore_password_change

Replace all branding strings and identifiers.

---

4. Recommended repository creation strategy

Do not start by modifying the existing NutriCore domain model.

Create BrewCore as a separate repository.

Use NutriCore as an implementation template and copy/reimplement the infrastructure that is valuable.

Retain:

Docker infrastructure
authentication
sessions
user management
security helpers
rate limiting
environment validation
database wrapper
i18n structure
theme handling
app shell architecture
testing infrastructure
GitHub Actions
container publishing
health checks
logging conventions

Remove nutrition-specific features.

Examples:

foods
nutrients
diary
weight
body measurements
health imports
food sources
nutrition targets
meal types
calorie calculations
body scan
food research

Do not carry unused NutriCore database models into BrewCore.

Start BrewCore with a clean initial Prisma migration.

---

5. Product architecture

BrewCore should distinguish four concepts clearly:

Catalogue Data
User Equipment
Recipes
Actual Brews

Never overwrite historical Brew data when a coffee, grinder or recipe changes.

A completed brew represents what actually happened at that moment.

Therefore Brew records must contain snapshots of important parameters.

---

6. Core entities

Implement the following major domains.

User
Coffee
Roaster
GrinderModel
UserGrinder
Brewer
Recipe
RecipeStep
Brew
BrewStepResult
Tasting
Favorite

Future:

ScaleDevice
ScaleSample
RecipePublication
CoffeeBagScan
CoffeeInventoryTransaction

---

7. Coffee model

A Coffee represents a specific coffee/bag owned by the user.

Do not model it only as a generic bean name.

Recommended fields:

Coffee

id
ownerId

name
roasterId
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

Useful roast levels:

LIGHT
MEDIUM_LIGHT
MEDIUM
MEDIUM_DARK
DARK
UNKNOWN

Processing examples must not be hard-coded as the only possibilities.

Allow free text in addition to common values:

Washed
Natural
Honey
Anaerobic
Carbonic Maceration
Experimental
Other

---

8. Roaster database

Create a separate Roaster entity.

Fields:

id
name
country
city
website
notes
createdAt
updatedAt

Initially this can be user-created.

Later a global community catalogue could be added.

Do not block BrewCore MVP on a public roaster database.

---

9. Grinder architecture

Separate the generic grinder model from the user's physical grinder.

GrinderModel

Represents the catalogue entry.

Example:

Comandante C40 MK4
1Zpresso K-Ultra
Fellow Ode Gen 2
DF64 Gen 2
Niche Zero

Fields:

id
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

Possible types:

HAND
ELECTRIC
BUILT_IN

Adjustment types:

CLICK
NUMBER
STEPLESS
MICRON
CUSTOM

---

10. UserGrinder

Represents the user's actual grinder.

Fields:

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

Why this separation matters:

Two users may both own a Comandante C40, but their zero-point and preferred settings may differ.

A recipe should therefore never assume that "24 clicks" universally means the same grind.

---

11. Grinder setting model

Store actual brew grind settings separately.

Recommended flexible structure:

grinderId
displayValue
numericValue
unit
note

Examples:

24 clicks

5.2

650 µm

1.3 rotations + 4 clicks

Preserve the human-readable representation even when a numeric representation exists.

---

12. Brewer database

Although the original requirement mentions Coffee, Grinder and Recipe databases, BrewCore also needs a Brewer catalogue.

Examples:

Hario V60 02
AeroPress
Chemex 6 Cup
Kalita Wave 185
Clever Dripper
French Press
Moka Pot
Espresso Machine
Origami
April Brewer
Orea V4

Model:

Brewer

id
manufacturer
model
methodType
capacityMl
description

Method types:

POUR_OVER
IMMERSION
HYBRID
AEROPRESS
ESPRESSO
MOKA
FRENCH_PRESS
COLD_BREW
CUPPING
OTHER

---

13. Recipe model

Recipes must be structured data.

Do NOT store the brewing procedure only as a Markdown or text field.

Recommended model:

Recipe

id
ownerId

name
description

brewerId
methodType

defaultCoffeeDoseG
defaultWaterG
defaultRatio

waterTemperatureC

grindDescription
targetBrewTimeSeconds

servings

tags[]

isFavorite

createdAt
updatedAt
archivedAt

Optional later:

source
author
sourceUrl
forkedFromRecipeId
publicationId

---

14. RecipeStep

This is one of the most important data structures in the project.

Each recipe consists of ordered executable steps.

RecipeStep

id
recipeId
position

type
title
instruction

durationSeconds

waterTargetG
waterDeltaG

temperatureC

requiresConfirmation

autoAdvance

metadata JSON

Step types:

PREPARE
TARE
ADD_COFFEE
BLOOM
POUR
WAIT
STIR
SWIRL
PRESS
BREAK_CRUST
DRAW_DOWN
STOP
SERVE
CUSTOM

The step system must be extensible.

Do NOT encode every brewing method into application code.

Recipes should define the workflow.

---

15. Recipe semantics

Support both cumulative and incremental water values.

Example V60:

Step 1
Bloom to 60 g

Step 2
Pour to 180 g

Step 3
Pour to 300 g

The UI may display:

Target: 180 g
Add: +120 g

Store sufficient data to support both.

---

16. Recipe scaling

Recipes must scale automatically.

Example recipe:

Coffee: 20 g
Water: 320 g
Ratio: 1:16

User selects:

Coffee: 25 g

BrewCore calculates:

Water: 400 g

Step targets must scale correspondingly.

Example:

60 g bloom
180 g second target
320 g final

becomes approximately:

75 g
225 g
400 g

Scaling rules must be deterministic and covered by unit tests.

Do not mutate the original recipe when starting a scaled brew.

---

17. Grind guidance

Recipes should contain generic grind guidance such as:

Fine
Medium-fine
Medium
Medium-coarse
Coarse

A user's specific grinder setting belongs in either:

RecipeGrinderPreset

or the Brew itself.

Recommended model:

RecipeGrinderPreset

id
recipeId
userGrinderId

settingText
settingNumeric
note

Example:

Recipe: Hoffmann V60
Grinder: Comandante C40
Setting: 23 clicks

This allows BrewCore eventually to say:

Last successful setting with this recipe + coffee + grinder:
22 clicks

---

18. Brew model

A Brew represents one actual brewing event.

This is the central historical entity.

Recommended fields:

Brew

id
ownerId

recipeId
coffeeId
userGrinderId
brewerId

startedAt
completedAt

status

coffeeDoseG
waterTargetG
waterActualG

ratio

waterTemperatureC

grindSettingText
grindSettingNumeric

targetDurationSeconds
actualDurationSeconds

notes

createdAt
updatedAt

Statuses:

PLANNED
IN_PROGRESS
COMPLETED
ABORTED

---

19. Brew snapshots

Historical records must remain reproducible even after a recipe changes.

Store snapshots on Brew:

recipeNameSnapshot
coffeeNameSnapshot
roasterSnapshot
grinderSnapshot
brewerSnapshot
recipeSnapshot JSON

Do not rely exclusively on live foreign-key relations for historical display.

If the user changes a recipe tomorrow, yesterday's Brew must still describe yesterday's recipe.

---

20. Interactive Live Brewing Mode

This should be BrewCore's signature feature.

Primary route:

/brew/new

or:

/recipes/[id]/brew

When started:

1. select Coffee
2. select Recipe
3. select Grinder
4. select Brewer if not implied
5. adjust dose
6. adjust temperature
7. adjust grind
8. review calculated targets
9. tap Start Brew

Then open a distraction-free brewing screen.

---

21. Live Brew UI

The brewing UI should prioritize readability from approximately arm's length.

Main display:

03:42

POUR 3 / 4

Pour to
240 g

Target time
02:15

Current
212 g

Next
Wait 30 sec

Controls:

Pause
Previous
Next
Finish
Cancel

Avoid small controls.

Use large touch targets.

Prevent accidental navigation away.

Optionally use Wake Lock API while brewing.

If supported, keep the display awake.

---

22. Brew state machine

Do not implement guided brewing as scattered React timers.

Create a proper state machine/domain controller.

Suggested logical states:

READY
RUNNING
PAUSED
STEP_COMPLETE
FINISHED
ABORTED

State should contain:

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

The timer must derive elapsed time from timestamps.

Do NOT simply increment an integer every second.

Otherwise browser throttling/backgrounding will make timing inaccurate.

Example:

elapsed = Date.now() - startedAt - pausedDuration

---

23. Live Brew persistence

A brewing session must survive:

page refresh
temporary connectivity loss
PWA backgrounding
accidental browser restart where feasible

Persist active-brew state locally.

Recommended:

IndexedDB

Maintain a local active-brew snapshot.

On reconnect/load:

Resume Brew?

The server remains the authoritative long-term store.

The live session should remain usable locally if the server connection briefly disappears.

---

24. PWA architecture

NutriCore has a Web App Manifest and standalone PWA presentation.

BrewCore should go further.

Add an actual offline strategy for the brewing interface.

At minimum cache:

app shell
active recipe
selected coffee
selected grinder
active brew state
required icons/assets

The user must not lose an active brew because Wi-Fi momentarily drops.

Do not attempt full offline synchronization for every screen in MVP.

Prioritize:

Active brew works offline.

---

25. Live brewing events

Record actual execution of recipe steps.

Model:

BrewStepResult

id
brewId
recipeStepId

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

This will later enable useful analytics.

---

26. Manual mode

Live brewing must work without any smart scale.

For manual brewing:

timer runs automatically
step changes can be automatic or manual
weight target is displayed
user taps Next when appropriate

This must be excellent before Bluetooth support is implemented.

Bluetooth is enhancement, not prerequisite.

---

27. Smart scale architecture

Design the domain now but implement later.

Use an adapter interface such as:

interface ScaleAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  tare(): Promise<void>;
  getWeight(): number | null;
  subscribe(callback): () => void;
}

Scale-specific protocols must live behind adapters.

Never put Acaia/Felicita/etc. BLE logic into the Brew UI.

Suggested architecture:

src/lib/scales/
  types.ts
  manager.ts
  adapters/

Possible later adapters:

Acaia
Bookoo
DiFluid
Felicita
Timemore
generic/custom

Web Bluetooth availability varies by browser/platform.

Therefore BrewCore must remain fully functional without BLE.

---

28. Scale samples

Later, optionally store high-frequency samples:

ScaleSample

brewId
timestampMs
weightG
flowRateGps

Do NOT immediately write every scale measurement directly to PostgreSQL.

During live brewing:

collect client-side
downsample
persist meaningful samples/batches

Otherwise the app will generate unnecessarily large write volumes.

---

29. Brew graph

Later show:

X axis = time
Y axis = weight
secondary series = flow rate

Overlay recipe targets.

Useful comparisons:

planned pour
actual pour

---

30. Tasting model

After finishing a brew, immediately offer:

How was it?

Keep the first interaction quick.

Recommended simple controls:

Overall rating 1–5
Would brew again

Then optional detail.

Model:

Tasting

id
brewId
rating

acidity
sweetness
bitterness
body
clarity
aftertaste

notes

createdAt

Values could initially be integer scales such as 1–5.

---

31. Quick taste feedback

Also support quick descriptive tags:

Sour
Bitter
Sweet
Balanced
Weak
Strong
Dry
Astringent
Hollow
Juicy
Clean
Muddy

Do not require SCA-level cupping forms for ordinary brewing.

Advanced tasting can be added later.

---

32. Dial-in workflow

BrewCore should eventually help answer:

What should I change next?

Start rule-based, not AI-based.

Example recommendations:

Sour + fast brew
→ grind finer

Bitter + slow brew
→ grind coarser

Weak
→ increase dose or reduce water

Strong
→ decrease dose or increase water

Always present this as a suggestion rather than a factual diagnosis.

Store what variable the user changed between brews.

---

33. Brew comparison

Users should be able to compare two brews.

Show differences for:

coffee
recipe
dose
water
ratio
temperature
grinder
grind setting
brew time
rating
tasting attributes

Highlight changed variables.

Example:

Brew A
22 clicks
2:48
4/5

Brew B
21 clicks
3:06
5/5

This is a key BrewCore differentiator.

---

34. Coffee detail screen

Route:

/coffees/[id]

Show:

coffee metadata
roaster
origin
processing
roast date
days since roast
bag amount remaining

favorite recipe
last grinder setting
average rating
number of brews
best-rated brews
recent brews

Primary CTA:

Brew this coffee

---

35. Grinder detail screen

Route:

/grinders/[id]

Show:

model
nickname
calibration
recent settings
brews
coffee/recipe combinations
best-rated settings

---

36. Recipe detail screen

Route:

/recipes/[id]

Show:

recipe metadata
brew parameters
ordered steps
estimated brew duration
compatible brewer
grind guidance
personal grinder presets
recent brews
average rating

Primary CTA:

Start Brew

Secondary actions:

Edit
Duplicate
Favorite
Share later

---

37. Home screen

Home should answer:

What do I want to brew now?

Do not make analytics the main home screen.

Recommended sections:

Quick Brew

Recent coffees

Favorite recipes

Continue active brew

Recent brews

Primary floating or prominent action:

Start Brew

---

38. Navigation

Suggested mobile navigation:

Home
Coffee
Brew
Recipes
More

Alternative:

Today
Coffee
Recipes
History

The central action should always make starting a Brew easy.

Possible persistent center button:

Brew

---

39. Search

Implement fast search across:

Coffee
Roasters
Recipes
Grinder models
Brewers
Brews

For MVP, server-side PostgreSQL search is sufficient.

Do not introduce Elasticsearch or another search service.

---

40. Coffee inventory

Track optional remaining amount.

Starting bag:

250 g

Each completed brew using:

18 g

can subtract automatically.

User must be able to disable or correct this.

Never make brew completion fail because inventory data is missing.

Useful indicators:

132 g remaining
~7 brews remaining

---

41. Coffee freshness

Calculate:

days since roast

Do not present a universal claim that coffee is good/bad based on age.

Simply expose factual age.

Later allow user-defined preferred rest windows.

---

42. Recipe library

Ship BrewCore with a small high-quality default recipe catalogue.

Initial brewing methods:

V60
AeroPress
French Press
Chemex
Kalita Wave
Clever Dripper
Espresso
Moka Pot

Keep bundled recipes separate from user recipes if possible.

Users must be able to:

duplicate
modify
favorite
archive

Do not let app updates overwrite user-modified copies.

---

43. Recipe provenance

Add:

sourceName
sourceUrl
authorName

A recipe inspired by another source should preserve attribution.

Do not silently label third-party recipes as BrewCore recipes.

---

44. Recipe sharing

Do not make this MVP-critical.

Architecture should later support:

public read-only recipe URL
QR code
import recipe
fork recipe

A copied recipe becomes independently editable.

Preserve attribution to source.

---

45. Database ownership

Private user records must have explicit ownership.

Follow NutriCore patterns.

Examples:

Coffee.ownerId
UserGrinder.ownerId
Recipe.ownerId
Brew.ownerId

Every server-side read/update/delete must enforce ownership.

Never rely on the UI to prevent cross-user access.

---

46. Authentication

Reuse NutriCore's security model.

Retain:

Argon2id password hashes
random opaque session tokens
SHA-256 session token storage
HttpOnly cookies
SameSite=Lax
Secure cookies when HTTPS
30-day session expiry
same-origin checks
admin/user roles if required

Rename all NutriCore cookie/constants.

---

47. Registration

Keep BrewCore self-hosting friendly.

Recommended modes:

bootstrap
invite
open
disabled

Default should remain conservative.

A new private installation should be easy to bootstrap.

---

48. Internationalization

Start with:

English
German

Reuse NutriCore's "next-intl" architecture.

Store translations under:

messages/en.json
messages/de.json

Do not hard-code UI strings in components.

Coffee names, roasters and user content are not translated automatically.

---

49. Units

Internally use canonical units:

mass: grams
water: grams
temperature: Celsius
time: milliseconds/seconds

Do not store locale-formatted numeric strings.

Formatting belongs in UI.

Potential later display preferences:

°C / °F
g / oz
ml where relevant

For specialty coffee water measurements, grams should be the primary representation.

---

50. Data precision

Use sensible decimal database types.

Examples:

dose       Decimal(8,2)
water      Decimal(8,2)
temperature Decimal(5,2)
ratio      Decimal(8,4)

Do not use floating point for persisted quantities where precision matters.

Convert Prisma Decimal explicitly when moving values to client components.

---

51. Server architecture

Follow NutriCore's existing layering.

Use:

src/app

for routing and page composition.

Use:

src/components

for reusable UI.

Use:

src/server

for business operations and persistence workflows.

Use:

src/lib

for pure domain logic and reusable utilities.

Avoid putting Prisma calls directly throughout React components.

---

52. Suggested BrewCore server modules

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

---

53. Suggested domain library

src/lib/brewing/
  ratio.ts
  scaling.ts
  timer.ts
  state-machine.ts
  recipe.ts
  tasting.ts
  dial-in.ts

Functions in these files should preferably be pure and unit-tested.

---

54. Suggested routes

/

/login
/register
/onboarding

/coffees
/coffees/new
/coffees/[id]
/coffees/[id]/edit

/grinders
/grinders/new
/grinders/[id]

/brewers
/brewers/[id]

/recipes
/recipes/new
/recipes/[id]
/recipes/[id]/edit
/recipes/[id]/brew

/brews
/brews/[id]
/brews/[id]/taste

/brew/live/[id]

/settings

/admin

---

55. API routes

Do not build an unnecessary REST API for internal application operations.

Prefer Next Server Actions for ordinary mutations, matching NutriCore.

Use route handlers where an API endpoint makes technical sense.

Examples:

GET /api/health

future:
/api/export/json
/api/import
/api/device/...

---

56. Brew creation sequence

Starting a Brew should create a server-side Brew record before entering live mode.

Sequence:

select configuration
↓
validate
↓
create Brew(status=IN_PROGRESS)
↓
create snapshot
↓
initialize local live session
↓
navigate to /brew/live/[id]

If local state is lost, the application can reconstruct most of the Brew from the server snapshot.

---

57. Completing a Brew

Sequence:

Finish
↓
capture actual duration
↓
capture actual water if available
↓
persist completed steps
↓
Brew.status = COMPLETED
↓
optionally decrement coffee inventory
↓
open tasting dialog

The tasting form may be skipped.

A Brew does not require tasting data to be valid.

---

58. Abort handling

If the user cancels:

Brew.status = ABORTED

Do not delete it automatically.

Option:

Delete aborted brew

can be explicit.

Aborted data can later help diagnose workflows.

---

59. Recipe versioning strategy

Do not initially implement a complicated version table.

Use Brew snapshots.

Recipe remains editable.

Brew stores the recipe configuration used during that session.

If formal recipe version history becomes useful later, add it then.

---

60. Analytics MVP

Useful metrics:

number of brews
brews per week/month
average rating
most-used coffee
most-used recipe
most-used grinder
average brew time

More interesting analytics:

rating by grind setting
rating by recipe
rating by coffee
rating vs brew time

Do not build a huge dashboard before the core Brew flow is polished.

---

61. Dial-in history

For a coffee + recipe + grinder combination show:

Brew 1
24 clicks
2:31
3/5
Sour

Brew 2
23 clicks
2:48
4/5
Balanced

Brew 3
22 clicks
3:04
5/5
Sweet

This is one of BrewCore's most useful differentiators.

---

62. "Brew again"

Every completed Brew should have:

Brew Again

This preloads:

coffee
recipe
grinder
dose
water
temperature
grind

The user can change any parameter before starting.

Do NOT create a new Brew until Start is confirmed.

---

63. "Use last successful settings"

On Coffee and Recipe screens, provide later:

Use last settings

or:

Best recent settings

Define "best" transparently.

Do not invent opaque AI scoring.

MVP can simply use:

most recent brew rated >= 4

or let users manually mark a brew:

Favorite result

---

64. Favorites

Allow favorites for:

Coffee
Recipe
Brew

A favorite Brew is particularly useful because it represents a known successful configuration.

---

65. Images

Coffee bags should support an optional photo.

Use NutriCore's image safety/size patterns where applicable.

Store metadata responsibly.

Do not require images.

Future OCR must use a separate explicit workflow.

---

66. Coffee bag scanner – later feature

Future feature:

Take photo of coffee bag
↓
extract text
↓
propose:
roaster
coffee
origin
variety
process
altitude
roast date
tasting notes
↓
user reviews
↓
save

Never write AI/OCR extraction directly to trusted Coffee fields without user confirmation.

This follows the good NutriCore pattern of human confirmation for generated/imported information.

---

67. AI scope

AI is not required for BrewCore MVP.

Do not make brewing dependent on an LLM.

Potential future AI:

bag metadata extraction
natural-language recipe import
brew comparison explanation
dial-in suggestions

Every AI recommendation must remain optional.

---

68. Import/export

Privacy-first/self-hosted applications need export.

Implement a JSON export once the MVP data model stabilizes.

Export:

coffees
roasters
grinders
brewers
recipes
brews
tastings

Later:

CSV Brew history

Imports should validate schema and ownership.

---

69. PWA behavior

Manifest:

name: BrewCore
short_name: BrewCore
display: standalone
orientation: portrait

Suggested categories:

food
lifestyle
utilities

Add BrewCore-specific icons.

Do not reuse NutriCore branding assets.

---

70. Theme

Support:

light
dark
system

Keep theme architecture from NutriCore.

Design BrewCore independently.

Avoid turning everything brown simply because it is coffee software.

Prioritize contrast and usability.

---

71. Accessibility

Guided brewing is especially sensitive to accessibility.

Requirements:

large text
high contrast
large targets
keyboard navigation
screen reader labels
no color-only state indication
reduced-motion support

Optional later:

spoken step prompts
vibration/haptics where available

Live Brew instructions must remain understandable without relying on animations.

---

72. Notifications and cues

During live brew:

step transition sound
optional vibration
visual state change

All cues must be configurable.

Do not rely on sound alone.

---

73. Wake Lock

Use Screen Wake Lock API when available during an active brew.

Behavior:

Start Brew
→ request wake lock

Pause/background
→ handle release

Resume foreground
→ reacquire if allowed

Finish/abort
→ release

Failure to acquire Wake Lock must not break brewing.

---

74. Browser lifecycle

Handle:

visibilitychange
pagehide
reload
PWA background

Persist live state whenever meaningful state changes occur.

Do not depend on unload handlers to save critical data.

---

75. Timer tests

Unit test at least:

normal running
pause
resume
multiple pauses
page restore
step transitions
auto advance
manual advance
late browser tick
clock calculation

Use fake timers where appropriate.

---

76. Recipe scaling tests

Test:

20 g → 320 g
25 g → 400 g

step target scaling
rounding
ratio preservation
custom water override

Clearly define rounding rules.

Suggested display:

0.1 g internally
1 g recipe water target by default

---

77. Security

Port the relevant NutriCore protections.

Retain/verify:

secure cookies
same-origin mutation checks
security headers
environment validation
rate limiting for auth
ownership checking
safe URL handling
upload limits
redacted logs
no secrets in Docker images

Run the application as a non-root Docker user.

---

78. Environment variables

Start with a small ".env.example".

Likely:

POSTGRES_DB=brewcore
POSTGRES_USER=brewcore
POSTGRES_PASSWORD=

POSTGRES_DATA_PATH=./data/postgres
BACKUP_PATH=./backups

APP_PORT=3000
APP_URL=http://localhost:3000
APP_SECRET=

REGISTRATION_MODE=bootstrap

Do not copy NutriCore's nutrition/AI environment variables unless used.

---

79. CI

Retain the NutriCore CI philosophy.

Every PR should run:

npm ci
prisma generate
prisma migrate deploy
lint
typecheck
unit tests
build
Playwright E2E
Docker image build
migration image build

Test against real PostgreSQL in CI.

---

80. Container publishing

Publish from GitHub Actions to:

ghcr.io/macnite/brewcore
ghcr.io/macnite/brewcore-migrate

Preserve:

semver tags
main tag
SHA tag
latest
SBOM
provenance
amd64
arm64 releases

---

81. Backups

The PostgreSQL deployment should retain a configurable backup mount.

Document:

pg_dump
pg_restore

Do not invent an internal backup scheduler in MVP.

---

82. Development seed data

Create development seeds.

Include:

Coffee:

Ethiopia Guji Natural
Kenya Nyeri Washed
Brazil Fazenda Natural

Grinders:

Comandante C40 MK4
Fellow Ode Gen 2
1Zpresso K-Ultra
Niche Zero
DF64 Gen 2

Brewers:

Hario V60 02
AeroPress
Chemex
Kalita Wave 185
French Press
Espresso

Recipes:

Basic V60
Two-Pour V60
AeroPress Standard
French Press
Espresso 1:2

Seed content should be clearly identified as example/bundled data.

---

83. MVP definition

Version 0.1 must include:

Authentication
English/German
Coffee CRUD
Roaster CRUD
Grinder catalogue
Personal grinder CRUD
Brewer catalogue
Recipe CRUD
Structured RecipeSteps
Recipe scaling
Start Brew
Interactive Live Brewing Mode
Pause/resume
Manual step progression
Automatic timed step progression
Brew history
Tasting/rating
Brew Again
PWA installability
Docker deployment
PostgreSQL
CI
JSON export

---

84. Explicitly exclude from 0.1

Do NOT delay MVP for:

Bluetooth scales
OCR
AI
social network
community recipes
roaster accounts
Shopify integration
Apple Watch
Wear OS
native mobile application
advanced cupping
machine telemetry
complex recommendations

Architect for them where reasonable, but do not implement them prematurely.

---

85. Version 0.2

Focus on dial-in and insight.

Add:

brew comparison
coffee inventory
favorite Brew
last successful settings
grinder-specific recipe presets
basic charts
dial-in history
rule-based brew suggestions
CSV export
recipe sharing/import

---

86. Version 0.3

Focus on hardware.

Add:

Web Bluetooth abstraction
first supported smart scale
live weight
auto tare if device supports it
target-weight indicator
flow-rate calculation
brew graph
scale sample persistence/downsampling

Do not support ten scale brands simultaneously.

Build one adapter well and prove the architecture first.

---

87. Version 0.4+

Possible:

additional BLE scales
coffee bag OCR
recipe import from URL/text
AI-assisted metadata
community recipe catalogue
roaster profiles
QR recipe sharing
advanced espresso workflow
cupping workflow
brew statistics
native companion applications

---

88. Espresso support

Do not force espresso to behave exactly like pour-over.

An espresso Recipe should support:

dose in
target yield
target ratio
target time
temperature
grind
preinfusion
pressure note

Brew result:

actual dose
actual yield
actual time
actual ratio
taste

The RecipeStep engine can still represent espresso phases, but the main espresso UI may eventually use a specialized presentation.

MVP may implement simple espresso shot tracking without machine integration.

---

89. Recipe step examples

Example V60:

Recipe
20 g coffee
320 g water
94 °C

Step 1
PREPARE
Rinse filter and preheat brewer

Step 2
ADD_COFFEE
Add 20 g coffee

Step 3
TARE
Tare scale

Step 4
BLOOM
Pour to 60 g
Duration 45 sec

Step 5
POUR
Pour to 200 g
Target time 1:15

Step 6
POUR
Pour to 320 g
Target time 1:45

Step 7
DRAW_DOWN
Wait until approximately 2:45–3:15

Step 8
SERVE
Swirl and serve

---

90. Brew-start configuration

Before beginning the timer show one compact review screen:

Coffee
Ethiopia Guji

Recipe
V60 Two Pour

Coffee
20.0 g

Water
320 g

Ratio
1:16

Temperature
94 °C

Grinder
Comandante C40

Setting
23 clicks

CTA:

START BREW

---

91. Post-brew screen

Immediately after completion:

Brew complete
2:52

20.0 g → 320 g
94 °C
23 clicks

Then:

How was it?

★ ★ ★ ★ ★

Quick tags and optional notes.

Buttons:

Save
Brew Again
Details

---

92. Product principle: progressive complexity

A beginner should be able to:

choose coffee
choose recipe
press Start
follow instructions
rate result

An advanced user should optionally access:

exact grinder settings
flow data
temperature
step timing
comparison
charts
advanced tasting

Do not expose every field on every screen by default.

---

93. Product principle: reproducibility

For every completed Brew, BrewCore should eventually be able to answer:

Which coffee?
How old was it?
Which recipe?
How much coffee?
How much water?
Which grinder?
Which setting?
Which brewer?
What temperature?
How long?
What steps?
What actually happened?
How did it taste?

This should guide the database design.

---

94. Product principle: change one variable

BrewCore should encourage controlled iteration.

After a Brew:

Brew again

should keep everything constant unless the user explicitly changes something.

When changes occur, store them.

Later display:

Changed since previous brew:
Grind 24 → 23 clicks

This makes dial-in history understandable.

---

95. Product principle: local resilience

The most critical user moment is the active Brew.

Therefore:

authentication may require server
catalogue browsing may require server
analytics may require server

BUT

an already-started Brew should survive temporary network loss

Treat this as an architectural requirement.

---

96. Development methodology for Claude

Work in small, reviewable phases.

For every phase:

1. inspect existing NutriCore implementation relevant to that phase
2. document which pattern is being reused
3. implement the smallest coherent unit
4. add tests
5. run lint
6. run typecheck
7. run unit tests
8. build
9. update documentation
10. only then continue

Do not make huge cross-project rewrites.

---

97. Phase 0 — Bootstrap

Create BrewCore repository structure.

Tasks:

copy infrastructure patterns
rename branding
remove NutriCore domain code
configure BrewCore package
configure env validation
configure Docker
configure PostgreSQL
configure Prisma
configure CI
configure GHCR publishing
create health route
verify login/session skeleton

Acceptance:

docker compose up works
database migrates
app starts
health endpoint succeeds
login works
CI passes

---

98. Phase 1 — Core catalogues

Implement:

Roaster
Coffee
GrinderModel
UserGrinder
Brewer

Acceptance:

user can add/edit/archive coffee
user can manage personal grinder
bundled grinder models searchable
bundled brewers searchable
ownership enforced
DE/EN complete
E2E coverage

---

99. Phase 2 — Recipes

Implement:

Recipe
RecipeStep
recipe editor
recipe detail
recipe scaling
grinder preset
bundled recipes

Build a step editor that supports reordering.

Acceptance:

recipe can be created
steps can be reordered
recipe can be duplicated
dose scaling works
water targets scale
tests pass

---

100. Phase 3 — Brewing engine

Before making the final Live Brew UI, implement pure state-machine logic.

Implement:

start
tick calculation
pause
resume
next
previous
skip
auto advance
finish
abort
restore

Add extensive tests.

No database code inside the state machine.

---

101. Phase 4 — Live Brew UI

Implement:

brew setup screen
live screen
large timer
current instruction
current target
next step preview
pause
resume
manual next
automatic next
finish
abort confirmation
wake lock
local persistence

This phase deserves disproportionate UX attention.

It is the main BrewCore experience.

---

102. Phase 5 — Brew history and tasting

Implement:

Brew history
Brew details
tasting
rating
tags
notes
Brew Again

Acceptance:

A user should be able to complete this loop without friction:

open BrewCore
→ select coffee
→ select recipe
→ brew
→ rate
→ brew again tomorrow

---

103. Phase 6 — PWA resilience

Implement/test:

service worker
application shell cache
active recipe cache
IndexedDB active brew state
reload recovery
offline active brew
reconnection

Create Playwright coverage where practical.

Manual acceptance test:

start Brew
disable network
continue Brew
finish locally
restore network
persist final Brew

---

104. Phase 7 — Insights

Implement:

comparison
favorite Brew
last settings
coffee history
grinder history
basic statistics

Do not build generic dashboards for their own sake.

Every chart should answer a brewing question.

---

105. Test strategy

Unit tests:

recipe scaling
ratio calculation
timers
state machine
dial-in rules
ownership helpers
validation
formatting

Integration tests:

Prisma persistence
Brew snapshots
inventory deduction
recipe duplication
Brew completion

E2E:

login
create coffee
create grinder
create recipe
start brew
advance steps
finish brew
rate brew
brew again

---

106. Definition of done

A feature is not complete merely when the page renders.

It must have:

validation
ownership/security
error states
empty states
mobile layout
DE/EN text
loading behavior
tests
accessibility basics
documentation where required

---

107. Claude coding rules

Before modifying code:

inspect nearby NutriCore patterns first

Do not create a parallel architecture when a proven project pattern already exists.

Prefer:

simple TypeScript
explicit types
Zod at boundaries
pure domain functions
Prisma transactions for related writes
server ownership checks
small components

Avoid:

premature abstractions
generic repositories
unnecessary microservices
event buses
Redux unless justified
GraphQL unless justified
WebSockets unless justified
AI where deterministic logic works

---

108. Important architectural decision

BrewCore should remain a modular monolith.

Target:

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

Optional later:

Worker
BLE devices on client
external AI/OCR

Do not start with microservices.

---

109. Suggested Prisma relationship overview

Conceptually:

User
 ├── Coffee[]
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
 ├── RecipeGrinderPreset[]
 └── Brew[]

Coffee
 └── Brew[]

UserGrinder
 └── Brew[]

Brew
 ├── BrewStepResult[]
 └── Tasting?

Use explicit cascade/restrict behavior.

Think carefully before cascading historical Brew records.

Deleting catalogue entities should generally archive rather than destroy history.

---

110. Soft deletion

Prefer archiving for:

Coffee
UserGrinder
Recipe

Use:

archivedAt DateTime?

Historical Brews must continue to display archived entities.

---

111. First implementation milestone

The first meaningful internal milestone is:

«A fresh BrewCore installation can create a user, add one coffee and one grinder, select a bundled V60 recipe, complete an interactive guided brew, rate it, then repeat that brew from history.»

Until that works smoothly, avoid implementing peripheral features.

---

112. North-star UX

The main flow should ultimately require approximately:

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

Everything else supports this loop.

---

113. Initial task for Claude

Begin by analysing the current "MacNite/NutriCore" repository yourself.

Specifically inspect:

package.json
Dockerfile
docker-compose.yml
prisma/schema.prisma
src/lib/auth.ts
src/server/session.ts
src/components/app-shell.tsx
src/app/manifest.ts
src/server/recipe-actions.ts
src/server/recipes.ts
next.config.ts
.github/workflows/ci.yml
.github/workflows/publish.yml

Then produce a short migration/bootstrap report containing:

KEEP
ADAPT
REMOVE
NEW

Do not begin mass-copying files until that inventory has been made.

After the inventory, implement Phase 0.

Run all quality checks before moving to Phase 1.

---

114. Final priority order

When tradeoffs occur, optimize in this order:

1. Reliable guided brewing
2. Accurate historical Brew data
3. Fast mobile UX
4. Offline resilience during active Brew
5. Easy coffee / recipe / grinder management
6. Reproducibility
7. Dial-in usefulness
8. Analytics
9. Hardware integrations
10. AI/social features

BrewCore succeeds if users open it every time they make coffee because starting and recording a Brew is easier than not recording it.
