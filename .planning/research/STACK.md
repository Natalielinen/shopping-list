# Stack Research

**Domain:** Multi-user, mobile-first CRUD web app (shopping list with automatic priority scoring) — Next.js full-stack + PostgreSQL, TDD
**Researched:** 2026-07-26
**Confidence:** HIGH (architecture/library choices); MEDIUM (exact patch versions — pin at install time)

> The framework direction (Next.js App Router + TypeScript, API via Next.js, PostgreSQL, email/password multi-user, TDD) is **already decided** and is NOT re-litigated here. This document makes that stack concrete: which library for each concern, which version, why, and what to avoid.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js (App Router)** | `16.x` (latest 16.2.x, Turbopack default) | Full-stack framework: RSC, routing, Server Actions, API/route handlers | Decided. v16 App Router is production-standard in 2026; Server Actions remove the need for a separate API layer for CRUD. |
| **React** | `19.2` (ships with Next 16) | UI runtime | Bundled with Next 16; RSC + `useActionState`/`useOptimistic` support the Server-Action data flow below. |
| **TypeScript** | `5.x` (latest) | Type safety end-to-end | Decided. One language across schema → validation → UI. |
| **Node.js** | `22 LTS` (min `20.9+`) | Runtime | Next 16 baseline; 22 is the active LTS through this project's life. |
| **PostgreSQL** | `16` or `17` | Relational store; per-user data isolation | Decided. Strong for the relational needs here (users → items, `depends` self-reference FK). |
| **Drizzle ORM** | `drizzle-orm ^0.44.x` | Type-safe DB access | Lightweight (~no binary engine), SQL-first, excellent TS inference, tiny cold start. Schema is the source of truth and doubles as the type layer for the item schema. See "ORM decision" below. |
| **drizzle-kit** | `^0.31.x` | Migrations + schema tooling | First-party migration generator/runner for Drizzle (`generate` → `migrate`). Deterministic SQL migrations checked into git. |
| **Better Auth** | `^1.6.x` | Email/password multi-user auth + sessions | The 2026 greenfield default for self-hosted Next.js auth. Built-in `emailAndPassword`, Argon2id hashing, DB sessions in your own Postgres, first-party Drizzle adapter + Next.js handler. See "Auth decision" below. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **postgres** (postgres.js) | `^3.4.x` | Postgres driver for Drizzle | Default driver for a normal Postgres connection (VPS/Docker/managed). Pair with `drizzle-orm/postgres-js`. |
| **@neondatabase/serverless** | `^1.x` | HTTP/WebSocket Postgres driver | **Only if** deploying serverless on Vercel + Neon — wins on cold-start latency. Swap the Drizzle adapter import; app code unchanged. |
| **Zod** | `^4.x` (4.4+) | Schema validation + type inference | The single source of truth for item validation. One schema validates the **form (client)** and the **Server Action (server)**, and infers the TS type. Pure functions → ideal TDD targets. |
| **React Hook Form** | `^7.x` (latest 7.8x) | Form state + submission | Add/edit item forms. Minimal re-renders on mobile; integrates with Zod via resolver. |
| **@hookform/resolvers** | `^5.x` | Bridges Zod ↔ RHF | Required to wire Zod schema into RHF; v5 auto-detects Zod 4. |
| **Tailwind CSS** | `^4.x` | Mobile-first utility styling | CSS-first config (`@theme`), automatic content detection, first-class responsive prefixes for mobile-first layout. |
| **shadcn/ui** | latest CLI (registry components) | Accessible component primitives (Select, Dialog, Form, Checkbox, Input) | Copy-in components built on Radix + Tailwind — you own the code. Covers the dropdowns (category/urgency/need/benefit/doubts), form, and archive dialog. |
| **nuqs** | `^2.x` | Type-safe URL search-param state | Persist sort filter (priority / date-added / alphabetical) and "show purchased" toggle in the URL — shareable, back-button friendly, no global store. |
| **@tanstack/react-query** | `^5.x` | Client cache / optimistic updates | **Optional / defer.** Only if v1 needs client-side optimistic "mark purchased" / re-fetch beyond what Server Actions + `useOptimistic` give. Not required for MVP. |
| **date-fns** | `^4.x` | Date math for `deadlinePoints` | Compute `days_until_deadline` for the `28 − days` formula. Small, tree-shakeable, pure — unit-testable. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | Unit + integration test runner | `^3.x`. TDD default in 2026; Vite-native, fast watch, Jest-compatible API. Runs the scoring logic, Zod schemas, Server Actions (as plain functions), and client components. |
| **React Testing Library** | Component behavior tests | `@testing-library/react ^16.x` + `@testing-library/user-event ^14.x` + `@testing-library/jsdom`. Test form interaction and list rendering. |
| **Playwright** | End-to-end / browser tests | `@playwright/test ^1.x`. Covers auth flows, async Server Components (which Vitest cannot render), cookies/middleware, and full add→sort→complete journeys. |
| **@vitejs/plugin-react** + **vite-tsconfig-paths** | Vitest/React + path aliases | Standard Vitest-for-Next config per Next.js official Vitest guide. |
| **ESLint** (`eslint-config-next`) + **Prettier** | Lint + format | Ships with `create-next-app`. |
| **tsx** or `dotenv` | Run migration/seed scripts | For `drizzle-kit` scripts and DB seeding. |

