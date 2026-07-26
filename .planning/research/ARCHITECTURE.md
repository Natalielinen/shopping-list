# Architecture Research

**Domain:** Next.js full-stack multi-user CRUD app with a deterministic priority-scoring engine (shopping list)
**Researched:** 2026-07-26
**Confidence:** HIGH (structure & patterns) / MEDIUM (specific auth library — landscape shifted in 2025)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION (App Router)                │
├─────────────────────────────────────────────────────────────┤
│  Server Components        Client Components                   │
│  ┌────────────┐           ┌────────────┐  ┌────────────┐     │
│  │ List page  │           │ Item form  │  │  Filters   │     │
│  │ (fetch+SSR)│           │ ('use      │  │  toggles   │     │
│  └─────┬──────┘           │  client')  │  └─────┬──────┘     │
│        │                  └─────┬──────┘        │            │
├────────┼────────────────────────┼───────────────┼───────────┤
│        │       APPLICATION (server-only)         │           │
│        ▼                        ▼                ▼           │
│  ┌──────────────┐   ┌────────────────────┐                  │
│  │ Server Actions│  │  Auth / Session     │                  │
│  │ (thin wrapper)│──│  guard (Better Auth)│                  │
│  └──────┬───────┘   └─────────┬──────────┘                  │
│         │  validate (zod)      │ getSession()→userId         │
│         ▼                      ▼                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │            DOMAIN (pure, framework-free)            │     │
│  │  ┌───────────────┐   ┌──────────────────────────┐  │     │
│  │  │ scoring engine│   │ dependency / blocked rules│  │     │
│  │  │  (pure funcs) │   │  (pure funcs)             │  │     │
│  │  └───────────────┘   └──────────────────────────┘  │     │
│  └───────────────────────────┬───────────────────────┘     │
│                              │ calls                        │
│  ┌───────────────────────────▼───────────────────────┐     │
│  │        DATA ACCESS (repository, user-scoped)        │     │
│  │  every query filtered by userId — single choke point│     │
│  └───────────────────────────┬───────────────────────┘     │
├──────────────────────────────┼──────────────────────────────┤
│                    PERSISTENCE                                │
│  ┌──────────────────────────────────────────────────┐       │
│  │  PostgreSQL (Drizzle ORM)                          │       │
│  │  users │ sessions │ items (self-FK: depends_on_id) │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Server Components** | Fetch user-scoped items, compute display totals, render sorted/filtered list (SSR, mobile-first) | `app/(app)/list/page.tsx` — async RSC calling the repository directly |
| **Client Components** | Interactive form (dropdowns, conditional `monthlyPayment`), filter/sort toggles, optimistic UI | `'use client'` components; forms submit to Server Actions |
| **Server Actions** | Thin server entrypoints for mutations (create/edit/delete/complete). Auth guard → zod validate → domain → repository → `revalidatePath` | `app/**/actions.ts` marked `'use server'` |
| **Auth / Session guard** | Register/login (email+password), issue & validate DB-backed sessions, expose `getCurrentUser()` | Better Auth + argon2id hashing |
| **Scoring engine (domain)** | Compute per-field points and `total` from item selections + a **injected** current date. No I/O. | Pure TS module `src/domain/scoring/` |
| **Dependency rules (domain)** | Derive `blocked` state; validate legal completion / dependency links | Pure TS functions in `src/domain/dependencies/` |
| **Data access (repository)** | All CRUD; **every** query scoped by `userId`. Single place isolation is enforced | `src/server/repos/items.ts` (Drizzle) |
| **Persistence** | Store users, sessions, items; enforce FK integrity for dependencies | PostgreSQL via Drizzle schema + migrations |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router (routing + UI only)
│   ├── (auth)/                   # route group: login, register (no app chrome)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                    # route group: authenticated area
│   │   ├── layout.tsx            # session guard + mobile shell
│   │   ├── list/page.tsx         # RSC: fetch + render sorted list
│   │   └── items/
│   │       ├── new/page.tsx
│   │       └── [id]/edit/page.tsx
│   ├── api/
│   │   └── auth/[...all]/route.ts# Better Auth handler (machine-facing)
│   └── layout.tsx                # root layout, fonts, viewport (mobile-first)
├── actions/                      # 'use server' — thin mutation wrappers
│   └── items.ts                  # create/update/delete/toggleComplete
├── domain/                       # PURE, framework-free, 100% unit-tested (TDD)
│   ├── scoring/
│   │   ├── scales.ts             # category/urgency/need/benefit/doubts point maps
│   │   ├── scoring.ts            # calculateScore(item, today) → breakdown+total
│   │   └── scoring.test.ts       # ← written first (TDD)
│   ├── dependencies/
│   │   ├── blocked.ts            # isBlocked(item, byItem) / canComplete()
│   │   └── blocked.test.ts
│   └── item.ts                   # domain types, enums, zod schemas
├── server/                       # server-only integration layer
│   ├── db/
│   │   ├── schema.ts             # Drizzle tables (users, sessions, items)
│   │   ├── client.ts             # pooled db connection
│   │   └── migrations/
│   ├── repos/
│   │   └── items.ts              # user-scoped queries (isolation choke point)
│   └── auth.ts                   # Better Auth config + getCurrentUser()
├── components/                   # shared UI (mobile-first)
│   ├── ItemForm.tsx
│   ├── ItemCard.tsx
│   └── FilterBar.tsx
└── lib/                          # generic utils (dates, formatting)
```

### Structure Rationale

- **`domain/` is isolated from Next.js and the DB.** It imports nothing from `next`, `react`, or Drizzle. This is the single most important boundary: the scoring engine and dependency rules are pure functions that can be unit-tested with zero setup, satisfying the TDD constraint. It is also where the fixed point scales live, so the "source of truth for points" is one testable place.
- **`actions/` are thin.** Server Actions are hard to unit-test in isolation (they depend on `cookies`, `revalidatePath`, `headers`). Keeping them to "auth → validate → call domain → call repo → revalidate" means the logic worth testing lives in `domain/` and `server/repos/`, not in the action.
- **`server/repos/` is the only place that touches items in the DB.** Data isolation is enforced here and nowhere else, so it cannot be forgotten in one route.
- **Route groups `(auth)` / `(app)`** separate the unauthenticated shell from the authenticated shell and let the `(app)/layout.tsx` act as a single session gate.
- **`src/` prefix** keeps app code separate from config; standard Next.js 15 convention.

## Architectural Patterns

### Pattern 1: Pure scoring engine with injected clock

**What:** `total` is computed by a pure function that takes the item's selections **and the current date** as arguments and returns a full breakdown. It performs no I/O and reads no global clock.
**When to use:** Always here — it is the core testable unit and the deadline component is time-dependent.
**Trade-offs:** You must pass `today` in from the caller (a tiny bit more plumbing) in exchange for fully deterministic, trivially-testable scoring.

**Example:**
```typescript
// domain/scoring/scoring.ts  (no next/react/db imports)
export interface ScoreBreakdown {
  category: number; urgency: number; need: number; benefit: number;
  deadline: number; credit: number; doubts: number; total: number;
}

export function calculateScore(item: ScorableItem, today: Date): ScoreBreakdown {
  const category = CATEGORY_POINTS[item.category];
  const urgency  = URGENCY_POINTS[item.urgency];
  const need     = NEED_POINTS[item.need];
  const benefit  = BENEFIT_POINTS[item.benefit];
  const deadline = deadlinePoints(item.deadline, today);      // 28 − daysUntil, clamp[-100,100]
  const credit   = item.isCredit ? -2 : 0;
  const doubts   = DOUBTS_POINTS[item.doubts ?? 'none'];      // 0 / -1 / -3
  const total = category + urgency + need + benefit + deadline + credit + doubts;
  return { category, urgency, need, benefit, deadline, credit, doubts, total };
}
```

### Pattern 2: Compute `total` on read, not on write

**What:** Persist only the raw user selections (+ `deadline` date). Recompute `deadlinePoints` and `total` at read time via the scoring engine, then sort.
**When to use:** Here, because `deadlinePoints = 28 − days_until_deadline` changes every day — a `total` written at insert time silently goes stale and would corrupt the default sort.
**Trade-offs:** Recompute cost per read (negligible for personal/family lists — tens to low-hundreds of rows per user). At larger scale you can denormalize a stored `basePoints` (the time-invariant sum) and only add `deadlinePoints(today)` at read to enable pure-SQL sorting — see Scaling.

**Example:**
```typescript
// in the list RSC / repo read path
const rows = await itemsRepo.findAllForUser(userId);
const today = startOfDay(new Date());
const scored = rows.map(r => ({ ...r, score: calculateScore(r, today) }));
scored.sort((a, b) => b.score.total - a.score.total);   // default sort
```

### Pattern 3: User-scoped repository as the isolation choke point

**What:** Every data-access function takes `userId` as a required argument and includes it in the `WHERE` clause. UI/actions never build ad-hoc queries.
**When to use:** Every multi-tenant read/write. Non-negotiable for data isolation.
**Trade-offs:** Slightly more ceremony (userId threaded everywhere) vs. a guarantee that one forgotten filter can't leak another user's list.

**Example:**
```typescript
// server/repos/items.ts
export async function findAllForUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}
export async function updateForUser(userId: string, id: string, patch: ItemPatch) {
  // userId in WHERE prevents editing someone else's row via a guessed id
  return db.update(items).set(patch)
    .where(and(eq(items.id, id), eq(items.userId, userId)));
}
```

### Pattern 4: Dependency modeled as a self-referencing FK, `blocked` derived

**What:** `items.depends_on_id` is a nullable FK to `items.id`. "Blocked" is **not stored** — it is derived: an item is blocked when it has a dependency and that dependency is not `completed`. Completion of a blocked item is rejected in the domain layer.
**When to use:** Here — a stored `blocked` flag would need to be updated whenever the parent is completed/deleted and would drift; deriving it keeps one source of truth.
**Trade-offs:** A join (or second lookup) on read to know the parent's `completed` state. Must guard against self-dependency and (optionally) cycles at write time.

**Example:**
```typescript
// domain/dependencies/blocked.ts
export function isBlocked(item: Item, dependsOn: Item | null): boolean {
  return item.dependsOnId != null && dependsOn != null && !dependsOn.completed;
}
export function canComplete(item: Item, dependsOn: Item | null): boolean {
  return !isBlocked(item, dependsOn);   // enforced in toggleComplete action
}
```

## Data Model

```sql
users (
  id            uuid PK,
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,          -- argon2id
  created_at    timestamptz
)
sessions (
  id         text PK,
  user_id    uuid FK → users.id ON DELETE CASCADE,
  expires_at timestamptz NOT NULL       -- DB-backed sessions (Better Auth)
)
items (
  id             uuid PK,
  user_id        uuid FK → users.id ON DELETE CASCADE,   -- isolation key, INDEXED
  title          text NOT NULL,
  category       text NOT NULL,   -- CategoryType enum
  urgency        text NOT NULL,   -- UrgencyType enum
  need           text NOT NULL,   -- NeedType enum
  benefit        text NOT NULL,   -- BenefitType enum
  doubts         text NOT NULL DEFAULT 'none',  -- DoubtsType enum
  is_credit      boolean NOT NULL DEFAULT false,
  monthly_payment numeric,        -- shown only when is_credit
  price          numeric,
  link           text,
  description    text,
  deadline       date,            -- drives deadlinePoints at read time
  completed      boolean NOT NULL DEFAULT false,   -- true → archived
  depends_on_id  uuid FK → items.id ON DELETE SET NULL,  -- self-reference
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz
)
-- indexes: items(user_id), items(user_id, completed), items(depends_on_id)
```

**Enum representation:** store enum *keys* (e.g. `'health'`, `'urgent'`) as text/pg-enum, not point values. Points live in `domain/scoring/scales.ts` so the fixed v1 scales are versioned in code and can evolve (v2 "custom scales") without a data migration of every row.

**`total`/`deadlinePoints`:** treated as derived (computed on read). Do **not** add a stored `total` column in v1; if you need SQL-side sorting later, add a stored `base_points` (time-invariant) and add `deadlinePoints(today)` at query time.

**Dependency integrity:** `ON DELETE SET NULL` on `depends_on_id` so deleting a parent unblocks dependents instead of cascading deletes. Reject self-dependency (`depends_on_id != id`) and cross-user references (parent must belong to same `user_id`) in the write action.

## Data Flow

### Request Flow (mutation — add item)

```
[User submits ItemForm (client)]
      ↓  form action
