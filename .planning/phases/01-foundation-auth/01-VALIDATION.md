---
phase: 1
slug: foundation-auth
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` § Validation Architecture. Task IDs are assigned at planning; this draft maps by requirement/criterion.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.10` (unit/integration) + React Testing Library `^16` (components) + Playwright `1.62.0` (e2e/auth flows) |
| **Config file** | none yet — `vitest.config.ts` + `playwright.config.ts` created in **Wave 0** (greenfield) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30–60 s (unit fast; e2e dominated by webServer boot + two-user seeding) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (schemas, repo isolation, component render — fast).
- **After every plan wave:** Run `npx vitest run && npx playwright test` (full auth journeys + two-user isolation).
- **Before `/gsd-verify-work`:** Full suite must be green. The two-user isolation test (Criterion #4 / AUTH-04) is the **blocking anchor**.
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

*Task IDs (`1-NN-NN`) are assigned when plans are written; rows below map by requirement/criterion and will be reconciled to task IDs during planning/validate-phase.*

| Requirement / Criterion | Wave | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------------------|------|----------|-----------|-------------------|-------------|--------|
| Criterion 1 | e2e | Register → auto-login (D-04) → lands on empty list | e2e | `npx playwright test auth/register.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-01 | — | Email+password register; 8-char (D-03) + email validation | unit + component | `npx vitest run lib/validation/auth.test.ts` ; `…RegisterForm.test.tsx` | ❌ W0 | ⬜ pending |
| AUTH-02 / Criterion 2 | — | Login; session persists across reload | e2e | `npx playwright test auth/login.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-03 / Criterion 3 | — | Logout from any page → unauth → `/login` (D-09) | e2e | `npx playwright test auth/logout.spec.ts` | ❌ W0 | ⬜ pending |
| **AUTH-04 / Criterion 4** | — | **Two-user isolation at the data layer** (seeded rows; user A cannot read user B) | integration + e2e | `npx vitest run server/repos/items.iso.test.ts` ; `npx playwright test auth/isolation.spec.ts` | ❌ W0 | ⬜ pending |
| D-05 | — | Unauth visitor at `/` → redirect `/login` | e2e | `npx playwright test auth/root-redirect.spec.ts` | ❌ W0 | ⬜ pending |
| D-06 | — | Protected list renders empty-state copy (no add form) | component/e2e | `npx playwright test app/empty-list.spec.ts` | ❌ W0 | ⬜ pending |
| D-07 | — | No/expired session on protected page → `/login` | e2e | `npx playwright test auth/protected-redirect.spec.ts` | ❌ W0 | ⬜ pending |
| D-11 | — | Session lifetime configured to 30 days (not default 7) | unit/integration | assert configured `expiresIn` / cookie max-age | ❌ W0 | ⬜ pending |
| D-12 | — | Password hashing is Argon2id (custom `password.hash/verify`), not scrypt | integration | assert stored hash uses Argon2id (`$argon2id$` prefix) on register | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — `@vitejs/plugin-react` + `vite-tsconfig-paths`, jsdom env (verify against Vitest **4** guide — major version bump)
- [ ] `playwright.config.ts` — baseURL, Node `webServer` boot, global-setup seeding **two** users
- [ ] Test Postgres provisioning — `DATABASE_URL_TEST`, reset/seed helpers (`seedUser`, `seedItem`)
- [ ] `lib/validation/auth.test.ts` — Zod schema unit tests (email + 8-char boundary) — **write first (TDD)**
- [ ] `server/repos/items.iso.test.ts` — two-user isolation (AUTH-04) — the blocking anchor
- [ ] Auth form component tests (RTL) — validation display, pending/disabled submit state
- [ ] Playwright specs — register / login / logout / root-redirect / protected-redirect / isolation

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* (Password-hash algorithm and session lifetime are config assertions and are automatable — see D-11/D-12 rows above.)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (CI-safe `run` commands only)
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
