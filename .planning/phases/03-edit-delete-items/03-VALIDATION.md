---
phase: 3
slug: edit-delete-items
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Research был пропущен для этой фазы (тонкое расширение Фазы 2), поэтому стратегия авторизована из известной тестовой инфраструктуры Фазы 2, а не из `RESEARCH.md`. Per-task карта финализируется `/gsd-validate-phase` против реальных Task ID.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + React Testing Library 16.3.x + Playwright 1.62.x (унаследовано из Фазы 2) |
| **Config file** | `vitest.config.ts` (jsdom, globals, alias `@/*`, setup: `vitest-db-setup.ts` + `vitest.setup.ts` с Radix-шимами); `playwright.config.ts` (порт 3100, тестовая БД) |
| **Quick run command** | `npx vitest run src/server/repos src/components/items` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~10–30 с (unit/RTL); ~2–4 мин полный прогон с Playwright |

**Wave 0 gap:** `AlertDialog` не установлен — `npx shadcn add alert-dialog` (Radix-шимы `hasPointerCapture`/`scrollIntoView`/`ResizeObserver` уже в `vitest.setup.ts` из Фазы 2, покрывают Radix Dialog в RTL). Схема БД не меняется — миграция НЕ требуется (edit/delete по существующим колонкам).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <затронутый модуль>` (< 30 с)
- **After every plan wave:** Run `npx vitest run` (весь unit + RTL + integration)
- **Before `/gsd-verify-work`:** `npx vitest run && npx playwright test` — всё зелёное
- **Max feedback latency:** ~30 с

---

## Per-Task Verification Map

> Seed по требованиям (Task ID / Plan / Wave = TBD до планирования). Threat Ref из `<threat_model>` блоков планов (приоритет — IDOR на update/delete).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ITEM-07 | T-3-xx | `updateItemForUser(userId, id, data)` пишет только свою покупку (scoping); чужую — no-op/ошибка (изоляция) | integration (real DB) | `npx vitest run src/server/repos/items.iso.test.ts` | ⚠ расширить | ⬜ pending |
| TBD | TBD | TBD | ITEM-07 | — | edit-форма предзаполнена (price копейки→рубли), сохранение → updateItem; pending-защита | component (RTL) | `npx vitest run src/components/items/AddItemForm.test.tsx` | ⚠ расширить | ⬜ pending |
| TBD | TBD | TBD | ITEM-07 | — | приоритет пересчитан на чтении после edit (total отражает новые поля) | e2e (Playwright) | `npx playwright test e2e/app/edit-item.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-08 | T-3-xx | `deleteItemForUser(userId, id)` удаляет только свою покупку (scoping); чужую нельзя | integration (real DB) | `npx vitest run src/server/repos/items.iso.test.ts` | ⚠ расширить | ⬜ pending |
| TBD | TBD | TBD | ITEM-08 | — | AlertDialog подтверждение → deleteItem; pending-защита; отмена не удаляет | component (RTL) | `npx vitest run src/components/items/DeleteItemButton.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ITEM-08 | — | delete → покупка исчезает из списка (e2e) | e2e (Playwright) | `npx playwright test e2e/app/delete-item.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn add alert-dialog` — компонент подтверждения удаления (D-05)
- [ ] Расширить `src/server/repos/items.iso.test.ts` — изоляция update/delete (A не может редактировать/удалить покупку B)
- [ ] Расширить `src/components/items/AddItemForm.test.tsx` — edit-режим (prefill, save)
- [ ] `src/components/items/DeleteItemButton.test.tsx` — AlertDialog confirm/cancel/pending
- [ ] `e2e/app/edit-item.spec.ts`, `e2e/app/delete-item.spec.ts`

---

## Manual-Only Verifications

> UI backstop-проверки из `03-UI-SPEC.md` §UI Considerations — визуальные, подтверждаются глазами.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Длинный title + иконки действий: badge и иконки видимы на тач-зонах ≥44px, усекается только title | ITEM-07/08 | Визуальная раскладка на 375px | Покупка с длинным title, открыть /list на 375px, проверить ряд действий |
| Переход на `/list/[id]/edit` показывает route-level loading без пустого кадра | ITEM-07 | Визуальная проверка loading-состояния | Тапнуть edit, наблюдать переход |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, не watch)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
