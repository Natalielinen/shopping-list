---
phase: 2
slug: add-item-scoring
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded из `02-RESEARCH.md` §Validation Architecture. Per-task карта финализируется `/gsd-validate-phase` против реальных Task ID после планирования.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + React Testing Library 16.3.x + Playwright 1.62.x |
| **Config file** | `vitest.config.ts` (jsdom, globals, alias `@/*`, setup: `vitest-db-setup.ts` + `vitest.setup.ts`); `playwright.config.ts` (порт 3100, тестовая БД) |
| **Quick run command** | `npx vitest run src/lib/scoring src/lib/validation` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~10–30 с (unit/RTL); ~2–4 мин полный прогон с Playwright |

**Wave 0 gap:** в `package.json` НЕТ `test`-скриптов (только `dev/build/start/lint`) — добавить `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <затронутый модуль>` (движок/схема < 30 с)
- **After every plan wave:** Run `npx vitest run` (весь unit + RTL + integration)
- **Before `/gsd-verify-work`:** `npx vitest run && npx playwright test` — всё зелёное
- **Max feedback latency:** ~30 с (быстрый прогон затронутого модуля)

---

## Per-Task Verification Map

> Seed по требованиям (Task ID / Plan / Wave = TBD до планирования; `/gsd-validate-phase` привяжет к реальным задачам). Threat Ref заполняется из `<threat_model>` блоков планов.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SCORE-01 | — | `total` = сумма слагаемых | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-02 | — | формула `deadlinePoints`; без дедлайна = 0 | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-02 / D-04 | — | просрочка = фикс +100; сегодня = +28; −100 нижняя граница | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-03 | — | `isCredit` вычитает 2 | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-04 | — | doubts 0 / −1 / −3 | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-06 | — | шкалы category/urgency/need/benefit по SUMMARY (каждый пункт) | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCORE-05 | — | детерминизм через инъекцию `now` | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIST-06 | — | пороги `priorityLevel` (30→Высокий, 10→Средний, <10→Низкий) | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-01/02/05 | — | обязательные поля + тексты ошибок валидации | unit | `npx vitest run src/lib/validation/item.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-03 | — | optional coercion (empty→undefined, url, negative) | unit | `npx vitest run src/lib/validation/item.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-01 / AUTH-04 | T-2-xx | `createItemForUser` пишет со scoping по `userId`; изоляция | integration (real test DB) | `npx vitest run src/server/repos/items.iso.test.ts` | ⚠ расширить | ⬜ pending |
| TBD | TBD | TBD | ITEM-02/04 | — | форма: Select-ы, условный `monthlyPayment`, pending-состояние | component (RTL) | `npx vitest run src/components/items/AddItemForm.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIST-07 | — | разбивка раскрывается (Collapsible) | component (RTL) | `npx vitest run src/components/items/ScoreBreakdown.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-01/D-09/D-12/LIST-06 | T-2-xx | add → redirect → badge → сортировка по убыванию | e2e (Playwright) | `npx playwright test e2e/add-item.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — добавить `test` / `test:watch` / `test:e2e` скрипты
- [ ] `npm install date-fns@4` (заявлена в CLAUDE.md, но отсутствует в `package.json`)
- [ ] `npx shadcn add select checkbox badge collapsible textarea`
- [ ] `src/lib/scoring/scoring.test.ts` + `scales.ts` / `scoring.ts` — покрывают SCORE-01..06, LIST-06
- [ ] `src/lib/validation/item.test.ts` — покрывает ITEM-01..05 (зеркало `auth.test.ts`)
- [ ] Расширить `tests/helpers/db.ts` `seedItem` под новые NOT NULL / defaulted колонки
- [ ] `vitest.setup.ts` — шимы `hasPointerCapture` / `scrollIntoView` / `ResizeObserver` для Radix Select в RTL
- [ ] `src/components/items/AddItemForm.test.tsx`, e2e `e2e/add-item.spec.ts`

---

## Manual-Only Verifications

> UI backstop-проверки из `02-UI-SPEC.md` §UI Considerations — визуальные, автоматизируются частично (Playwright screenshot по усмотрению планировщика), но подтверждаются глазами.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Длинное название в карточке переносится/обрезается без слома и вытеснения badge | LIST-06/07 | Визуальная раскладка на реальном мобильном вьюпорте | Добавить покупку с очень длинным `title`, открыть `/list` на 375px, проверить карточку и badge |
| Полная разбивка (7 строк + Итого) раскрывается без клиппинга на узком экране | LIST-07 | Визуальная проверка overflow при раскрытии | Покупка со всеми полями + кредит, раскрыть разбивку на 375px |
| Badge остаётся в одну строку при трёхзначном `total` (напр. 126 при просрочке) | LIST-06 | Визуальная проверка переноса пилюли | Покупка с просроченным дедлайном, проверить badge в карточке |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (используется `vitest run`, не watch)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