---

## Installation

```bash
# Scaffold (App Router + TS + Tailwind v4 + ESLint)
npx create-next-app@latest shopping-list --typescript --app --tailwind --eslint

# DB + ORM + migrations
npm install drizzle-orm postgres
npm install -D drizzle-kit

#   (serverless-on-Neon variant instead of `postgres`):
# npm install @neondatabase/serverless

# Auth (email/password, DB sessions, Argon2id)
npm install better-auth

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# URL filter state + dates
npm install nuqs date-fns

# UI components (interactive CLI adds Radix-based components you own)
npx shadcn@latest init

# Testing (TDD)
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D @playwright/test && npx playwright install

# Optional client cache (defer unless MVP needs client-side optimistic UX)
# npm install @tanstack/react-query
```

---

## Key Decisions (rationale)

### ORM decision — Drizzle over Prisma
- **Drizzle**: no separate binary query engine, no codegen step in the dev loop, ~33KB, SQL-first with full type inference. The Postgres schema (users, items, self-referencing `depends` FK) is defined in TS and *is* the type source. Migrations via `drizzle-kit generate`/`migrate` are plain, reviewable SQL.
- Prisma is a legitimate alternative (gentler for teams new to SQL, automated migrations, Prisma Studio) — but its heavier engine and codegen add friction for a small solo/family app and its multi-DB abstraction hides Postgres-native features. **Recommendation: Drizzle.**

### Auth decision — Better Auth over NextAuth/Auth.js
- For **greenfield in 2026, do not start on NextAuth/Auth.js**. Better Auth is the current default: it ships email/password out of the box (`emailAndPassword: { enabled: true }`), hashes with **Argon2id**, stores users/sessions/accounts/verification in *your* Postgres via the first-party Drizzle adapter, and exposes endpoints through one Next.js catch-all route (`toNextJsHandler`).
- It covers future needs as plugins (2FA, magic links, rate limiting) without a rewrite. NextAuth lacks built-in MFA and its ecosystem is consolidating toward Better Auth.
- **Requires** `BETTER_AUTH_SECRET` (≥32 chars, `openssl rand -base64 32`). Data isolation: every item query is scoped by the authenticated `userId` from the session — enforce this in the data layer, not just the UI.

### Data flow decision — Server Actions first, TanStack Query optional
- Reads: **React Server Components** load the user's list on the server (fast first paint on mobile). Writes (add/edit/delete/mark-complete): **Server Actions** validated by the shared Zod schema, with `useOptimistic` for snappy "mark purchased".
- Sort/filter (priority / date-added / alphabetical, show-purchased): **`nuqs` URL state** + server-side ordering, or trivial client sort of the small per-user list. No Redux/Zustand needed for server data.
- Add TanStack Query **only** if client-side caching/optimistic patterns outgrow Server Actions — not for MVP.

