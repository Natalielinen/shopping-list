# Pitfalls Research

**Domain:** Next.js App Router full-stack (API routes/server actions) + PostgreSQL, multi-user auth, time-dependent computed-scoring domain, built TDD-first
**Researched:** 2026-07-26
**Confidence:** HIGH (Next.js caching/auth behavior verified against Next 15 docs; scoring/deadline hazards derived directly from this project's SUMMARY.md formula; multi-tenant/IDOR and TDD hazards are well-established patterns)

> Scope note: The single highest-leverage insight for THIS project is that the priority `total` is **time-dependent** (deadline points change every day). That one fact drives the scoring-storage pitfall, the timezone pitfalls, the sorting-stability pitfall, and the whole TDD approach (inject a clock). Read Critical Pitfall 1 first.

---

## Critical Pitfalls

### Pitfall 1: Storing a static `total` (and `deadlinePoints`) in the database

**What goes wrong:**
The formula is `deadlinePoints = 28 − days_until_deadline` (PROJECT.md), so priority decreases in distance and **increases as the deadline approaches**. If you compute `total`/`deadlinePoints` once at insert/edit time and persist them as plain columns, every deadline-bearing item's priority is frozen at the moment it was saved. Tomorrow the list is sorted wrong, and the core value ("list sorted by meaningful priority") silently breaks. Users lose trust — the exact success metric in PROJECT.md.

**Why it happens:**
`total` and `deadlinePoints` are listed as fields on the item schema in SUMMARY.md, which nudges developers to treat them as stored columns. Most CRUD tutorials store computed values. The bug is invisible in a demo (created today, viewed today) and only appears a day later.

**How to avoid:**
Treat the deadline-dependent portion as **derived-on-read**, never authoritative when stored. Recommended: store only the raw inputs (category/urgency/need/benefit/doubts/isCredit/deadline) plus a `staticPoints` for the time-independent part, and compute `deadlinePoints` + `total` in a pure function at query/render time using an injected "now". If you must persist `total` (e.g., for DB-side `ORDER BY`), recompute it on read for display and either (a) accept sort is only "as-of last write" or (b) run a daily recompute job. Do not mix: pick derive-on-read as the default for v1 (dataset is small and personal).

**Warning signs:**
A migration/schema with `total INT` and `deadline_points INT` as writable columns; sorting logic that does `ORDER BY total`; no `now`/clock parameter anywhere in the scoring code; tests that never advance time.

**Phase to address:**
Data model phase (decide stored vs. derived) and Scoring-engine phase (implement derive-on-read).

---

### Pitfall 2: Off-by-one / timezone errors in "days until deadline"

**What goes wrong:**
`days_until_deadline` is computed by subtracting two dates. Three independent bugs cluster here:
1. **Millisecond subtraction vs. calendar days.** `(deadline - now) / 86_400_000` gives a fractional number; `Math.floor` vs `Math.ceil` vs `Math.round` each shift the result by a day. A deadline "tomorrow" can read as 0 or 1 day depending on the time of day it is computed — changing `deadlinePoints` by a full point and reordering the list.
2. **Timezone drift.** `deadline` is stored as a date string (e.g. `"2026-08-15"`). If "now" is server UTC but the user is in UTC+3 (this user's locale), late-evening local time is already "tomorrow" in UTC — the day count is off by one near midnight. Storing the deadline as a `timestamptz` and letting Postgres/JS coerce it into a zoned instant makes it worse.
3. **Overdue handling.** Past deadlines yield negative `days_until_deadline`, so `28 − (−5) = 33` — overdue items correctly get *more* points, but only if the subtraction sign is preserved. Naively taking `Math.abs` or flooring negatives to 0 silently caps overdue urgency.

**Why it happens:**
JavaScript `Date` conflates dates and instants; `new Date("2026-08-15")` parses as **UTC midnight**, not local midnight. Developers reach for `Date` arithmetic instead of calendar-day math.

**How to avoid:**
- Define the deadline as a **calendar date, not an instant.** Store as `DATE` in Postgres (or an ISO `YYYY-MM-DD` string), never as `timestamptz`.
- Compute the difference in whole calendar days at a fixed reference (start-of-day) in a single, explicit timezone. For a personal app, pick the user's local day boundary; document it. Use a date library that does calendar math (e.g. `date-fns` / `date-fns-tz` or `Temporal.PlainDate`) rather than raw millisecond subtraction.
- Write the day-diff as one tested pure function `daysUntil(deadline, now)` returning a signed integer; deadline == today → 0 → `deadlinePoints = 28`.
- Preserve sign for overdue; only the `[−100, 100]` clamp bounds it.

**Warning signs:**
`new Date(deadlineString)` used directly; `86400000` literals; `Math.abs` on a day count; deadline column typed `timestamp`/`timestamptz`; a hydration warning about mismatched text when a "days left" label renders.

**Phase to address:**
Scoring-engine phase (day-diff function + boundary tests) and Data-model phase (choose `DATE` column type).

---

### Pitfall 3: Applying the clamp at the wrong level (total vs. deadlinePoints)

**What goes wrong:**
SUMMARY.md and PROJECT.md both scope the `[−100, 100]` clamp to **`deadlinePoints` only**, not to `total`. Two failure modes: (a) clamping `total` instead — a legitimately high combined score gets flattened; (b) forgetting the clamp entirely — a deadline 200 days out yields `deadlinePoints = −172`, dominating and inverting the intended ordering.

**Why it happens:**
The clamp bound is mentioned on the `deadlinePoints` line only; it is easy to read it as a global rule or to skip it because "scores won't get that big" (they will, with far-future or long-overdue deadlines).

**How to avoid:**
Clamp exactly one value: `deadlinePoints = clamp(28 − days, -100, 100)`. Compute `total` as the plain sum afterward, unclamped. Add explicit boundary tests: deadline at −72 days and +128 days must both saturate `deadlinePoints` to the bound; `total` must be free to exceed ±100.

**Warning signs:**
`clamp` wrapping the final sum; no test exercising a very-far or very-overdue deadline; `total` values that never exceed 100 in practice.

**Phase to address:**
Scoring-engine phase.

---

### Pitfall 4: Undefined/ambiguous point values shipped as silent zeros or crashes

**What goes wrong:**
Two scale entries are unresolved in the source-of-truth SUMMARY.md: **"Жизненно важно" (urgency) has no point value**, and **DoubtsType is marked "обсудить"** (values, labels, count all TBD). BenefitType was also flagged "обсудить". If the enum→points lookup has no entry, the code either returns `undefined` (→ `NaN total`, sorting collapses) or defaults to 0 (a life-threatening-urgency item scores like "not urgent" — the worst possible failure for this app).

**Why it happens:**
The schema was authored with open questions inline. PROJECT.md tentatively resolves them (Жизненно важно = 20 "pending confirmation"; doubts 0/−1/−3; benefit +1/−1/0/+2/−2) but marks them *pending*. Building before locking these produces plausible-but-wrong numbers.

**How to avoid:**
- Lock every scale value **before** the scoring phase; treat the point tables as a single reviewed constant map (one module) with an entry for *every* enum member. Confirm "Жизненно важно = 20" with the user (it must exceed "экстра срочность" = 10; PROJECT.md flags it pending).
- Make the lookup **total and exhaustive**: a TypeScript `Record<EnumType, number>` (not a partial map) so the compiler fails if a member is missing; add a runtime guard that throws on an unknown key rather than defaulting to 0.
- Unit-test that every enum member maps to a defined number.

**Warning signs:**
`NaN` appearing in any total; a `?? 0` or `|| 0` on a points lookup; `Record<string, number>` (loose key) instead of the exact enum; scale constants scattered across components.

**Phase to address:**
Requirements/decision lock (before build) + Scoring-engine phase.

---

### Pitfall 5: Missing per-user scoping on queries (IDOR / broken multi-tenant isolation)

**What goes wrong:**
Every item belongs to a user, but data isolation is enforced only if **every** read/update/delete filters by the authenticated user's id. Miss it on one endpoint — `GET /api/items/[id]`, an edit action, a delete — and any logged-in user can read/modify/delete another user's items by guessing or enumerating ids (Insecure Direct Object Reference). This is the #1 multi-tenant security bug and the one users would never forgive in a "private list".

**Why it happens:**
The happy-path test (owner fetches own item) passes, so the missing `WHERE user_id = ?` is invisible. Numeric/sequential ids make enumeration trivial. Developers add scoping to the list endpoint but forget the by-id and mutation endpoints.

**How to avoid:**
- Derive `userId` **only** from the server-side session, never from the request body/query/params.
- Scope *every* query: `where: { id, userId }` for single-item ops, not just `where: { id }`. A delete/update that matches zero rows must return 404, not silently succeed on someone else's row.
- Centralize access in a data layer (e.g. `getItemForUser(id, userId)`) so no route hand-rolls a query.
- Consider non-sequential ids (uuid/cuid) as defense-in-depth so ids aren't enumerable.

**Warning signs:**
Any Prisma/SQL query with `where: { id }` and no `userId`; `userId` read from `req.body`/`params`; update/delete affecting rows by id alone; no test where User B attempts to access User A's item.

**Phase to address:**
Auth phase (establish the session→userId pattern) and every CRUD phase (apply + test isolation).

---

### Pitfall 6: Unauthenticated / unvalidated Server Actions and route handlers

**What goes wrong:**
In the App Router, **Server Actions and route handlers are public HTTP endpoints.** A common misconception is that a Server Action invoked from a form is "internal" and trusted. It isn't — it can be called directly with forged arguments. Without an auth check *inside* each action/handler, and without input validation, attackers submit crafted payloads (e.g., a `total` override, a foreign `userId`, a `depends` pointing at another user's item, a negative `monthlyPayment`).

**Why it happens:**
Server Actions feel like local function calls in the codebase; the network boundary is hidden. Next.js does not auto-authenticate handlers.

**How to avoid:**
- First line of every Server Action / route handler: resolve the session and reject if unauthenticated (a shared `requireUser()` helper).
- Validate every input with a schema (e.g. Zod) at the boundary; never trust client-sent computed fields — recompute `total`/`deadlinePoints` server-side from raw inputs, ignore any client-supplied score.
- Treat `depends` as untrusted: verify the referenced item exists **and belongs to the same user** before saving.

**Warning signs:**
A Server Action with no session lookup; `const total = formData.get('total')`; no schema validation; trusting `depends` without an ownership check.

**Phase to address:**
Auth phase (helpers) + CRUD phase + Dependencies phase.

---

### Pitfall 7: Dependency cycles, self-dependency, and dangling `depends` references

**What goes wrong:**
`depends` is a self-referential FK (an item id the item is blocked on). Four failure modes:
1. **Self-dependency:** item depends on itself → blocked forever.
2. **Cycle:** A→B→A (or longer) → all members blocked forever, unbuyable.
3. **Dangling reference:** the target item is deleted → dependent points at a nonexistent id; "is it blocked?" logic throws or misreads.
4. **Cross-user reference:** `depends` points at another user's item id → isolation leak + nonsensical blocking.

**Why it happens:**
A single-parent dependency feels too simple to cycle, but A↔B is enough. Deletion and completion of the target aren't considered when the dependency is first built.

**How to avoid:**
- On create/edit: reject `depends == self`; walk the chain to reject cycles; verify the target exists and is owned by the same user.
- Define deletion behavior explicitly: either block deleting an item others depend on, or `ON DELETE SET NULL` (dependent becomes unblocked) — pick one and test it.
- Define "blocked" precisely: an item is blocked iff its `depends` target exists and is **not completed**. Completing (archiving) the target must unblock the dependent — recompute on read.

**Warning signs:**
No cycle check on save; no self-reference guard; FK with no defined `ON DELETE` behavior; a blocked-status function that doesn't handle a missing/completed target.

**Phase to address:**
Dependencies/blocking phase (guards + deletion policy), with the FK constraint decided in the Data-model phase.

---

### Pitfall 8: Stale list after mutations (Next.js caching / static rendering)

**What goes wrong:**
The user adds/edits/completes an item and the list doesn't update, or shows yesterday's ordering. In Next.js 15+, fetches and GET route handlers are **uncached by default**, so the classic "aggressive cache" bug is reduced — but two traps remain: (a) a user-specific list page accidentally **statically rendered** at build (shows empty/other data), and (b) after a Server Action mutation, the cached route segment isn't revalidated, so the RSC payload is stale.

**Why it happens:**
Developers either over-rely on old "cached by default" mental models or forget to call `revalidatePath`/`revalidateTag` after mutations. Per-user pages must be dynamic; if nothing marks them dynamic, Next may attempt static optimization.

**How to avoid:**
- Ensure the list route is dynamic/per-request (reading the session/cookies makes it dynamic automatically; verify it isn't force-static).
- After every create/update/delete/complete Server Action, call `revalidatePath('/list')` (or a tagged `revalidateTag`) before returning.
- Because `total` is time-dependent (Pitfall 1), don't cache the computed list long-term; compute on each request for v1.

**Warning signs:**
UI requires a manual refresh after adding an item; `export const dynamic = 'force-static'` on a user page; mutations with no `revalidate*` call; list content that differs between hard reload and client navigation.

**Phase to address:**
List/rendering phase and each CRUD phase.

---

### Pitfall 9: Non-deterministic sort — items reshuffle on every refresh

**What goes wrong:**
Category values include negatives (`Не нужные хотелки = −10`), so totals span negative and positive, and ties are common (many items share the same combination). If the default sort is only `ORDER BY total DESC` with no tiebreaker, equal-scored items reorder arbitrarily between requests, making the list feel unstable and untrustworthy — directly eroding the "trust the order" success metric. Client-side `Array.sort` on equal keys is not guaranteed stable across all paths either.

**Why it happens:**
Ties aren't considered; developers assume the DB/JS returns a consistent order for equal keys (it doesn't guarantee it).

**How to avoid:**
Always sort by a deterministic tiebreaker chain: `total DESC, createdAt ASC, id ASC`. Apply the same tiebreak wherever sorting happens (DB and client). Test that two equal-total items keep a stable relative order across repeated sorts.

**Warning signs:**
`ORDER BY total DESC` alone; list order changing on refresh with no data change; sort spec with a single key.

**Phase to address:**
List/sorting/filters phase.

---

### Pitfall 10: Time-dependent tests that are flaky or non-deterministic (TDD trap)

**What goes wrong:**
Because scoring depends on "today", tests that call `new Date()` internally pass today and fail tomorrow, or fail when run in CI in a different timezone, or straddle midnight. Worse, developers "fix" flakiness by loosening assertions (asserting ranges instead of exact points), which hides real off-by-one bugs (Pitfall 2).

**Why it happens:**
The scoring code reads the wall clock directly instead of receiving it as a parameter, so tests can't control time.

**How to avoid:**
- Make `now` an **explicit injected parameter** to every scoring/day-diff function: `calculateTotal(item, now)`, `daysUntil(deadline, now)`. Never read the clock inside pure logic.
- Use table-driven boundary tests with fixed `now`: deadline today (→28), 27 days (→1), 28 days (→0), 40 days (→−12, matches SUMMARY example), overdue, none (→0), clamp saturation both ends.
- Pin the test runner timezone (e.g. `TZ=UTC`) and, for any component rendering dates, freeze time (fake timers).

**Warning signs:**
`new Date()` / `Date.now()` inside scoring code; assertions using `toBeGreaterThan` on scores instead of exact equality; tests that pass locally but fail in CI; tests that only pass "today".

**Phase to address:**
Test-infrastructure phase (clock injection convention) + Scoring-engine phase.

---

### Pitfall 11: Scoring logic entangled with UI/route code — untestable (TDD architecture trap)

**What goes wrong:**
If the score is computed inside a React component, a Server Action, or a route handler, it can't be unit-tested in isolation and gets re-implemented (slightly differently) in more than one place — the add form, the list, the API — so the number a user sees while adding differs from the stored/sorted value.

**Why it happens:**
It's expedient to compute inline where the value is displayed. TDD is nominally required (PROJECT.md), but framework glue is hard to test, so logic drifts into the glue.

**How to avoid:**
Put the entire scoring engine in a **pure, framework-agnostic module** (`lib/scoring/`) with no imports from React/Next/Prisma: the point-table constants, `daysUntil`, `deadlinePoints`, `calculateTotal`, and `isBlocked`. Everything else calls it. Write these tests first (they're trivial pure-function tests — ideal TDD seed). UI and API both consume the one function.

**Warning signs:**
Score arithmetic inside `.tsx` files or route handlers; the same formula appearing in two files; scoring code that imports Next/Prisma; low unit-test coverage on scoring despite "TDD required".

**Phase to address:**
Scoring-engine phase (extract as pure lib, test-first).

---

### Pitfall 12: Authorization tests never written — isolation bug ships green

**What goes wrong:**
The test suite covers "owner does X to own item" and is all green, but never asserts the **negative**: User B must NOT read/edit/delete User A's item, and `depends` can't cross users. The IDOR of Pitfall 5 then ships with a passing suite, giving false confidence.

**Why it happens:**
Negative/authorization cases require setting up a second user and a real DB, which is more effort than happy-path tests; they're skipped under time pressure.

**How to avoid:**
For every item endpoint/action, add an integration test with two users asserting cross-user access returns 404/403 and mutates nothing. Run these against a **real Postgres test database** (e.g. Testcontainers or a disposable schema) — mocking the ORM hides isolation and constraint bugs. Make "two-user isolation test" a checklist item for each CRUD phase.

**Warning signs:**
No test file references a second user; all DB access mocked in tests; auth/isolation covered only by manual clicking.

**Phase to address:**
Auth phase (test harness with 2 users) + every CRUD/Dependencies phase.

---

### Pitfall 13: Client/server boundary misuse and secret leakage (App Router)

**What goes wrong:**
Two related failures: (a) marking large trees `"use client"` (or the whole page) because the add form needs interactivity, shipping the DB/scoring code and dropdown data to the browser and losing RSC benefits; (b) importing server-only code (DB client, secrets, `DATABASE_URL`) into a module that ends up in a client bundle, leaking credentials. Env vars prefixed `NEXT_PUBLIC_` are exposed to the browser by design — putting a secret there leaks it.

**Why it happens:**
The interactivity of the form (dropdowns, conditional `monthlyPayment`) pushes developers to make big components client components; import graphs make server code reachable from the client without an obvious warning.

**How to avoid:**
Keep pages/list as Server Components; isolate interactivity into small leaf Client Components (the form, filter controls). Guard server-only modules with the `server-only` package so a client import fails at build. Never prefix a secret with `NEXT_PUBLIC_`; keep `DATABASE_URL` and auth secrets server-only.

**Warning signs:**
`"use client"` at the top of a page/layout; `DATABASE_URL`/secrets referenced in a client component; a `NEXT_PUBLIC_` var holding a secret; unexpectedly large client bundle.

**Phase to address:**
Setup/architecture phase (boundary conventions) + UI phases.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Persist `total`/`deadlinePoints` as stored columns, no recompute | Simple `ORDER BY total`; less compute | Priorities go stale daily; sort is wrong; core value breaks | Never for deadline-bearing items; OK only if you also recompute on read or run a daily job |
| Compute score inline in components/actions | Fewer files early | Duplicated, drifting formula; untestable; violates TDD mandate | Never — extract to `lib/scoring` from day one |
| `where: { id }` without `userId` on "internal" endpoints | Fewer params | IDOR; full data-isolation breach | Never |
| Sequential integer item ids | Simple schema | Enumerable → easier IDOR probing | OK if every query is user-scoped and tested; prefer uuid/cuid |
| Reading `new Date()` inside scoring | Less plumbing | Flaky, timezone-dependent tests; hidden off-by-one | Never — inject `now` |
| Skipping cross-user negative tests | Faster green suite | Ships isolation bugs with false confidence | Never for a multi-user app |
| Storing `deadline` as `timestamptz` | Uses default ORM datetime | Timezone-driven off-by-one day counts | Never — use `DATE`/plain date |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Auth (NextAuth/Auth.js or Lucia) | Rolling your own session/JWT; storing plaintext passwords | Use a vetted library; hash with bcrypt/argon2; read `userId` from server session only |
| PostgreSQL via ORM (Prisma/Drizzle) | Mocking the ORM in tests → constraints/isolation untested | Integration-test against a real disposable Postgres (Testcontainers/test schema) |
| `depends` self-referential FK | No `ON DELETE` policy; no cycle/ownership check | Explicit `ON DELETE SET NULL` (or block delete) + app-level cycle/self/ownership guards |
| Postgres numeric for `price`/`monthlyPayment` | Using `float`/`double` for money → rounding drift | Use `numeric`/`decimal` (these fields don't score, but display must be exact) |
| Next.js env vars | Secret placed under `NEXT_PUBLIC_` | Keep `DATABASE_URL`/auth secrets unprefixed & server-only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recompute all totals on every request | Slower list as items grow | Fine for a personal list; cache per-request only; add index on sort keys if needed | Thousands of items per user (not expected in v1) |
| No index on sort/filter columns | Slow `ORDER BY`, seq scans | Index `(user_id, completed)`; deterministic sort in app after user-scoped fetch | Hundreds+ items, or "show completed" over long history |
| N+1 when resolving `depends` targets to compute blocked status | Many small queries per list render | Fetch the user's items once; resolve blocked status in memory | Any non-trivial list |
| Client-side re-sort of a fully client-rendered list | Jank on mobile | Sort server-side; keep list a Server Component | Larger lists on low-end phones |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Query by id without `userId` scope | IDOR — read/edit/delete others' items | Scope every query to session `userId`; 404 on no match |
| Trusting client-sent `total`/`userId`/`depends` | Score forgery, ownership spoof, cross-user linkage | Recompute score server-side; derive userId from session; validate `depends` ownership |
| Server Action assumed "internal" | Unauthenticated/forged invocation | `requireUser()` + Zod validation at the top of every action/handler |
| Plaintext or weak password storage | Credential compromise | bcrypt/argon2 hashing via auth library |
| Verbose DB errors returned to client | Leaks schema/PII | Generic error responses; log details server-side |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blocked (by `depends`) item still sorted at the top | User sees "buy this first" but can't — confusing | Visibly mark blocked items and/or de-prioritize/group them; show what they're waiting on |
| List reshuffles on refresh due to tie non-determinism | Feels unstable, erodes trust | Deterministic tiebreak `total, createdAt, id` |
| Negative totals shown without context | "Why is this −8?" | Show the negative clearly; optionally explain contributing factors |
| Tiny dropdowns/touch targets on mobile | Hard to tap 14-category selects on a phone | Native `<select>`, ≥44px targets, mobile-first layout |
| `monthlyPayment` visible when `isCredit` is false (or vice-versa) | Confusing/irrelevant field | Conditionally render `monthlyPayment` strictly on `isCredit === true` |
| "Days left" text differs server vs client (timezone) | Hydration warning / flicker | Compute day counts in one place with fixed tz; avoid client-only `Date` in SSR text |
| Completing an item doesn't visibly unblock its dependents | User doesn't know they can now buy the next thing | Recompute + revalidate so dependents unblock immediately |

## "Looks Done But Isn't" Checklist

- [ ] **Priority sort:** Verify it's still correct **the next day** (deadline points recomputed, not frozen) — the demo-day trap.
- [ ] **Deadline math:** Verify boundaries — today→28, 27d→1, 28d→0, 40d→−12 (SUMMARY example), overdue→>28, none→0, clamp saturates at ±100.
- [ ] **Data isolation:** Verify User B gets 404 (not the data) on User A's item id for GET/PUT/DELETE.
- [ ] **Every scale value defined:** Verify "Жизненно важно", all DoubtsType, all BenefitType, all 14 categories map to a number (no `NaN`, no silent 0).
- [ ] **Dependencies:** Verify self-dependency rejected, cycle rejected, deleting a target has defined behavior, completing a target unblocks the dependent.
- [ ] **Server Actions:** Verify each authenticates and validates input; client can't override `total`/`userId`.
- [ ] **Mutations refresh UI:** Verify list updates without manual reload (revalidatePath after add/edit/complete/delete).
- [ ] **Tie stability:** Verify two equal-total items keep stable order across refreshes.
- [ ] **Mobile:** Verify on a real phone viewport — tap targets, dropdowns, no horizontal scroll, keyboard doesn't break the form.
- [ ] **Tests deterministic:** Verify suite passes with `TZ=UTC` and would pass "tomorrow" (clock injected, not `new Date()`).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Static `total` stored, priorities stale | MEDIUM | Switch to derive-on-read; keep stored column only as a cache; add clock-injected recompute; backfill/ignore old values |
| IDOR discovered post-launch | HIGH | Audit every query for `userId` scope; add negative tests; rotate anything exposed; consider non-enumerable ids |
| Deadline off-by-one / tz bug | LOW–MEDIUM | Centralize in `daysUntil(deadline, now)`; switch column to `DATE`; add boundary tests; recompute affects only display |
| Dependency cycle in data | MEDIUM | Add cycle/self guards; write a one-off script to break existing cycles (null the offending `depends`) |
| Scoring duplicated & drifted | MEDIUM | Extract single `lib/scoring` module; delete inline copies; point all callers at it; add tests |
| Flaky time-dependent tests | LOW | Inject `now`; pin `TZ`; replace range asserts with exact values |

## Pitfall-to-Phase Mapping

> Phase names are indicative (greenfield roadmap not yet created); map to the phase covering that topic.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Static stored total (staleness) | Data-model + Scoring-engine | Re-open list "next day" (or with advanced `now`) — order updates |
| 2. Deadline off-by-one / timezone | Scoring-engine (+ Data-model column type) | Boundary tests incl. SUMMARY 40-day example; `TZ=UTC` passes |
| 3. Clamp scope wrong | Scoring-engine | Far-future & long-overdue deadlines saturate `deadlinePoints` only |
| 4. Undefined scale values | Requirements lock + Scoring-engine | Exhaustive `Record<Enum,number>`; test every member; user confirms "Жизненно важно"/doubts/benefit |
| 5. Missing user scoping (IDOR) | Auth + every CRUD phase | Two-user test: cross-access → 404, no mutation |
| 6. Unauth/unvalidated actions | Auth + CRUD + Dependencies | Direct action call without session rejected; forged `total`/`depends` ignored |
| 7. Dependency cycles/self/dangling | Dependencies/blocking (FK in Data-model) | Tests for self, A↔B cycle, delete target, complete target |
| 8. Stale list after mutation | List/rendering + CRUD | Add/complete item → list updates with no manual refresh |
| 9. Non-deterministic sort | List/sorting/filters | Equal-total items keep stable order across refreshes |
| 10. Flaky time-dependent tests | Test-infra + Scoring-engine | Suite deterministic under fixed clock & `TZ` |
| 11. Scoring entangled with UI | Scoring-engine (pure lib) | `lib/scoring` has no React/Next/Prisma imports; high unit coverage |
| 12. No authorization tests | Auth + CRUD + Dependencies | Negative two-user tests exist for each endpoint |
| 13. Client/server boundary & secrets | Setup/architecture + UI | `server-only` guards hold; no secret in client bundle/`NEXT_PUBLIC_` |

## Sources

- Next.js 15 caching changes (fetch, GET route handlers, client router cache no longer cached by default; motivation = predictability): [Next.js 15 blog](https://nextjs.org/blog/next-15), [Next.js 15 breaking cache strategy changes](https://medium.com/@weijunext/next-js-15-introduces-breaking-cache-strategy-changes-a594e3b504df), [App Router production patterns & pitfalls](https://devstarsj.github.io/2026/05/13/nextjs-15-app-router-production-patterns/), [Why your Next.js cache isn't working](https://pockit.tools/blog/nextjs-app-router-caching-deep-dive/) — Confidence: HIGH
- Project source-of-truth for scoring formula and schema ambiguities: `D:/myProjects/shopping-list/SUMMARY.md`, `D:/myProjects/shopping-list/.planning/PROJECT.md` — Confidence: HIGH
- Multi-tenant IDOR / broken object-level authorization, Server Actions as public endpoints, JS `Date`/timezone calendar-math hazards, and TDD clock-injection — established, well-documented patterns (OWASP Broken Access Control; Next.js Server Actions security guidance; date-handling best practice) — Confidence: HIGH

---
*Pitfalls research for: Next.js App Router + PostgreSQL multi-user computed-scoring shopping list (TDD)*
*Researched: 2026-07-26*
