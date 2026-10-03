# Phase 1: Фундамент и аутентификация - Research

**Researched:** 2026-07-26
**Domain:** Next.js 16 App Router full-stack auth (Better Auth email/password) + Drizzle/Postgres + per-user data-isolation boundary, TDD
**Confidence:** HIGH (wiring, versions, route protection verified against official docs + npm registry); MEDIUM (a few Better Auth defaults that CONTEXT/CLAUDE.md stated incorrectly — see Assumptions/Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Поля регистрации — только `email` + `password`. Отображаемое имя не запрашиваем; в шапке показываем email. (Reversibility: costly — later adding a required `name` needs a Better Auth schema migration + form/header update.)
- **D-02:** Верификация email в v1 не требуется — после регистрации пользователь сразу авторизован (без email-провайдера/SMTP).
- **D-03:** Минимальная длина пароля — 8 символов.
- **D-04:** После успешной регистрации — автоматический вход (создаётся сессия) и редирект на личный список, без промежуточного экрана.
- **D-05:** Корневой URL `/` для неавторизованного посетителя — редирект на `/login`. Отдельного лендинга нет. (Reversibility: reversible.)
- **D-06:** Пустой список в Фазе 1 — заглушка (empty state). Реальной формы/кнопки добавления в Фазе 1 нет.
- **D-07:** При отсутствии/истечении сессии на защищённой странице — редирект на `/login` (без промежуточного сообщения).
- **D-08:** Минимальная общая шапка (layout): название приложения + email пользователя + кнопка «Выйти».
- **D-09:** После выхода — на `/login`; сессия очищается.
- **D-10:** Чекбокса «Запомнить меня» нет — всегда длинная persistent-сессия (покрывает AUTH-02).
- **D-11:** Срок жизни сессии — 30 дней. ⚠️ **Correction:** CONTEXT states this is the Better Auth default; it is **not** — the actual default is **7 days**. The 30-day lifetime is honored, but the plan MUST set `session.expiresIn` explicitly (see Architecture Pattern 4).

### Claude's Discretion
- Язык интерфейса — русский (UI-copy на русском; код/идентификаторы/пути — на английском).
- Тексты ошибок: логин — обобщённое «Неверный email или пароль» (без раскрытия существования аккаунта); регистрация — «Этот email уже занят». Прочие формулировки — единый тон (see UI-SPEC Copywriting Contract for the locked strings).
- Точная структура маршрутов (`/login`, `/register`/`/signup`, `/list` или `/`) — на усмотрение планировщика, при соблюдении D-05…D-09.
- Механизм защиты маршрутов (middleware/proxy vs проверка сессии в серверном компоненте/layout) — на усмотрение планировщика (see Architecture Pattern 3 for the prescriptive recommendation).

### Deferred Ideas (OUT OF SCOPE)
- Верификация email / восстановление пароля / 2FA / magic links — Better Auth plugins, future phases (not v1).
- Рейт-лимит попыток входа — not in Phase 1 (Better Auth plugin later if needed).
- Отображаемое имя пользователя и приветствие по имени — separate later change (D-01, needs migration).
- Форма добавления покупки, движок очков, любой CRUD/сортировки/фильтры/архив — Phases 2–5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Регистрация по email + паролю | Better Auth `emailAndPassword: { enabled: true }` + `signUpEmail`; auto-login via default `autoSignIn: true` (D-04). Zod schema validates email/8-char password (D-03). |
| AUTH-02 | Вход + сессия сохраняется между перезагрузками | Better Auth DB-backed sessions in Postgres via Drizzle adapter; httpOnly cookie persists; `session.expiresIn = 30d` (D-11). Session survives reload — verified by RSC `getSession()` on each request. |
| AUTH-03 | Выход из аккаунта | Better Auth `signOut` (clears session + cookie via `nextCookies` plugin); redirect to `/login` (D-09). |
| AUTH-04 | Изоляция данных по userId в слое данных | `getCurrentUser()` server helper resolves `userId` from session; user-scoped repository is the single DB choke point (`WHERE user_id = ?`). Two-user isolation test (Success Criterion #4). |
</phase_requirements>

## Summary

This phase is a **Walking Skeleton**: scaffold Next.js 16 + Drizzle/Postgres + Better Auth, deliver register → login → logout → protected empty list, and — most importantly — **establish the per-user data-isolation seam** that every later CRUD phase depends on. The auth wiring itself is small and well-trodden; the durable value of Phase 1 is the *architecture boundary* (session → `userId` → user-scoped repository) and the *test harness* (Vitest + Playwright against a real Postgres) that proves isolation.

Three factual corrections to the inherited stack docs must reach the planner: (1) Better Auth's **default session is 7 days, not 30** — the 30-day decision requires an explicit `session.expiresIn`; (2) Better Auth's **default password hashing is scrypt, not Argon2id** — honoring CLAUDE.md's "Argon2id" requires a custom `password.hash/verify` hasher (`@node-rs/argon2`), otherwise scrypt (an OWASP-acceptable default) ships; (3) tooling drifted since the project-level research — **Next 16.2, Vitest 4, drizzle-orm 0.45** — and **Next 16 renamed `middleware.ts` → `proxy.ts`**, which changes the route-protection recommendation.

**Primary recommendation:** Wire Better Auth with the built-in `better-auth/adapters/drizzle` adapter (`provider: "pg"`) + `nextCookies()` plugin + `toNextJsHandler` catch-all route; generate auth tables with the Better Auth CLI then `drizzle-kit generate/migrate`; enforce protection with a **server-side `getSession()` check in the `(app)` layout** (the security boundary), not middleware; and build the isolation choke point (`getCurrentUser()` + a `userId`-scoped repository over an `items` table created now) so Success Criterion #4 is a real, seeded two-user test rather than a placeholder.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Register / login / logout endpoints | API / Backend (Better Auth catch-all route handler) | — | Auth is machine-facing HTTP; Better Auth owns `/api/auth/[...all]`. |
| Password hashing + session issuance | API / Backend (Better Auth server) | Database (session/user rows) | Never client; secrets + hashing are server-only. |
| Session storage | Database / Storage (Postgres `session` table) | — | DB-backed sessions (not JWT-in-localStorage). |
| Session → `userId` resolution | Frontend Server (RSC / layout) | API/Backend helper | `auth.api.getSession({ headers })` runs server-side per request. |
| Route protection / redirect | Frontend Server (`(app)/layout.tsx` guard) | Client (optimistic `proxy.ts`, optional) | Real enforcement is the server check; middleware/proxy is optimistic only. |
| **Per-user data isolation** | **Database / Backend (user-scoped repository)** | — | Single choke point: every query filtered by `userId`. Foundation for Phases 2–5. |
| Auth forms (inputs, validation display, pending state) | Browser / Client (`'use client'` leaf components) | — | Interactivity (RHF + zod resolver); small leaf, page stays RSC. |
| App header (name + email + logout) | Frontend Server (renders from session) | Client (logout button action) | Email comes from server session; logout triggers a client action. |

## Standard Stack

> Versions **verified against the npm registry on 2026-07-26** (`npm view <pkg> version`). Pin exact versions at install; these are the current latest.

### Core
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| next | `16.2.12` | App Router, RSC, Server Actions, route handlers | Locked. Turbopack default; Node runtime for auth. `[VERIFIED: npm registry]` |
| react / react-dom | `19.2.8` (bundled with Next 16) | UI runtime | Bundled. `[VERIFIED: npm registry]` |
| typescript | `5.x` (latest) | End-to-end types | Locked. `[CITED: CLAUDE.md]` |
| better-auth | `1.6.25` | Email/password auth + DB sessions | Locked greenfield default; built-in Drizzle adapter + Next handler. `[VERIFIED: npm registry]` |
| drizzle-orm | `0.45.2` | Type-safe DB access | Locked. **Note: 0.45.x now (project research said ^0.44).** `[VERIFIED: npm registry]` |
| drizzle-kit | `0.31.10` | Migration generate/migrate | Keep in step with drizzle-orm. `[VERIFIED: npm registry]` |
| postgres (postgres.js) | `3.4.9` | Postgres driver for Drizzle | Locked driver; pair with `drizzle-orm/postgres-js`. `[VERIFIED: npm registry]` |

### Supporting
| Library | Version (verified) | Purpose | When to Use |
|---------|--------------------|---------|-------------|
| zod | `4.4.3` | Auth input validation + inferred types | One schema validates login/register form (client) AND server action (server). `[VERIFIED: npm registry]` |
| react-hook-form | `7.83.0` | Auth form state | Login/register forms; minimal re-renders on mobile. `[VERIFIED: npm registry]` |
| @hookform/resolvers | `5.5.5` | Zod ↔ RHF bridge | `zodResolver`; auto-detects Zod 4. `[VERIFIED: npm registry]` |
| server-only | `0.0.1` | Build-time guard | Mark `auth.ts` / `db/client.ts` / repository server-only so a client import fails the build. `[VERIFIED: npm registry]` |
| @node-rs/argon2 | `2.0.2` | Argon2id hasher | **Only if** honoring CLAUDE.md's Argon2id via a custom `password.hash/verify` (see Open Question 1). Otherwise omit — Better Auth's default scrypt needs no dependency. `[VERIFIED: npm registry]` |

### Development Tools (TDD — mandatory)
| Tool | Version (verified) | Purpose | Notes |
|------|--------------------|---------|-------|
| vitest | `4.1.10` | Unit/integration runner | ⚠️ **Now v4** (project research said ^3). v4 is a major bump — verify config against the current Vitest-for-Next guide. `[VERIFIED: npm registry]` |
| @vitejs/plugin-react + vite-tsconfig-paths | latest | Vitest React + path aliases | Standard Vitest-for-Next config. `[ASSUMED]` |
| @testing-library/react | `^16.x` | Component tests | Auth form render + validation display. `[CITED: CLAUDE.md]` |
| @testing-library/user-event | `^14.x` | Interaction | Type email/password, submit. `[CITED: CLAUDE.md]` |
| @testing-library/jest-dom | latest | DOM matchers | `toBeInTheDocument`, etc. `[CITED: CLAUDE.md]` |
| @playwright/test | `1.62.0` | E2E / auth flows | The primary test layer for Phase 1 (async RSC + cookies + two-user isolation). `[VERIFIED: npm registry]` |
| @better-auth/cli | `1.4.21` | Generate auth schema | `npx @better-auth/cli generate` emits the Drizzle schema for Better Auth tables. `[VERIFIED: npm registry]` |
| tsx / dotenv | latest | Run migration/seed scripts | For drizzle-kit + test-DB seeding. `[ASSUMED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-layout `getSession()` guard | `proxy.ts` (Next 16) / `middleware.ts` optimistic cookie check | Middleware/proxy is **optimistic only** (`getSessionCookie` does not validate) — never the security boundary. Use it only for a fast redirect on top of the server check. |
| Built-in `better-auth/adapters/drizzle` | `@better-auth/drizzle-adapter` (scoped pkg `1.6.25`) | The scoped split-package is the emerging v1.7 direction; the built-in subpath is confirmed in `better-auth@1.6.25` exports and matches CLAUDE.md's "first-party adapter". Prefer built-in on the locked version. |
| Default scrypt hashing | Custom Argon2id (`@node-rs/argon2`) | Argon2id is OWASP's 2024+ first choice; scrypt is the zero-dependency, edge-safe Better Auth default and OWASP-acceptable. See Open Question 1. |

**Installation:**
```bash
# Scaffold (App Router + TS + Tailwind v4 + ESLint) — Node 22 LTS
npx create-next-app@latest shopping-list --typescript --app --tailwind --eslint

# DB + ORM + migrations
npm install drizzle-orm postgres
npm install -D drizzle-kit tsx

# Auth
npm install better-auth
npm install -D @better-auth/cli
# (only if honoring CLAUDE.md Argon2id — see Open Question 1)
# npm install @node-rs/argon2

# Forms + validation
npm install react-hook-form zod @hookform/resolvers
npm install server-only

# UI (shadcn — deferred init to scaffold task per UI-SPEC)
npx shadcn@latest init   # Tailwind v4, base color neutral, CSS vars (OKLCH)
# Phase 1 components: button input label card form alert
npx shadcn@latest add button input label card form alert

# Testing (TDD)
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D @playwright/test && npx playwright install
```

## Package Legitimacy Audit

All Phase 1 packages are first-party (Vercel, Better Auth, Drizzle, TanStack-adjacent, or the official testing libs), long-lived, and high-download. All discovered from official docs / CLAUDE.md and confirmed on the npm registry.

| Package | Registry | Age / Signal | Source Repo | Verdict | Disposition |
|---------|----------|--------------|-------------|---------|-------------|
| next | npm | Vercel, weekly ~8M | vercel/next.js | OK | Approved |
| better-auth | npm | active, updated 2026-07-23 | better-auth/better-auth | OK | Approved |
| @better-auth/cli | npm | first-party CLI, 1.4.21 | better-auth/better-auth | OK | Approved |
| drizzle-orm / drizzle-kit | npm | drizzle-team, high downloads | drizzle-team/drizzle-orm | OK | Approved |
| postgres | npm | porsager, 8+ yrs | porsager/postgres | OK | Approved |
| zod | npm | colinhacks, very high | colinhacks/zod | OK | Approved |
| react-hook-form / @hookform/resolvers | npm | high downloads | react-hook-form/* | OK | Approved |
| @node-rs/argon2 | npm | napi-rs, updated 2025-05 | napi-rs/node-rs | OK | Approved (optional) |
| vitest / @playwright/test / @testing-library/* | npm | first-party test tooling | vitest-dev / microsoft / testing-library | OK | Approved |
| server-only | npm | Vercel/React, tiny guard | vercel/next.js | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: `@better-auth/drizzle-adapter` (scoped, `1.6.25`) also exists and is legitimate, but Phase 1 uses the built-in `better-auth/adapters/drizzle` subpath, so it is not installed.*

## Architecture Patterns

### System Architecture Diagram

```
[ Browser (mobile-first) ]
   │  register / login form submit ('use client' leaf: RHF + zodResolver)
   ▼
[ Server Action  or  Better Auth route /api/auth/[...all] ]
   │   authClient.signUp/signIn  →  betterAuth server
   │   (zod validates BEFORE the call; generic errors mapped for UI)
   ▼
[ Better Auth server (auth.ts) ]
   │  emailAndPassword: hash(scrypt|argon2id) → verify
   │  session issue → nextCookies() sets httpOnly cookie
   ▼
[ PostgreSQL via Drizzle (postgres.js) ]
   user │ session │ account │ verification   (Better Auth tables)
   items(user_id FK, INDEXED)                 (created now; isolation key)

--- every protected request ---
[ GET / (root) ] ──(no session)──▶ redirect /login          (D-05)
[ (app)/layout.tsx  server guard ]
   │  auth.api.getSession({ headers: await headers() })
   │  no/expired session ──▶ redirect /login                (D-07)
   ▼  userId
[ getCurrentUser() ] ──▶ [ user-scoped repository ]  WHERE user_id = userId
   ▼
[ (app)/list RSC ]  renders empty-state (D-06) + header(email, logout) (D-08)
```

### Recommended Project Structure (Phase 1 slice)
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # RSC shell → <LoginForm/> client leaf
│   │   └── register/page.tsx       # RSC shell → <RegisterForm/> client leaf
│   ├── (app)/
│   │   ├── layout.tsx              # SERVER session guard (redirect) + header
│   │   ├── loading.tsx            # skeleton (UI-SPEC)
│   │   ├── error.tsx             # data-layer failure boundary (UI-SPEC)
│   │   └── list/page.tsx          # RSC: empty-state (D-06)
│   ├── api/auth/[...all]/route.ts  # toNextJsHandler(auth)
│   ├── page.tsx                    # root: redirect (D-05)
│   └── layout.tsx                  # root layout, viewport, Geist font
├── components/
│   ├── auth/LoginForm.tsx          # 'use client' RHF + zodResolver
│   ├── auth/RegisterForm.tsx       # 'use client'
│   └── app/AppHeader.tsx           # name + email + <LogoutButton/>
├── lib/
│   ├── auth.ts                     # betterAuth() config — 'server-only'
│   ├── auth-client.ts              # createAuthClient() — client-side
│   └── validation/auth.ts          # zod schemas (email + 8-char password)
└── server/
    ├── db/
    │   ├── schema.ts               # Better Auth tables (generated) + items
    │   ├── client.ts               # drizzle(postgres(url)) — 'server-only'
    │   └── migrations/
    ├── auth/current-user.ts        # getCurrentUser()/requireUser() — 'server-only'
    └── repos/items.ts              # user-scoped read (isolation choke point)
drizzle.config.ts
vitest.config.ts
playwright.config.ts
```

### Pattern 1: Better Auth server config + Drizzle adapter + catch-all route
**What:** One `betterAuth()` instance wired to Drizzle, mounted at a single catch-all route.
**When to use:** Always — this is the Phase 1 backbone.
```typescript
// lib/auth.ts   (mark 'server-only' at the top of db/client)
// Source: better-auth.com/docs/adapters/drizzle + /docs/integrations/next
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle"; // built-in, confirmed in 1.6.25 exports
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db/client";
// import { hash, verify } from "@node-rs/argon2"; // only if honoring CLAUDE.md Argon2id

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,          // D-03 (also the default)
    // autoSignIn: true,           // D-04 — default is true; a session is created on sign-up
    requireEmailVerification: false, // D-02
    // password: {                 // OPTIONAL: Argon2id per CLAUDE.md (else default = scrypt)
    //   hash: async (password) => hash(password),
    //   verify: async ({ hash: h, password }) => verify(h, password),
    // },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,  // D-11: 30 days EXPLICIT (default is 7, not 30)
    updateAge: 60 * 60 * 24,       // refresh expiry daily on active use
  },
  plugins: [nextCookies()],        // MUST be last — auto-sets cookies in server actions
});
```
```typescript
// app/api/auth/[...all]/route.ts
// Source: better-auth.com/docs/integrations/next
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

### Pattern 2: Schema generation + migration ordering (drizzle-kit)
**What:** Better Auth defines its own tables; generate them into the Drizzle schema, then let drizzle-kit produce SQL migrations.
**When to use:** Once at setup, and after any auth-config change that adds fields/plugins.
```bash
# 1) Emit Better Auth's Drizzle schema (user, session, account, verification)
npx @better-auth/cli@latest generate      # writes schema (e.g. into src/server/db/schema.ts)
# 2) Add the app's own `items` table to the same schema.ts (foundation for Phase 2)
# 3) Generate + apply SQL migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```
**Ordering pitfall:** run `@better-auth/cli generate` **before** `drizzle-kit generate`, and regenerate whenever the auth config changes (e.g. adding a plugin), or the auth tables and the migration drift. Migrations are deterministic SQL checked into git.

### Pattern 3: Route protection — server guard is the security boundary (D-05/D-07)
**What:** Enforce auth with a server-side `getSession()` in the `(app)` layout; the root `/` redirect and any middleware/proxy check are optimistic UX only.
**When to use:** Every protected page. This is the **recommended** mechanism (CONTEXT leaves it to the planner).
```typescript
// app/(app)/layout.tsx  (Server Component — the real gate)
// Source: better-auth.com/docs/integrations/next (getSession)
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");        // D-07: no/expired session → /login
  return <AppShell email={session.user.email}>{children}</AppShell>; // D-08 header
}
```
```typescript
// app/page.tsx  (root redirect — D-05)
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
export default async function Root() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/list" : "/login");
}
```
**Trade-off vs. `proxy.ts`:** Next 16 renamed `middleware.ts` → **`proxy.ts`** (Node runtime; `middleware.ts` still works but is deprecated). Better Auth's own guidance: an optimistic `getSessionCookie(request)` check in proxy/middleware *"IS NOT SECURE… anyone can manually create a cookie to bypass it. You must always validate the session on your server."* → **For this MVP, skip proxy.ts entirely and rely on the server layout check.** Add an optional optimistic `proxy.ts` redirect later only for latency, never for enforcement.

### Pattern 4: The isolation seam — `getCurrentUser()` + user-scoped repository (AUTH-04)
**What:** A single server-only helper resolves `userId` from the session; a single repository is the only module that reads item data, and every function requires `userId` in the `WHERE`. This is the phase's most important, most durable deliverable.
**When to use:** Non-negotiable for every multi-tenant read/write from Phase 2 onward — but the seam is **built and tested now**.
```typescript
// server/auth/current-user.ts   ('server-only')
import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED"); // actions; layout uses redirect
  return user;
}
```
```typescript
// server/repos/items.ts   ('server-only') — the ONLY DB entrypoint for items
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";

// userId is REQUIRED on every signature → isolation cannot be forgotten in a route
export async function findItemsForUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}
// (Phase 2 adds insert/update/delete — always `and(eq(id), eq(userId))`)
```
**Why create the `items` table in Phase 1 (no add-form yet, D-06):** it makes Success Criterion #4 a **real, seeded two-user test** — insert a row for User A directly in the test DB, assert `findItemsForUser(B)` returns `[]` and User B's page never shows it — instead of a placeholder that proves nothing. The ARCHITECTURE build order also puts users+items schema in step 1 (Foundation). Only the read seam ships in Phase 1; writes/UI are Phase 2. *(Scope note: CONTEXT frames items as Phase 2 — creating just the table + read seam stays inside "заложить границу изоляции данных в слое данных"; flag for planner confirmation — see Open Question 2.)*

### Pattern 5: Client auth calls via `authClient` (D-04 auto-login, D-09 logout)
**What:** A browser `authClient` drives sign-up/sign-in/sign-out from the `'use client'` forms; the `nextCookies()` plugin makes the session cookie stick.
```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient(); // same-origin; baseURL optional
// usage in RegisterForm: await authClient.signUp.email({ email, password }); router.push("/list")
// usage in LogoutButton: await authClient.signOut(); router.push("/login")   // D-09
```

### Anti-Patterns to Avoid
- **Middleware/proxy as the auth boundary** — `getSessionCookie` only checks cookie *existence*, not validity. Enforce in the server component/layout. (Pitfall 6/13)
- **`"use client"` on a page/layout** to get form interactivity — keep pages RSC, push interactivity to small leaf form components; never let `DATABASE_URL`/`BETTER_AUTH_SECRET` reach a client bundle. (Pitfall 13)
- **Reading `userId` from request body/query/params** — derive it *only* from the server session. (Pitfall 5)
- **Ad-hoc item queries in routes/actions** — the repository is the single DB entrypoint; `userId` in every signature. (Anti-Pattern 3)
- **Leaking whether an account exists** — login error is always the generic «Неверный email или пароль» (UI-SPEC). Note: `autoSignIn:false`/email-verification are Better Auth's enumeration guards, but neither applies here (D-02/D-04), so enforce the generic message in the UI error mapping.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/salt loop, JWT-in-localStorage | Better Auth (scrypt default, or Argon2id via `@node-rs/argon2`) | Salting/algorithm/timing/XSS-token-theft are easy to get wrong. |
| Session management | Hand-rolled JWT + refresh logic | Better Auth DB-backed sessions + httpOnly cookie + `nextCookies()` | Rotation, expiry, invalidation, CSRF handled. |
| Auth table schema | Hand-written `user/session/account` DDL | `@better-auth/cli generate` → drizzle-kit | Guaranteed to match Better Auth's runtime expectations; drift-free. |
| Email/password validation | `if (!email.includes('@'))` | Zod schema (`z.email()`, `z.string().min(8)`) shared client+server | One source of truth; inferred types; testable. |
| Route guard plumbing | Bespoke cookie parsing | `auth.api.getSession({ headers })` in server components | Validates the session, not just cookie presence. |
| Form state / a11y | Manual `useState` per field | React Hook Form + shadcn `Form` (+ zodResolver) | Fewer re-renders, wired error display, accessible labels. |

**Key insight:** In an auth phase, almost everything security-relevant is a solved problem inside Better Auth. The *only* code worth writing (and TDD-ing) is the **thin isolation seam** (`getCurrentUser` + user-scoped repo) and the **Zod validation schemas** — plus the **two-user isolation test**. Keep your own surface tiny.

## Common Pitfalls

*(Phase-relevant subset of `.planning/research/PITFALLS.md`, plus version-specific additions.)*

### Pitfall 1: Missing per-user scoping → IDOR (PITFALLS #5)
**What goes wrong:** A query filters by `id` but not `userId`; any logged-in user reads/edits another's data by guessing an id.
**How to avoid:** `userId` from session only; every repo signature requires it; single-row ops use `and(eq(id), eq(userId))`; zero-match = 404, not silent success. Phase 1 establishes the pattern; the two-user test locks it.
**Warning signs:** any query with `where eq(id)` alone; `userId` from body/params.

### Pitfall 2: Authorization tests never written — isolation ships green (PITFALLS #12)
**What goes wrong:** Suite covers "owner reads own", never "User B must NOT read User A". IDOR ships with a passing suite.
**How to avoid:** Phase 1 delivers the two-user harness against a **real Postgres** (not a mocked ORM). This is Success Criterion #4 and the anchor Playwright/integration test.

### Pitfall 3: Server Actions/route handlers assumed "internal" (PITFALLS #6)
**What goes wrong:** A Server Action feels like a local call but is a public HTTP endpoint; forged args reach it.
**How to avoid:** First line of every action/handler = `requireUser()` + Zod validation. Never trust client-supplied `userId`.

### Pitfall 4: Client/server boundary + secret leakage (PITFALLS #13)
**What goes wrong:** Marking a page `"use client"` for form interactivity drags server code toward the client; `DATABASE_URL`/`BETTER_AUTH_SECRET` risk leaking; a `NEXT_PUBLIC_` secret is exposed by design.
**How to avoid:** Pages/layout stay RSC; interactivity in leaf client components; guard `auth.ts`/`db/client.ts`/repos with `server-only`; keep secrets unprefixed.

### Pitfall 5: Session default is 7 days, not 30 (version-specific)
**What goes wrong:** Trusting CONTEXT/CLAUDE.md that "30 days is the default" → sessions actually expire in 7 (fails D-11 / AUTH-02 durability expectations).
**How to avoid:** Set `session.expiresIn = 60*60*24*30` explicitly. Verify with a test that a session set >7 days ago is still valid (or assert the configured cookie/DB expiry).
**Warning signs:** no `session` block in `betterAuth()`.

### Pitfall 6: Default hashing is scrypt, not Argon2id (version-specific, security)
**What goes wrong:** CLAUDE.md says "Argon2id"; Better Auth's default is scrypt. Shipping the default silently deviates from the stated crypto choice.
**How to avoid:** Decide explicitly (Open Question 1). If Argon2id is required, supply `emailAndPassword.password.hash/verify` using `@node-rs/argon2`; else document that scrypt (OWASP-acceptable) is the accepted default.

### Pitfall 7: Next 16 `middleware.ts` → `proxy.ts` + Node runtime (version-specific)
**What goes wrong:** Copy-pasting a `middleware.ts` auth snippet from pre-16 tutorials; or trying full DB session validation in an Edge middleware.
**How to avoid:** Phase 1 needs no middleware/proxy (server-layout guard). If one is added later, use `proxy.ts` (Node runtime) and codemod `npx @next/codemod middleware-to-proxy .`; keep it optimistic-only.

### Pitfall 8: Migration/schema drift with Better Auth CLI (ordering)
**What goes wrong:** Editing auth config (adding a plugin/field) without regenerating → auth tables and Drizzle migrations diverge; runtime errors on unknown columns.
**How to avoid:** Re-run `@better-auth/cli generate` → `drizzle-kit generate/migrate` after any auth-config change; commit the generated SQL.

## Code Examples

### Zod auth schemas (shared client + server, TDD target)
```typescript
// lib/validation/auth.ts   (pure — unit-test first)
import { z } from "zod";
export const registerSchema = z.object({
  email: z.email({ message: "Введите корректный email" }),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});
export const loginSchema = z.object({
  email: z.email({ message: "Введите корректный email" }),
  password: z.string().min(1, "Заполните это поле"),
});
export type RegisterInput = z.infer<typeof registerSchema>;
```

### Drizzle client (server-only, postgres.js)
```typescript
// server/db/client.ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const client = postgres(process.env.DATABASE_URL!); // long-running server; single client
export const db = drizzle(client, { /* schema */ });
```

### Two-user isolation test (Success Criterion #4 anchor)
```typescript
// integration (Vitest, real test Postgres) — the repository seam
import { findItemsForUser } from "@/server/repos/items";
test("User B cannot read User A's items via the data layer", async () => {
  const a = await seedUser("a@test.dev"); const b = await seedUser("b@test.dev");
  await seedItem(a.id, { title: "A-private" });
  expect(await findItemsForUser(a.id)).toHaveLength(1);
  expect(await findItemsForUser(b.id)).toEqual([]); // isolation
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` (Edge) for interception/auth redirect | `proxy.ts` (Node runtime); `middleware.ts` deprecated | Next.js 16 (2026) | Route-protection snippets from tutorials need renaming; prefer server-layout guard anyway. |
| Vitest 3 | Vitest 4 | 2026 | Major bump; re-verify Vitest-for-Next config (plugins, environment). |
| drizzle-orm 0.44 | drizzle-orm 0.45 | 2026 | Keep drizzle-kit 0.31.x in step; regen migrations. |
| NextAuth/Lucia for email+password | Better Auth (built-in email/password, DB sessions) | 2025–26 | Confirmed greenfield default; Lucia deprecated. |
| "session = 30 days by default" (inherited doc claim) | Better Auth default is **7 days** | — | Must set `expiresIn` explicitly for 30-day (D-11). |
| "Better Auth hashes with Argon2id" (inherited doc claim) | Default is **scrypt**; Argon2id needs a custom hasher | — | Decide crypto explicitly (Open Question 1). |

**Deprecated/outdated:**
- `middleware.ts` in Next 16 — use `proxy.ts` if needed.
- Assuming Better Auth defaults for session length / hashing algorithm — both differ from the inherited stack docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `autoSignIn` defaults to `true`, so D-04 auto-login works without extra config | Pattern 1 / AUTH-01 | Low — if false, add `autoSignIn: true`; verified pattern, docs did not state default explicitly. |
| A2 | Built-in `better-auth/adapters/drizzle` (not the scoped pkg) is correct for `1.6.25` | Standard Stack / Pattern 1 | Low — confirmed present in 1.6.25 `exports`; if the CLI scaffolds the scoped import, follow the CLI. |
| A3 | `@better-auth/cli generate` writes the Drizzle schema for `provider: pg` (v4 CLI 1.4.21) | Pattern 2 | Low — output path/flags may differ slightly; verify CLI `--help` at setup. |
| A4 | Vitest 4 config for Next is materially the same as v3 (plugin-react + tsconfig-paths) | Dev Tools | Medium — v4 is a major bump; a Wave 0 task should confirm the config boots. |
| A5 | `z.email()` (Zod 4 top-level) is the current email validator API | Code Examples | Low — Zod 4.4; if using `z.string().email()` instead, both are valid. |
| A6 | Creating the `items` table in Phase 1 (read seam only) is within phase scope | Pattern 4 / Open Q2 | Medium — CONTEXT frames items as Phase 2; planner should confirm the seam scope. |

## Open Questions

1. **Password hashing: scrypt (default) vs Argon2id (CLAUDE.md)?**
   - What we know: Better Auth's default is **scrypt** (zero-dep, edge-safe, OWASP-acceptable). CLAUDE.md's stack table says **Argon2id**. Argon2id (OWASP 2024+ first choice) requires a custom `password.hash/verify` via `@node-rs/argon2`.
   - What's unclear: whether the "Argon2id" in CLAUDE.md is a hard requirement or an inherited-doc assumption.
   - Recommendation: For the MVP, **accept the scrypt default** (simplest, secure, one fewer native dep) OR add the Argon2id custom hasher if CLAUDE.md is authoritative. **Needs a one-line user/planner confirmation** — security-relevant, do not guess. Whichever is chosen, it is reversible (a config change) but a later switch re-hashes on next login only.

2. **Does Phase 1 create the `items` table + read repository, or defer all item schema to Phase 2?**
   - What we know: Phase scope explicitly includes "граница изоляции данных … в слое данных" + a two-user isolation test (Criterion #4). ARCHITECTURE build order puts users+items schema in Foundation.
   - What's unclear: CONTEXT lists item CRUD/form as Phase 2; the *table + read seam* (no write/UI) is a gray area.
   - Recommendation: **Create the `items` table and `findItemsForUser` read seam now** so Criterion #4 is a genuine seeded two-user test. Ship no write path or add-form (respects D-06). Flag for planner sign-off.

3. **Test database strategy for the isolation test (real Postgres required).**
   - What we know: Mocking the ORM hides isolation/constraint bugs (PITFALLS #12); a real disposable Postgres is required.
   - What's unclear: Testcontainers vs a disposable schema vs a dedicated local `shopping_list_test` DB.
   - Recommendation: For a solo/family MVP, a **dedicated local test database** (env `DATABASE_URL_TEST`) reset per run via `drizzle-kit push`/truncate is simplest; Playwright global-setup seeds two users. Testcontainers is a heavier option if CI needs isolation. Planner picks; Wave 0 sets it up.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS (min 20.9) | Next 16 build/runtime | probe at scaffold | — | none — install if missing |
| PostgreSQL 16/17 | DB sessions + isolation seam + tests | probe (`pg_isready`) | — | Docker `postgres:17`; or a managed dev DB |
| npm | package install | ✓ (implied) | — | — |
| Playwright browsers | E2E auth flows | install via `npx playwright install` | — | none |

**Missing dependencies with no fallback:** Node 22 and a reachable Postgres are hard prerequisites — a Wave 0 task must verify both (`node --version`, `pg_isready`) before wiring auth. This is greenfield (no `package.json` yet), so the scaffold itself is the first task.
**Missing dependencies with fallback:** Postgres can be provided via Docker (`postgres:17`) if not installed locally.

*Probe commands for the planner's Wave 0 task:* `node --version`, `psql --version` / `pg_isready`, `docker info`.

## Validation Architecture

*(Nyquist enabled — `workflow.nyquist_validation: true`. This section generates VALIDATION.md.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` (unit/integration) + React Testing Library `^16` (components) + Playwright `1.62.0` (e2e/auth flows) |
| Config file | none yet — `vitest.config.ts` + `playwright.config.ts` created in **Wave 0** (greenfield) |
| Quick run command | `npx vitest run` (unit/integration) |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — (Criterion 1) | Register → auto-login → lands on empty list | e2e | `npx playwright test auth/register.spec.ts` | ❌ Wave 0 |
| AUTH-01 | Email+password register; 8-char + email validation | unit + component | `npx vitest run lib/validation/auth.test.ts` ; `...RegisterForm.test.tsx` | ❌ Wave 0 |
| AUTH-02 (Criterion 2) | Login; session persists across reload | e2e | `npx playwright test auth/login.spec.ts` | ❌ Wave 0 |
| AUTH-03 (Criterion 3) | Logout from any page → unauth → `/login` | e2e | `npx playwright test auth/logout.spec.ts` | ❌ Wave 0 |
| AUTH-04 (Criterion 4) | Two-user isolation at the data layer | integration + e2e | `npx vitest run server/repos/items.iso.test.ts` ; `npx playwright test auth/isolation.spec.ts` | ❌ Wave 0 |
| D-05 | Unauth visitor at `/` → redirect `/login` | e2e | `npx playwright test auth/root-redirect.spec.ts` | ❌ Wave 0 |
| D-07 | No/expired session on protected page → `/login` | e2e | `npx playwright test auth/protected-redirect.spec.ts` | ❌ Wave 0 |
| D-06 | Protected list renders empty-state copy | component/e2e | `npx playwright test app/empty-list.spec.ts` | ❌ Wave 0 |
| D-11 | Session lifetime configured to 30 days (not default 7) | unit/integration | assert configured `expiresIn` / cookie max-age | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (fast: schemas, repo isolation, component render).
- **Per wave merge:** `npx vitest run && npx playwright test` (full auth journeys + two-user isolation).
- **Phase gate:** full suite green before `/gsd-verify-work`; the two-user isolation test (Criterion #4) is the blocking anchor.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — @vitejs/plugin-react + vite-tsconfig-paths, jsdom env (verify against Vitest **4** guide)
- [ ] `playwright.config.ts` — baseURL, Node webServer boot, global-setup seeding two users
- [ ] Test Postgres provisioning — `DATABASE_URL_TEST`, reset/seed helpers (`seedUser`, `seedItem`)
- [ ] `lib/validation/auth.test.ts` — Zod schema unit tests (email + 8-char boundary) — **write first (TDD)**
- [ ] `server/repos/items.iso.test.ts` — two-user isolation (AUTH-04)
- [ ] Auth form component tests (RTL) — validation display, pending/disabled submit state
- [ ] Playwright specs — register/login/logout/root-redirect/protected-redirect/isolation

## Security Domain

*(`security_enforcement: true`, ASVS level 1, block_on high.)*

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth email/password; `minPasswordLength: 8` (D-03); password hashing (scrypt default / Argon2id via `@node-rs/argon2` — Open Q1); no plaintext. |
| V3 Session Management | yes | Better Auth DB-backed sessions; httpOnly secure cookie via `nextCookies()`; `expiresIn: 30d`; `signOut` invalidates session + clears cookie (D-09). |
| V4 Access Control | yes | Per-user isolation: `userId` from server session only → user-scoped repository choke point (`WHERE user_id = ?`); IDOR-prevention pattern established + tested (AUTH-04). |
| V5 Input Validation | yes | Zod schemas validate email/password on client AND server; never trust client-sent `userId`. |
| V6 Cryptography | yes | `BETTER_AUTH_SECRET` ≥32 chars (`openssl rand -base64 32`), server-only; hashing delegated to Better Auth (never hand-rolled). |
| V7 Errors & Logging | yes | Generic login error «Неверный email или пароль» (no user enumeration, UI-SPEC); no verbose DB errors to client. |

### Known Threat Patterns for Next 16 + Better Auth + Drizzle
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR / broken object-level auth | Elevation of Privilege | `userId` from session → user-scoped repo on every query; two-user test; 404 on no match. |
| User enumeration on login/register | Information Disclosure | Generic login error; register uses explicit «email занят» per D-01 discretion (accepted trade-off for a family app). |
| Session cookie theft / fixation | Spoofing | httpOnly + secure + sameSite cookie (Better Auth defaults via `nextCookies`); DB-backed session invalidated on logout. |
| Secret leakage to client bundle | Information Disclosure | `server-only` guards on `auth.ts`/`db/client.ts`; `DATABASE_URL`/`BETTER_AUTH_SECRET` unprefixed (never `NEXT_PUBLIC_`). |
| Forged Server Action / route-handler call | Tampering | `requireUser()` + Zod validation at the top of every action/handler. |
| Weak passwords (soft policy, family app) | Spoofing | 8-char minimum (accepted soft policy per project intent); Better Auth `haveibeenpwned`/rate-limit plugins deferred. |
| CSRF on auth endpoints | Tampering | Better Auth's built-in CSRF/session-cookie handling; same-origin `authClient`. |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-07-26) — exact latest versions + `better-auth@1.6.25` `exports` (confirms built-in `./adapters/drizzle`, `./next-js`, `./cookies`). `[VERIFIED: npm registry]`
- [better-auth.com/docs/integrations/next](https://www.better-auth.com/docs/integrations/next) — `toNextJsHandler`, `nextCookies`, `auth.api.getSession({ headers })`, optimistic middleware warning.
- [better-auth.com/docs/adapters/drizzle](https://www.better-auth.com/docs/adapters/drizzle) — `drizzleAdapter(db, { provider: "pg" })`, CLI schema generation.
- [better-auth.com/docs/concepts/session-management](https://www.better-auth.com/docs/concepts/session-management) — **default `expiresIn` = 7 days**, `session` config shape.
- [better-auth.com/docs/authentication/email-password](https://www.better-auth.com/docs/authentication/email-password) — `minPasswordLength` default 8, `autoSignIn`, `requireEmailVerification`.
- [nextjs.org/blog/next-16](https://nextjs.org/blog/next-16) — `middleware.ts` → `proxy.ts` (Node runtime), codemod.
- Project research `.planning/research/{STACK,ARCHITECTURE,PITFALLS}.md` — isolation architecture, IDOR/boundary pitfalls (HIGH, source of truth for patterns).

### Secondary (MEDIUM confidence)
- WebSearch: Better Auth default hashing = **scrypt** (custom Argon2id via `password.hash/verify`) — [GitHub issue #6608](https://github.com/better-auth/better-auth/issues/6608), corroborated by multiple 2026 hashing guides.
- WebSearch: Next 16 `proxy.ts` migration — [DEV](https://dev.to/iurii_rogulia/nextjs-16-proxyts-migration-from-middlewarets-28km), [nextjs.org discussion #84842](https://github.com/vercel/next.js/discussions/84842).
- WebSearch: 2026 Better Auth + Drizzle + Next.js full-stack tutorials — adapter import paths (built-in vs scoped).

### Tertiary (LOW confidence)
- WebFetch summaries of Better Auth docs (small-model extraction) — cross-checked against npm `exports` and the GitHub docs source before use.

## Metadata

**Confidence breakdown:**
- Standard stack + versions: HIGH — every package verified on the npm registry today.
- Auth wiring (adapter, route, session, cookies): HIGH — official docs + confirmed package exports.
- Route protection recommendation: HIGH — Better Auth's own optimistic-middleware warning + Next 16 proxy change.
- Isolation seam pattern: HIGH — matches project ARCHITECTURE + PITFALLS; implementation is standard.
- Session-default (7 vs 30) & hashing (scrypt vs Argon2id) corrections: HIGH that the *defaults* differ; the *decision* (Open Q1) needs user confirmation.
- Vitest 4 config specifics: MEDIUM — major-version bump; Wave 0 should validate.

**Research date:** 2026-07-26
**Valid until:** ~2026-08-25 (30 days). Better Auth and Next 16 are fast-moving — re-verify `expiresIn`/hashing defaults and the `proxy.ts` guidance if planning slips past this window.
