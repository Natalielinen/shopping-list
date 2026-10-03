---
phase: 05-dependencies-blocking
reviewed: 2026-09-19T06:23:56Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - drizzle/0003_groovy_grandmaster.sql
  - e2e/app/dependencies.spec.ts
  - src/app/(app)/list/[id]/edit/actions.ts
  - src/app/(app)/list/[id]/edit/page.tsx
  - src/app/(app)/list/actions.guard.test.ts
  - src/app/(app)/list/actions.ts
  - src/app/(app)/list/new/actions.ts
  - src/app/(app)/list/new/page.tsx
  - src/app/(app)/list/page.tsx
  - src/components/items/AddItemForm.tsx
  - src/components/items/ItemCard.tsx
  - src/components/items/ListView.tsx
  - src/components/items/PurchaseCheckbox.tsx
  - src/lib/deps/blocked.test.ts
  - src/lib/deps/blocked.ts
  - src/lib/deps/cycle.test.ts
  - src/lib/deps/cycle.ts
  - src/lib/list/sort.test.ts
  - src/lib/list/sort.ts
  - src/lib/validation/item.test.ts
  - src/lib/validation/item.ts
  - src/server/db/schema.ts
  - src/server/repos/items.iso.test.ts
  - src/server/repos/items.ts
  - tests/helpers/db.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-09-19T06:23:56Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 5 adds the self-referencing `depends_on` FK, read-time `isBlocked` derivation, an
authoritative `wouldCreateCycle` traversal, a server-side blocking guard on
`setItemPurchased`, and the RSC→client primitive boundary for `blocked`/`dependencyTitle`.

I audited the four security-sensitive surfaces called out in the task and could not
prove a defect in any of them:

- **IDOR / ownership (T-05-01):** every write path that accepts a `dependsOn`
  (`createItem`, `updateItem`) gates the value through `map.has(...)` built from
  `findItemsForUser(user.id)`, so a foreign or non-existent id is rejected with the
  generic `CYCLE_ERROR` before any write. `dependsOn` can only be *cleared* (never set
  to a foreign id) when null/undefined. The candidate lists in `new/page.tsx` and
  `edit/page.tsx` and the guard's dependency read all go through `findItemsForUser` /
  `findItemForUser`. No client-supplied `userId` reaches a WHERE clause.
- **Blocking guard (D-03 / T-05-02):** `setItemPurchased` rejects marking a blocked item
  purchased server-side (runs only when `next === true`, reads item + dependency via
  userId-scoped repos, applies pure `isBlocked`), independent of the disabled UI. The
  `actions.guard.test.ts` integration test exercises this against real Postgres. Fails
  safe when the dependency read returns null (treated as blocked).
- **Cycle prevention (D-05):** `wouldCreateCycle` terminates via a visited-set even on a
  pre-existing corrupt cycle, rejects self (`candidateId === sourceId`) and transitive
  cycles, and short-circuits create-mode (`sourceId === null → false`). I traced several
  multi-level update scenarios (stale self-edge, deep chains) — the source node is
  checked *before* its outgoing edge is followed, so the stale edge of the edited item is
  never traversed and no cycle is missed.
- **Read-time `isBlocked` derivation:** direct (non-transitive) per D-02, guarded by
  `&& item.purchasedAt === null` so purchased/archived cards never show a lock, and only
  primitives (`blocked`, `dependencyTitle`, epoch-ms) cross the RSC→client boundary.

No blockers. One maintainability warning and five low-severity items follow. Several
INFO items describe defensive-rendering gaps that are only reachable under out-of-band /
corrupt DB state (the app itself prevents introducing that state), and are recorded for
completeness rather than as app-reachable bugs.

## Warnings

### WR-01: Ownership + cycle validation and money conversion duplicated verbatim across create/update actions

**File:** `src/app/(app)/list/new/actions.ts:45-74` and `src/app/(app)/list/[id]/edit/actions.ts:48-76`
**Issue:** The ownership guard (`findItemsForUser` → build `map` → `map.has(dependsOn)` →
`wouldCreateCycle`) and the rubles→kopecks `toKopecks` helper are copy-pasted between the
two Server Actions. The only intended difference is the `wouldCreateCycle` source argument
(`null` for create vs `id` for update). This is the highest-value security invariant in the
phase (IDOR + cycle), so keeping two hand-synchronized copies invites divergence: a future
fix or hardening applied to one action can silently miss the other, and a reviewer must
diff both to confirm parity. The mirroring is deliberate per the inline comments, but the
duplication of a security-critical block is a real maintainability risk.
**Fix:** Extract a shared helper, e.g. in `src/server/repos/items.ts` or a new
`src/lib/deps/validate.ts`:
```ts
// returns { ok: true } | { ok: false } — single source of truth for both actions
export async function assertDependencyAllowed(
  userId: string,
  dependsOn: string | null,
  sourceId: string | null // null on create, item id on update
): Promise<boolean> {
  if (dependsOn == null) return true;
  const own = await findItemsForUser(userId);
  const map = new Map(own.map((r) => [r.id, r.dependsOn]));
  return map.has(dependsOn) && !wouldCreateCycle(map, sourceId, dependsOn);
}
```
Similarly hoist `toKopecks` into a shared money util. Both actions then call one function,
guaranteeing identical ownership/cycle semantics.

