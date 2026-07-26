# Project Research Summary

**Project:** shopping-list
**Domain:** Multi-user, mobile-first Next.js full-stack CRUD app with a deterministic, time-dependent priority-scoring engine (prioritized shopping/wishlist)
**Researched:** 2026-07-26
**Confidence:** HIGH (stack, architecture, pitfalls); MEDIUM (competitive feature landscape, unresolved scale values)

## Executive Summary

This is a personal/family prioritized shopping-list app whose entire reason for existing is a single differentiator: purchases are **automatically sorted by a meaningful, computed priority** so the user knows what to buy first. The success metric is trust - a user who returns regularly and believes the order. All four research files converge on the same conclusion: the product lives or dies on a small, pure, well-tested scoring engine, not on CRUD plumbing. Experts build this as a Next.js 16 App Router monolith (React 19, TypeScript, PostgreSQL via Drizzle, Better Auth for email/password), using Server Components for reads and Server Actions for writes, with the scoring logic isolated in a framework-free domain module developed test-first.

The recommended approach is a layered architecture with three hard boundaries: (1) a **pure domain layer** (domain/scoring, domain/dependencies) that imports nothing from Next/React/Drizzle and is 100% unit-tested - the TDD centerpiece, built first; (2) a **user-scoped repository** that is the single choke point for all DB access, with userId required on every query to guarantee multi-tenant isolation; (3) **thin Server Actions** that only do auth then validate (Zod) then call domain then repo then revalidate. The stack choices (Drizzle over Prisma, Better Auth over NextAuth, Vitest over Jest, Tailwind v4 + shadcn/ui) are all current 2026 greenfield defaults and are well corroborated.

The dominant risk is that **priority is time-dependent**: deadlinePoints = clamp(28 - days_until_deadline, -100, 100) changes every day. This single fact drives most of the critical pitfalls - never store total/deadlinePoints as authoritative columns (compute on read), inject the clock into scoring functions (or tests go flaky and hide off-by-one/timezone bugs), store deadline as a DATE not timestamptz, clamp only deadlinePoints never total, and use a deterministic sort tiebreaker so the list does not reshuffle. The second major risk cluster is multi-tenant security (IDOR): every query must be user-scoped and every Server Action must authenticate and validate, backed by negative two-user authorization tests against a real Postgres. A third gap needing resolution before the scoring phase: several point-scale values (Жизненно важно urgency, DoubtsType, BenefitType) are still marked pending in PROJECT.md and must be locked to avoid silent zeros/NaN.

## Key Findings

### Recommended Stack

The framework direction is already decided; STACK.md makes it concrete with 2026 greenfield defaults. A Next.js 16 App Router monolith with Server Actions removes the need for a separate API layer for CRUD. Drizzle is chosen over Prisma (no binary engine, SQL-first, schema is the type source), Better Auth over NextAuth (built-in email/password, Argon2id, DB sessions in your own Postgres, first-party Drizzle adapter), and Vitest over Jest (Vite-native, Next.js-recommended). Zod is the single validation source shared client+server, and the pure scoring logic + Zod schemas are ideal TDD targets.

**Core technologies:**
- **Next.js 16 (App Router) + React 19.2 + TypeScript 5** - full-stack framework; RSC reads, Server Action writes - 2026 production standard
- **PostgreSQL 16/17 + Drizzle ORM (0.44.x) + drizzle-kit** - type-safe, SQL-first data access; schema is the source of truth; reviewable SQL migrations
- **Better Auth (1.6.x)** - email/password multi-user auth, Argon2id, DB-backed sessions, first-party Drizzle adapter
- **Zod 4 + React Hook Form 7 + @hookform/resolvers 5** - one schema validates form + Server Action and infers the type
- **Tailwind v4 + shadcn/ui** - mobile-first, accessible copy-in components (Select, Dialog, Form, Checkbox)
- **nuqs + date-fns** - URL-based sort/filter state; calendar-day math for deadlinePoints
- **Vitest + React Testing Library + Playwright** - layered TDD (pure logic + components in Vitest; async RSC/auth/DB-scoping flows in Playwright)

### Expected Features

FEATURES.md confirms the automatic multi-attribute scoring engine is the sole differentiator; mainstream shopping apps offer only crude manual low/med/high priority. The v1 scope maps 1:1 to PROJECT.md active requirements. The single most important UX decision for the trust metric is exposing a per-field score breakdown ("why this priority").

**Must have (table stakes):**
- Auth (email/password) + per-user data isolation
- Item CRUD (title required; category/urgency/need/benefit dropdowns; optional link/description/price/deadline/doubts/isCredit+monthlyPayment/depends)
- Mark bought (completed) then archive + "show bought" filter
- Default view sorted by priority descending; sort options priority/date-added/alphabetical
- Mobile-first responsive UI

**Should have (competitive differentiators):**
- Automatic multi-attribute scoring engine (total = sum of point fields) - the core value
- Deadline-based urgency decay (deadlinePoints, time-relative) - list re-ranks itself over time
- Item dependency blocking (depends) - novel for a shopping list
- Priority badge (banded, accessible) + score "why" breakdown - the trust lever
- Doubts penalty (0/-1/-3) and credit penalty (-2)