[Server Action createItem]  ── getCurrentUser() → userId (401 if none)
      ↓  zod parse (title required, conditional monthlyPayment)
[domain: calculateScore(input, today)]  (optional preview; source of truth is read-time)
      ↓
[repo.insertForUser(userId, input)]
      ↓
[PostgreSQL INSERT]
      ↓
[revalidatePath('/list')]  → RSC re-renders sorted list
```

### Request Flow (read — list)

```
[GET /list  (Server Component)]
      ↓  session guard in (app)/layout.tsx → userId
[repo.findAllForUser(userId)]  (+ join/lookup depends_on for blocked state)
      ↓
[domain: calculateScore(row, today) for each]  → total
[domain: isBlocked(row, parent)]              → blocked flag
      ↓
[sort by filter (total desc | created_at | alpha)]
[apply "show completed" filter]
      ↓
[render ItemCard list (mobile-first)]
```

### Key Data Flows

1. **Scoring:** raw selections in DB → pure engine at read → `total` → sort. Never trusts a stored total.
2. **Isolation:** session cookie → `getCurrentUser()` → `userId` → repository `WHERE user_id = ?` on every query.
3. **Blocking:** `depends_on_id` → parent lookup → derived `blocked` → completion guarded in action.

## Suggested Build Order

Order is driven by dependencies between components; the pure domain layer can and should come first because it needs no infrastructure and is the TDD centerpiece.

1. **Foundation** — Next.js 15 + TS + Drizzle + Postgres + Vitest test harness; `users`/`items` schema + migrations. *(enables everything)*
2. **Scoring engine (`domain/scoring/`)** — TDD, pure, no DB/auth. Point scales + `calculateScore` + `deadlinePoints` (injected clock). Fully unit-tested in isolation. *(depends on: nothing but the schema types — ideal first vertical)*
3. **Auth + session boundary** — Better Auth email/password (argon2id), DB sessions, `getCurrentUser()`, `(app)` route-group guard. *(depends on: users table)*
4. **User-scoped repository + item CRUD** — repo functions with `userId` everywhere; create/edit/delete Server Actions wired to zod + scoring. *(depends on: auth for userId, schema)*
5. **List view: sort/filter + completed/archive** — default total-desc sort, alpha/creation filters, "show completed" toggle. *(depends on: CRUD + scoring)*
6. **Dependencies (depends → blocked)** — self-FK, derived blocked state, completion guard, same-user/self-ref validation. *(depends on: items existing so a parent can be referenced)*

> Rationale: 2 before 3/4 because a pure module is the fastest thing to TDD and de-risks the core value (priority correctness) before any infra exists. 6 is last because it references other items and needs the CRUD + list already working.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (target) | Monolithic Next.js on one region + single Postgres. Compute `total` on read in app memory — lists are tiny. No caching needed. |
| 1k–100k users | Add connection pooling (PgBouncer / serverless-friendly driver). If sorting large lists, denormalize `base_points` and sort in SQL (`ORDER BY base_points + deadline_expr`). Add index on `(user_id, completed)`. |
| 100k+ users | Read replicas; consider materialized `total` refreshed by a daily job (since only `deadlinePoints` drifts daily). Cache per-user list in Redis with revalidation on mutation. |

### Scaling Priorities

1. **First bottleneck:** DB connections under serverless (each function opens a connection). Fix with a pooler / HTTP driver before anything else.
2. **Second bottleneck:** recomputing/sorting large lists on every read. Fix by denormalizing `base_points` and moving sort into SQL; deadline term is a cheap expression.

## Anti-Patterns

### Anti-Pattern 1: Storing `total` at write time

**What people do:** Persist a `total` column computed when the item is created/edited.
**Why it's wrong:** `deadlinePoints` depends on the current date, so a stored total is correct only on the day it was written; the default sort silently rots.
**Do this instead:** Compute `total` on read via the pure engine (or store only the time-invariant `base_points` and add the deadline term at read).

### Anti-Pattern 2: Putting scoring logic inside Server Actions / components

**What people do:** Inline the point math in the form handler or the React component.
**Why it's wrong:** Couples the core logic to Next.js internals → hard to TDD, duplicated between create/edit/list, easy to diverge.
**Do this instead:** One pure `domain/scoring` module imported everywhere; actions/components stay thin.

### Anti-Pattern 3: Filtering by user in the UI or per-route instead of the repository

**What people do:** Fetch broadly and filter by `userId` in the component, or re-add the `WHERE user_id` in each route.
**Why it's wrong:** One missed filter leaks another user's list; auditability is poor.
**Do this instead:** Repository is the only DB entrypoint and requires `userId` on every function signature.

### Anti-Pattern 4: Storing a `blocked` boolean

**What people do:** Persist `blocked` and try to keep it in sync when parents are completed/deleted.
**Why it's wrong:** Drifts whenever the parent changes through any path; extra write coordination.
**Do this instead:** Derive `blocked` from the parent's `completed` state at read; guard completion in the action.

### Anti-Pattern 5: Trusting the item `id` in mutations without the user scope

**What people do:** `UPDATE items WHERE id = ?` from a Server Action.
**Why it's wrong:** A user can edit/delete another user's item by guessing/altering an id (IDOR).
**Do this instead:** Always `WHERE id = ? AND user_id = ?`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Drizzle ORM + pooled driver | Use a serverless-compatible pool if deploying to Vercel/edge; run migrations in CI, not at runtime. |
| Better Auth | Mounted at `app/api/auth/[...all]/route.ts` + server config | argon2id via `@node-rs/argon2`; DB-backed sessions; email/password enabled. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server Action ↔ domain | direct function call | Action passes validated input + `today`; domain returns pure results. |
| domain ↔ data access | **none** (one-way) | Domain never imports repo/DB; repo may import domain types only. Keeps domain pure. |
| RSC/Action ↔ repository | direct call with `userId` | Session resolved before repo call; `userId` always passed. |
| Client ↔ Server | Server Actions (mutations), RSC props (reads) | Route Handlers reserved for machine callers (auth endpoints); not used for internal CRUD. |

## Sources

- [Next.js 15 Server Actions vs Route Handlers — makerkit](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) (MEDIUM)
- [Next.js Server Actions vs API Routes rules — pean.dev](https://www.pean.dev/blog/server-actions-vs-api-routes-in-nextjs-rules-i-use) (MEDIUM)
- [Next.js 15 Project Structure full-stack guide — groovyweb](https://www.groovyweb.co/blog/nextjs-project-structure-full-stack) (MEDIUM)
- [Lucia Auth is Dead — what's next — Wisp CMS](https://www.wisp.blog/blog/lucia-auth-is-dead-whats-next-for-auth) (HIGH — corroborated by multiple sources on deprecation + Better Auth recommendation)
- [Best Next.js Auth Solutions 2026 — PkgPulse](https://www.pkgpulse.com/guides/best-nextjs-auth-solutions-2026) (MEDIUM)
- [Drizzle vs Prisma 2026 — Bytebase](https://www.bytebase.com/blog/drizzle-vs-prisma/) (MEDIUM)
- [Drizzle vs Prisma 2026 practical comparison — makerkit](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) (MEDIUM)
- Project `SUMMARY.md` and `PROJECT.md` — item schema, point scales, fixed constraints (HIGH, source of truth)

---
*Architecture research for: Next.js full-stack multi-user shopping list with priority scoring*
*Researched: 2026-07-26*
