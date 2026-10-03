---
phase: 4
slug: list-sort-filter-archive
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 4 — Validation Strategy

> Контракт валидации фазы для сэмплирования обратной связи во время выполнения. Сид от plan-phase (status: draft); детальную Per-Task-карту заполняет `/gsd-validate-phase` после планирования.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/integration) + Playwright (e2e) — TDD (перенос из Фаз 1–3) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npx vitest run` (или таргетно по изменённому файлу) |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~10s vitest + ~15s playwright |

Интеграционные `*.iso.test.ts` требуют реальную Postgres `shopping_list_test`; `ensureMigrated()` подхватывает новую миграцию автоматически.

---

## Sampling Rate

- **After every task commit:** `npx vitest run` (таргетно на изменённые файлы)
- **After every plan wave:** `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** полный набор зелёный
- **Max feedback latency:** ~30 секунд

---

## Per-Task Verification Map

| Requirement | Secure Behavior | Test Type | Automated Command | Status |
|-------------|-----------------|-----------|-------------------|--------|
| LIST-01 (сортировка по приоритету + tiebreaker) | N/A | unit | `npx vitest run src/lib/list/sort` | ⬜ pending |
| LIST-02 (сортировка по добавлению) | N/A | unit | `npx vitest run src/lib/list/sort` | ⬜ pending |
| LIST-03 (сортировка по алфавиту, `localeCompare('ru')`) | N/A | unit | `npx vitest run src/lib/list/sort` | ⬜ pending |
| LIST-04 (отметка купленной → архив; обратимо) | Изоляция `setItemPurchased` по `userId` (IDOR) | integration + e2e | `npx vitest run src/server/repos/items.iso` · `npx playwright test e2e/app/purchase-archive` | ⬜ pending |
| LIST-05 (фильтр «показывать купленные» → секция «Куплено») | N/A | e2e | `npx playwright test e2e/app/purchase-archive` | ⬜ pending |
| LIST-08 (mobile-first, тач-зоны ≥44px) | N/A | manual/visual backstop | — (см. Manual-Only) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Точные task ID проставит validate-phase после планирования.*

---

## Wave 0 Requirements

- [ ] `src/lib/list/sort.ts` + `src/lib/list/sort.test.ts` — чистые компараторы/партиция (детерминированные tiebreakers D-02, `localeCompare('ru')`) — TDD-ядро
- [ ] расширить `src/server/repos/items.iso.test.ts` + хелпер `seedItem` под поле `purchasedAt` (изоляция `setItemPurchasedForUser`)
- [ ] `e2e/app/purchase-archive.spec.ts` — отметка → архив, undo, фильтр раскрывает «Куплено», переключение сортировки
- [ ] `npx shadcn add sonner` — установить примитив тоста (единственная новая зависимость)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Тач-зоны ≥44px панели, чекбокса и строки фильтра на 375px | LIST-08 | Визуальная раскладка на реальном узком вьюпорте | Открыть /list на 375px; убедиться, что Select, чекбокс «куплено» и строка фильтра имеют тач-зоны ≥44px, панель не перекрывает первую карточку |
| Приглушённое лечение купленной карточки (`opacity-70` + `line-through`) | LIST-04 | Визуальное восприятие «избыточного канала» статуса | Включить «Показывать купленные»; купленная карточка визуально приглушена и зачёркнута, а не только по цвету |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