**Defer (v2+):**
- User-configurable scales/weights (conflicts with v1 fixed-scale decision)
- Shared/collaborative lists, push notifications, price tracking/sale alerts, recurring items - all off-mission or out of scope
- Anti-feature: manual drag-to-reorder - directly conflicts with automatic scoring; do NOT build

### Architecture Approach

ARCHITECTURE.md prescribes a layered monolith with a pure, framework-free domain core. Reads flow through Server Components then user-scoped repository then pure scoring/blocking functions (with injected today) then sort then render. Writes flow through thin Server Actions (auth guard then Zod then domain then repo then revalidatePath). total and deadlinePoints are always derived on read, never stored authoritatively; blocked is derived, never stored. Data isolation is enforced in exactly one place - the repository - with userId on every query.

**Major components:**
1. **Pure domain layer** (domain/scoring, domain/dependencies) - deterministic scoring with injected clock; derived blocked state; no I/O - 100% unit-tested, built first
2. **User-scoped repository** (server/repos/items.ts) - the sole DB entrypoint; userId in every WHERE clause - the isolation choke point
3. **Thin Server Actions** (actions/items.ts) - auth then validate then domain then repo then revalidate
4. **Auth/session boundary** (Better Auth + (app) route-group guard) - session to userId
5. **Presentation** - Server Components for the sorted list; small leaf Client Components for the form and filters

### Critical Pitfalls

1. **Storing a static total/deadlinePoints** - priorities freeze and the list rots the next day (invisible in a same-day demo). Derive on read via a pure engine; store only raw inputs (+ optional base_points).
2. **Timezone / off-by-one in "days until deadline"** - store deadline as DATE (not timestamptz); compute whole calendar days at start-of-day in one explicit timezone via date-fns; preserve sign for overdue; one tested daysUntil(deadline, now) function.
3. **Missing per-user scoping (IDOR)** - scope every read/update/delete with WHERE id = ? AND userId = ?; derive userId from session only; return 404 on no match; centralize in the repository.
4. **Unauthenticated/unvalidated Server Actions** - they are public HTTP endpoints; start each with requireUser() + Zod validation; recompute score server-side; verify depends ownership.
5. **Flaky time-dependent tests + scoring entangled with UI** - inject now as an explicit parameter (never new Date() inside logic); keep scoring in a pure lib/scoring module; table-driven boundary tests under TZ=UTC.

Also important: clamp only deadlinePoints (not total); lock all pending scale values (exhaustive Record<Enum,number>, no ?? 0); deterministic sort tiebreaker (total DESC, createdAt ASC, id ASC); dependency self/cycle/dangling/cross-user guards; revalidatePath after every mutation; keep secrets out of NEXT_PUBLIC_.

## Implications for Roadmap

Research strongly agrees on build order: pure domain first (fastest to TDD, de-risks the core value before any infra), then auth, then CRUD, then list/sort/archive, then dependencies last (they reference other items and need CRUD + list working). A requirements-lock step must precede the scoring phase.

### Phase 0: Requirements Lock + Foundation
**Rationale:** Scale ambiguities must be resolved before scoring is built, and infra enables everything. Combine the decision-lock with project scaffolding.
**Delivers:** Confirmed point values (Жизненно важно, all DoubtsType/BenefitType, all 14 categories); Next.js 16 + TS + Tailwind v4 scaffold; Drizzle + Postgres + Vitest/Playwright harness; users/items schema + migrations with deadline DATE, self-FK depends_on_id ON DELETE SET NULL, indexes on (user_id) and (user_id, completed).
**Addresses:** Data-model foundation for all features.
**Avoids:** Pitfall 4 (undefined scales), Pitfall 1/2 (column types - DATE not timestamptz, no stored total).

### Phase 1: Scoring Engine (pure domain, TDD)
**Rationale:** Fastest thing to TDD, needs no infra, de-risks the differentiator (priority correctness) first.
**Delivers:** domain/scoring - exhaustive point-scale maps, daysUntil(deadline, now), deadlinePoints (clamped), calculateScore(item, today) returning full breakdown + total; all test-first with boundary tests.
**Addresses:** Scoring engine, deadline decay, doubts/credit penalties, score breakdown data.
**Avoids:** Pitfalls 1, 2, 3, 10, 11 (clock injection, clamp scope, purity, deterministic tests).

### Phase 2: Auth + Session Boundary
**Rationale:** Establishes the session-to-userId pattern that every CRUD query depends on.
**Delivers:** Better Auth email/password (Argon2id), DB sessions, getCurrentUser()/requireUser(), (app) route-group guard, two-user test harness.
**Uses:** Better Auth + Drizzle adapter (STACK.md).
**Implements:** Auth/session boundary component.
**Avoids:** Pitfalls 5, 6, 12 (isolation pattern + negative auth test harness).

