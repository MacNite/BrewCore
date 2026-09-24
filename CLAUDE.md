# BrewCore

Privacy-first, self-hosted coffee brewing and tracking app — the coffee-oriented
sibling of NutriCore. Core loop:

```
Coffee → Recipe → Guided Brew → Taste → Adjust → Repeat
```

The goal is not to store recipes but to help users **reliably reproduce good
coffee** and understand which variables changed the result.

## Where things are

- **Product & architecture spec:** [`docs/SPEC.md`](docs/SPEC.md) — data
  model, routes, flows, phases. It is large: read the sections relevant to the
  current task instead of the whole file. Section numbers (`§N`) below refer to it.
- **Architectural reference:** the `MacNite/NutriCore` repository (see
  *NutriCore access*).
- **Commands:** see *Commands* below.

If the spec is ambiguous, contradicts itself or contradicts the code: stop and
ask. Record the decision in `docs/SPEC.md` in the same PR.

## Non-negotiable architecture rules

- Modular monolith: Next.js App Router + Server Actions + Prisma + PostgreSQL.
  No separate REST backend, microservices, event buses, GraphQL, Redux or
  WebSockets unless justified (§108).
- Reuse NutriCore patterns; do not build a parallel architecture where a proven
  one exists.
- Layering: `src/app` routing, `src/components` UI, `src/server` business
  operations/persistence, `src/lib` pure domain logic. No Prisma calls in React
  components (§51).
- Every server-side read/update/delete enforces ownership, including the
  records a mutation references. Bundled catalogue rows have `ownerId = null`
  and are read-only for users (§6, §45).
- Brews are history: never overwrite them when a coffee, grinder or recipe
  changes; store snapshots (§18–19). Never cascade-delete Brews (§109).
- Persisted quantities use `Decimal`, never floats; canonical units are grams,
  °C, ms/s (§49–50).
- Guided brewing timing is derived from timestamps in a pure state machine,
  not from incremented counters or scattered React timers (§22).
- An already-started Brew must survive network loss; completion is queued
  locally and synced idempotently (§23, §57, §95).
- No hard-coded UI strings — everything through `next-intl`
  (`messages/en.json`, `messages/de.json`).
- No AI dependency for brewing; rule-based logic first (§67).

## NutriCore access

The workflow requires inspecting `MacNite/NutriCore`, which is a separate
repository and usually **not** part of a BrewCore session.

- Claude Code on the web: add it to the session read-only (`add_repo`,
  `MacNite/NutriCore`) and clone it next to BrewCore (e.g. `../NutriCore`).
- Local: clone it next to BrewCore.
- Treat NutriCore as **read-only**. Never commit, push or open PRs there.
- If it cannot be accessed, **stop and ask** — do not reconstruct NutriCore
  patterns from memory or guesswork.

## Phases

Work through the phases in order. Determine the current phase from the merged
PRs and the repository state.

| Phase | Scope                               | Spec  | Release |
| ----- | ----------------------------------- | ----- | ------- |
| 0     | Bootstrap                           | §97   | v0.1    |
| 1     | Core catalogues                     | §98   | v0.1    |
| 2     | Recipes                             | §99   | v0.1    |
| 3     | Brewing engine (pure state machine) | §100  | v0.1    |
| 4     | Live Brew UI                        | §101  | v0.1    |
| 5     | Brew history, tasting, JSON export  | §102  | v0.1    |
| 6     | PWA resilience                      | §103  | v0.1    |
| 7     | Insights                            | §104  | v0.2    |

First milestone (§111): a fresh installation can create a user, add one coffee
and one grinder, select a bundled V60 recipe, complete a guided brew, rate it,
and repeat it from history. Avoid peripheral features until that works
smoothly. Do not pull v0.2+ features (§85–87) into v0.1.

## Per-phase workflow

Work in small, reviewable units. A phase may be split into several PRs
(e.g. `phase-1a-roasters-coffee`, `phase-1b-grinders`).