### Testing decision — layered TDD (Vitest + RTL + Playwright)
- **Pure logic (the heart of TDD here):** priority scoring — category/urgency/need/benefit points, `doubts` (0/−1/−3), `isCredit` (−2), `deadlinePoints = clamp(28 − days, −100, 100)`, and `total` = sum — as **pure functions** unit-tested in **Vitest**. Write these tests first; the scoring spec in `SUMMARY.md` maps directly to test cases.
- **Schema/validation:** Zod schemas unit-tested in Vitest.
- **Components & forms:** RTL + user-event in Vitest (dropdowns, conditional `monthlyPayment` when `isCredit`, `depends` blocking).
- **Flows / async Server Components / auth / DB-scoping:** Playwright (Vitest cannot render async Server Components).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Drizzle ORM | Prisma `7.x` | Team prefers higher-level abstraction, Prisma Studio, or auto-migrations over SQL control. |
| Better Auth | Auth.js/NextAuth `v5` | Only if migrating an existing NextAuth codebase — not for greenfield. |
| Better Auth (self-host) | Clerk / Supabase Auth | If you want a hosted/managed auth surface and are fine outsourcing user storage. |
| postgres.js driver | `pg` (node-postgres) | Long-running (non-serverless) server where a persistent `pg.Pool` is fine; `pg-native` gives ~10% boost. |
| postgres.js driver | `@neondatabase/serverless` | Serverless deploy on Neon/Vercel — HTTP driver wins cold starts. |
| Server Actions + nuqs | TanStack Query `v5` | Heavy client-side caching/optimistic/polling needs beyond MVP. |
| Vitest | Jest | Only if inheriting a Jest suite; new projects use Vitest. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| NextAuth/Auth.js for greenfield | No built-in MFA, ecosystem consolidating toward Better Auth; more boilerplate for email/password + DB sessions | **Better Auth** |
| Hand-rolled password hashing / JWT-in-localStorage | Easy to get wrong (salting, algorithm, XSS token theft) | Better Auth (Argon2id + httpOnly cookie sessions) |
| Prisma `pg.Pool` **or** any `pg.Pool` inside serverless functions | Connections aren't reused between invocations → exhaustion | Neon serverless HTTP driver, or PgBouncer with a standard driver |
| Jest | Slower, extra ESM/TS config vs Vite-native runner; Next.js docs standardize on Vitest | **Vitest** |
| Redux / Zustand for server data | Adds a client store to cache what RSC/Server Actions already provide | Server Components + Server Actions (+ `nuqs` for filter state) |
| Formik | Stagnant, heavier re-renders, weaker TS story | **React Hook Form** |
| Yup / Joi | Weaker TS inference; can't infer types back into the app | **Zod v4** (schema → inferred type, shared client+server) |
| styled-components / Emotion (runtime CSS-in-JS) | Poor RSC compatibility, runtime cost on mobile | **Tailwind v4** (+ shadcn/ui) |
| Full component libraries (MUI/Chakra) for this app | Heavier bundle, harder mobile-first customization, less code ownership | **shadcn/ui** (copy-in, Radix-based, accessible) |

---

## Stack Patterns by Variant

**If deploying serverless (Vercel + Neon):**
- Use `@neondatabase/serverless` with `drizzle-orm/neon-http` (or `neon-serverless` for transactions).
- Never instantiate a long-lived pool; create the client per request.

**If deploying to a VPS / Docker / long-running Node server:**
- Use `postgres` (postgres.js) with `drizzle-orm/postgres-js`, or `pg` with a shared pool.
- Run `drizzle-kit migrate` on deploy.

**If MVP needs client-side optimistic UX beyond Server Actions:**
- Add `@tanstack/react-query v5`: prefetch in a Server Component, hand off via `HydrationBoundary`, new `QueryClient` per request on the server.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js `16.x` | React `19.2`, Node `20.9+`/`22 LTS`, TypeScript `5.x` | React bundled; Turbopack is the default bundler. |
| `@hookform/resolvers ^5` | Zod `4.x` (and `3.x`) | v5 auto-detects Zod version; use `zodResolver` as before. |
| React Hook Form `7.x` | React `19.2` | Confirm resolver version if adopting a future RHF `v8`. |
| Tailwind `4.x` | shadcn/ui (current registry) | shadcn migrated to v4 (OKLCH colors, CSS-var format changes) — init a fresh v4 project rather than porting v3 config. |
| drizzle-orm `0.44.x` | drizzle-kit `0.31.x`, Better Auth Drizzle adapter | Keep orm + kit versions in step; regenerate migrations after schema edits. |
| Vitest `3.x` | `@vitejs/plugin-react`, RTL `16.x` | Cannot render async Server Components → cover those in Playwright. |

---

## Sources

- nextjs.org/blog + Next.js docs (Vitest testing guide) — Next 16 / React 19.2 / Turbopack default; Vitest as recommended runner — HIGH
- orm.drizzle.team + multiple 2026 Drizzle-vs-Prisma comparisons (Bytebase, MakerKit, TurboStarter) — Drizzle recommendation, driver guidance — HIGH
- Better Auth docs + MakerKit / WorkOS / LogRocket 2026 auth comparisons — Better Auth as greenfield default, Argon2id, Drizzle adapter, `toNextJsHandler` — HIGH
- Zod v4 + React Hook Form + `@hookform/resolvers` v5 2026 guides (noqta, DEV) — versions & compatibility — MEDIUM (patch versions drift)
- ui.shadcn.com + Tailwind v4 migration guides — Tailwind v4 + shadcn/ui for mobile-first — HIGH
- TanStack Query v5 docs (advanced SSR) — Server Component prefetch + HydrationBoundary — HIGH
- Neon/Drizzle serverless guides + PkgPulse 2026 driver comparison — postgres.js vs pg vs Neon serverless, no pg.Pool in serverless — MEDIUM/HIGH

---
*Stack research for: multi-user mobile-first Next.js + PostgreSQL shopping-list app (TDD)*
*Researched: 2026-07-26*