### Phase 3: User-Scoped Repository + Item CRUD
**Rationale:** Needs auth (for userId) and schema; the repository is the isolation choke point.
**Delivers:** server/repos/items.ts with userId on every function; create/edit/delete Server Actions (auth then Zod then scoring then repo then revalidate); conditional monthlyPayment on isCredit; two-user isolation tests.
**Addresses:** Item CRUD, required/optional fields.
**Avoids:** Pitfalls 5, 6, 8, 12, 13 (isolation, validation, revalidate, client/server boundary).

### Phase 4: List View - Sort, Filter, Archive
**Rationale:** Depends on CRUD + scoring; delivers the visible product value.
**Delivers:** Default priority-descending sort with deterministic tiebreaker; date-added/alphabetical sorts + "show bought" toggle via nuqs; mark-bought then archive; mobile-first ItemCard list; priority badge + score "why" breakdown.
**Addresses:** Sorted view, sort options, archive, badge/breakdown (trust lever).
**Avoids:** Pitfalls 8, 9, 13 + UX pitfalls (tie stability, mobile tap targets, stale list).

### Phase 5: Dependencies / Blocking
**Rationale:** Last - references other items; needs CRUD + list working.
**Delivers:** depends self-FK wiring; derived blocked state; completion guard; self/cycle/dangling/cross-user validation; blocked items visually distinct and de-prioritized/grouped.
**Addresses:** Dependency blocking differentiator.
**Avoids:** Pitfall 7 + blocked-item UX pitfalls.

### Phase Ordering Rationale
- Pure domain before infra (Phase 1 before 2/3): the scoring engine is the core value and the easiest, fastest TDD target - de-risk correctness before adding framework glue.
- Auth before CRUD: the user-scoped repository requires the session-to-userId pattern to exist first.
- Dependencies last: they reference other items and need the CRUD + list already working; also the most guard-heavy feature.
- Requirements lock as Phase 0: unresolved scale values would produce plausible-but-wrong scores if built blind.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 0 (Requirements Lock):** requires a user decision on pending scale values - not research but a blocking confirmation; flag for the discuss step.
- **Phase 5 (Dependencies):** cycle-detection algorithm + deletion policy + blocked-item sort/grouping UX are the least standard; --research-phase worthwhile.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scoring):** fully specified pure functions; formula and boundary cases documented - build test-first from PITFALLS/ARCHITECTURE.
- **Phase 2 (Auth):** Better Auth email/password is a documented first-party path.
- **Phase 3 (CRUD) & Phase 4 (List):** standard Server Action + RSC patterns, well documented in STACK/ARCHITECTURE.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 2026 greenfield defaults corroborated by multiple sources; only patch versions drift (pin at install) |
| Features | MEDIUM-HIGH | Scoring rules HIGH (project source of truth); competitive landscape MEDIUM (public app research) |
| Architecture | HIGH | Structure/patterns HIGH; layered domain boundary well-established and directly serves the TDD constraint |
| Pitfalls | HIGH | Caching/auth verified vs Next 15/16 docs; scoring/deadline hazards derived from the project formula; IDOR/TDD are established patterns |

**Overall confidence:** HIGH

### Gaps to Address
- **Pending point-scale values** (Жизненно важно urgency, DoubtsType, BenefitType point maps): must be confirmed with the user before Phase 1. Handle via a Phase 0 decision-lock; enforce with an exhaustive Record<Enum,number> and a runtime guard that throws on unknown keys.
- **Deadline day-boundary timezone**: user is UTC+3; document and pin the chosen day boundary (user-local). Handle in the daysUntil design during Phase 1.
- **Deployment target** (serverless-on-Neon vs VPS/long-running Node): affects the Postgres driver choice (Neon HTTP vs postgres.js) and pooling. Handle during Phase 0 infra; app code is unchanged either way.
- **Score breakdown UI in v1 vs v1.x**: strongly recommended for v1 (trust metric) but optional per requirements - confirm inclusion during Phase 4 planning.

## Sources

### Primary (HIGH confidence)
- Next.js 16 docs + blog (App Router, Server Actions, Vitest guide, Next 15 caching changes) - framework direction, caching behavior
- orm.drizzle.team + Drizzle-vs-Prisma 2026 comparisons - ORM choice, driver guidance
- Better Auth docs + 2026 auth comparisons (Wisp, MakerKit, WorkOS, PkgPulse) - greenfield auth default, Argon2id, Drizzle adapter
- Project PROJECT.md + SUMMARY.md - scoring formula, item schema, scope, success metric (source of truth)
- OWASP Broken Access Control / Server Actions security guidance - IDOR, public-endpoint hazards

### Secondary (MEDIUM confidence)
- Zod v4 + RHF + @hookform/resolvers v5 guides - versions/compatibility
- ui.shadcn.com + Tailwind v4 migration guides - mobile-first UI
- Grocery/wishlist/prioritization app research (AnyList, Listonic, Todoist, RICE/WSJF, Ducalis) - competitive feature landscape
- Next.js project-structure and Server-Actions-vs-Route-Handlers guides (groovyweb, makerkit, pean.dev)

### Tertiary (LOW confidence)
- Exact patch versions across libraries - drift over time; pin at install
- Badge/score-presentation UX heuristics (UX Movement, NN/g) - inference applied to the trust metric

---
*Research completed: 2026-07-26*
*Ready for roadmap: yes*