## Info

### IN-01: No-op `wouldCreateCycle(map, null, r.id)` in create-mode candidate filter

**File:** `src/app/(app)/list/new/actions.ts:54` and `src/app/(app)/list/new/page.tsx:26`
**Issue:** In create mode `sourceId` is always `null`, so `wouldCreateCycle` returns `false`
unconditionally (documented in `cycle.ts:23`). The call is dead computation kept "for
symmetry with edit". It's harmless but can mislead a future maintainer into thinking
create-mode cycle protection is active here (it isn't — cycles are impossible on create by
construction).
**Fix:** Drop the `wouldCreateCycle` call from the create paths, or replace with a short
comment noting cycles are structurally impossible pre-insert. Keep the ownership check.

### IN-02: Blocked label renders garbage when a dependency is absent from the loaded set

**File:** `src/app/(app)/list/page.tsx:59-70`, `src/components/items/ItemCard.tsx:86`, `src/components/items/PurchaseCheckbox.tsx:93`
**Issue:** `blocked` is computed as `isBlocked(item.dependsOn, dep?.purchasedAt ?? null)`.
If `dep` is `undefined` (i.e. `dependsOn` points to an item not present in the user's loaded
rows), `isBlocked` returns `true` but `dependencyTitle` resolves to `null`, so the card shows
`Заблокировано:` with an empty title and the checkbox aria-label becomes
`…пока не куплено «null»`. This is not reachable through the app today (ownership is enforced
on write and `ON DELETE SET NULL` prevents dangling refs, so `dependsOn` always references a
loaded own item), but the rendering has no defensive fallback if that invariant is ever
broken (raw DB edit, future bulk import).
**Fix:** Treat "blocked but dependency title unknown" as a distinct state, e.g. skip the
lock row when `dependencyTitle == null`, or render a neutral fallback
(`Заблокировано зависимостью`) and omit the `«...»` from the aria-label when title is null.

### IN-03: `mode`/`itemId` coupling not enforced by types; edit path relies on `itemId!`

**File:** `src/components/items/AddItemForm.tsx:102-114, 156`
**Issue:** `mode`, `itemId`, and `initialValues` are independent optional props, so the type
system permits `mode="edit"` with `itemId === undefined`. The submit handler then calls
`updateItem(itemId!, payload)` with a non-null assertion; if the contract were ever violated,
`updateItem(undefined, ...)` would flow into `updateItemForUser` and produce a malformed
WHERE (`eq(items.id, undefined)`) rather than a clear failure.
**Fix:** Model the props as a discriminated union so `itemId`/`initialValues` are required
when `mode === "edit"` and absent otherwise, removing the `itemId!` assertion:
```ts
type Props =
  | { mode?: "create"; candidates?: Candidate[] }
  | { mode: "edit"; itemId: string; initialValues: Partial<ItemFormInput>; candidates?: Candidate[] };
```

### IN-04: `CYCLE_ERROR` and sibling error strings duplicated across action modules

**File:** `src/app/(app)/list/new/actions.ts:23`, `src/app/(app)/list/[id]/edit/actions.ts:27`, `src/app/(app)/list/actions.ts:21,26`
**Issue:** The user-facing copy `"Нельзя выбрать эту покупку — получится цикл зависимостей."`
is declared independently in two files, and the blocking/status strings likewise. The
Copywriting Contract requires byte-identical text (the guard test asserts on it); duplicated
literals can drift out of sync with the spec.
**Fix:** Centralize the phase's user-facing strings in one module (e.g.
`src/lib/deps/messages.ts`) and import them in both actions and the test.

### IN-05: Edit form can become unsaveable when the candidate list is empty but the item keeps a cycle-unsafe dependency

**File:** `src/app/(app)/list/[id]/edit/page.tsx:38-45`, `src/components/items/AddItemForm.tsx:406-410`
**Issue:** When `candidates` is empty the `dependsOn` Select is rendered `disabled`, so the
form's `dependsOn` value stays at its `initialValues` id and cannot be reset to `"none"`. If
that retained id is cycle-unsafe (its chain reaches the edited item), every save is rejected
by `updateItem` with `CYCLE_ERROR` and the user has no in-form way to clear the dependency —
the item is effectively uneditable. This requires a pre-existing cyclic `depends_on` state,
which the app prevents from being created through the UI, so it is only reachable via
corrupt/out-of-band data; recorded for completeness.
**Fix:** Always keep the "Без зависимости" option selectable (don't `disabled` the Select
purely on empty candidates when an existing dependency is set), so the user can always clear
a stale/unsafe dependency.

---

_Reviewed: 2026-09-19T06:23:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