For every unit:

1. Read the relevant spec sections.
2. Inspect the corresponding NutriCore implementation.
3. Write down which NutriCore pattern is reused or adapted (in the PR
   description).
4. Implement the smallest coherent unit.
5. Add tests (unit; integration/E2E where the spec asks for them).
6. Run the full check list (below). Everything must pass locally.
7. Update documentation (`docs/SPEC.md` for decisions, `README.md` for
   setup/operation, the *Commands* section here when commands change).
8. Commit, push, open a PR.
9. Only start the next unit/phase once the PR's CI is green.

Do not make large cross-cutting rewrites.

## Git and PR rules

- Never push directly to `main`. One branch and one PR per phase or sub-phase.
- Branch names: `phase-<n>[<letter>]-<short-topic>` unless a branch name is
  prescribed for the session.
- Small, focused commits with descriptive messages.
- Do not mix phases in one PR, and do not stack a new phase on an unmerged PR
  unless asked.
- PR description: scope, spec sections covered, NutriCore patterns
  reused/adapted, spec decisions made, how it was tested.
- CI must be green before a PR is considered done. Never skip or disable tests
  to get green.

## Quality check list

Run before every push (from Phase 0 on; CI runs the same, §79):

1. lint
2. typecheck
3. unit tests
4. `prisma validate` and a schema/migration drift check (the schema must match
   the committed migrations; new schema changes need a new migration)
5. `prisma migrate deploy` against a fresh PostgreSQL
6. production build
7. Playwright E2E
8. Docker build of the app image
9. Docker build of the migrate image

If a check cannot be run in the current environment (e.g. no Docker), say so
explicitly in the PR instead of skipping it silently.

## Commands

To be filled in during Phase 0 (then keep up to date):

| Purpose          | Command |
| ---------------- | ------- |
| install          | _TBD_   |
| dev server       | _TBD_   |
| lint             | _TBD_   |
| typecheck        | _TBD_   |
| unit tests       | _TBD_   |
| E2E tests        | _TBD_   |
| build            | _TBD_   |
| new migration    | _TBD_   |
| drift check      | _TBD_   |
| seed             | _TBD_   |
| docker (app)     | _TBD_   |
| docker (migrate) | _TBD_   |

## Coding rules

Before modifying code, inspect nearby NutriCore (and existing BrewCore)
patterns first.

Prefer: simple TypeScript, explicit types, Zod at boundaries, pure domain
functions, Prisma transactions for related writes, server ownership checks,
small components.

Avoid: premature abstractions, generic repositories, unnecessary microservices,
event buses, Redux/GraphQL/WebSockets unless justified, AI where deterministic
logic works.

## Definition of done

A feature is not complete merely when the page renders. It must have:
validation, ownership/security, error states, empty states, mobile layout,
DE/EN text, loading behavior, tests, accessibility basics, and documentation
where required.

## Priority order

When trade-offs occur, optimize in this order:

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

BrewCore succeeds if users open it every time they make coffee because starting
and recording a Brew is easier than not recording it.

## Initial task

Only if Phase 0 has not started yet:

1. Get NutriCore access (see above).
2. Inspect in NutriCore: `package.json`, `Dockerfile`, `docker-compose.yml`,
   `prisma/schema.prisma`, `src/lib/auth.ts`, `src/server/session.ts`,
   `src/components/app-shell.tsx`, `src/app/manifest.ts`,
   `src/server/recipe-actions.ts`, `src/server/recipes.ts`, `next.config.ts`,
   `.github/workflows/ci.yml`, `.github/workflows/publish.yml`. If a listed
   file does not exist, find its equivalent and note it.
3. Produce a short migration/bootstrap report with the sections **KEEP**,
   **ADAPT**, **REMOVE**, **NEW**, and commit it as `docs/bootstrap-report.md`.
   Do not mass-copy files before this inventory exists.
4. Then implement Phase 0 (§97) following the per-phase workflow.
