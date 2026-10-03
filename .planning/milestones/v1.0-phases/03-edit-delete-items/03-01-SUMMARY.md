---
phase: 03-edit-delete-items
plan: 01
subsystem: ui
tags: [nextjs, server-actions, drizzle, react-hook-form, zod, playwright, vitest, idor]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: шов изоляции userId (requireUser/getCurrentUser), e2e-инфраструктура на DATABASE_URL_TEST
  - phase: 02-add-item-scoring
    provides: AddItemForm, itemInputSchema, createItemForUser/findItemsForUser, ItemCard, ScoreBreakdown, computeTotal (total на чтении)
provides:
  - "findItemForUser(userId, id) — read-one репо-функция со scoping по userId"
  - "updateItemForUser(userId, id, data) — update репо-функция со scoping по userId"
  - "updateItem(id, input) — Server Action обновления покупки (requireUser + safeParse + рубли→копейки, { ok })"
  - "Маршрут /list/[id]/edit — RSC-обёртка с prefill и notFound() при чужой/несуществующей покупке"
  - "AddItemForm в едином режиме create/edit (mode/itemId/initialValues)"
  - "ItemCard с иконкой Pencil edit; ScoreBreakdown с actions-слотом в ряду триггера"
affects: [03-02 (удаление — deleteItemForUser/deleteItem/DeleteItemButton зеркалят edit-слой), 04, 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Единая форма add/edit через опциональные props (mode/itemId/initialValues) — без дублирования"
    - "CRUD U/read-one репо-функции со scoping and(eq(id), eq(userId)) — IDOR невозможен на чтение и запись"
    - "ScoreBreakdown actions-слот: иконки действий делят flex-ряд с триггером, но отдельные элементы (тап не переключает Collapsible)"

key-files:
  created:
    - "src/app/(app)/list/[id]/edit/actions.ts — Server Action updateItem"
    - "src/app/(app)/list/[id]/edit/page.tsx — RSC-обёртка edit с prefill"
    - "src/app/(app)/list/[id]/edit/loading.tsx — route-level loading (backstop)"
    - "src/app/(app)/list/[id]/edit/actions.test.ts — unit-тесты updateItem"
    - "e2e/app/edit-item.spec.ts — сквозной e2e-tracer редактирования"
  modified:
    - "src/server/repos/items.ts — findItemForUser + updateItemForUser"
    - "src/components/items/AddItemForm.tsx — edit-режим"
    - "src/components/items/ItemCard.tsx — prop id + иконка Pencil"
    - "src/components/items/ScoreBreakdown.tsx — actions-слот в ряду триггера"
    - "src/app/(app)/list/page.tsx — прокидка id={item.id}"
    - "src/server/repos/items.iso.test.ts — изоляция update/read"
    - "src/components/items/AddItemForm.test.tsx — кейсы edit-режима"

key-decisions:
  - "ScoreBreakdown получил actions-слот (вместо отдельного футер-ряда): триггер flex-1 min-w-0 h-11 делит ряд с shrink-0 иконкой, CollapsibleContent остаётся во всю ширину"
  - "Route-level loading.tsx добавлен (UI-SPEC S4 backstop — переход на edit без пустого кадра)"

patterns-established:
  - "Edit-слой зеркалит create-шов Фазы 2: меняется только глагол (insert→update) и user-facing копирайт"
  - "prefill копейки→рубли (÷100, строкой) в RSC-обёртке; рубли→копейки (×100) ровно один раз на сервере в updateItem"

requirements-completed: [ITEM-07]

coverage:
  - id: D1
    description: "findItemForUser/updateItemForUser со scoping по userId — чужую покупку нельзя прочитать/обновить (IDOR, D-09)"
    requirement: ITEM-07
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#updateItemForUser — изоляция записи по userId (T-3-01 / AUTH-04)"
        status: pass
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#findItemForUser — изоляция чтения одной покупки по userId (T-3-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateItem — requireUser + safeParse + рубли→копейки (×100 один раз), userId из сессии, не из payload (D-03, BL-01)"
    requirement: ITEM-07
    verification:
      - kind: unit
        ref: "src/app/(app)/list/[id]/edit/actions.test.ts#updateItem — перевод рубли→копейки + изоляция (BL-01 / D-03 / T-3-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AddItemForm в edit-режиме: prefill в рублях, monthlyPayment при isCredit, updateItem один раз + push, лейбл «Сохранить» (D-01/D-02)"
    requirement: ITEM-07
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#edit-режим"
        status: pass
    human_judgment: false
  - id: D4
    description: "Сквозной путь: карточка → Pencil → предзаполненная /list/[id]/edit → смена срочности → редирект /list → пересчитанный на чтении badge (SC-1, D-07/D-08)"
    requirement: ITEM-07
    verification:
      - kind: e2e
        ref: "e2e/app/edit-item.spec.ts#редактирование покупки: карточка → prefill → смена срочности → пересчитанный badge"
        status: pass
    human_judgment: false
  - id: D5
    description: "Длинный title: иконки действий и badge на тач-зонах ≥44px, усекается только title; route-level loading без пустого кадра (UI-SPEC backstop)"
    verification: []
    human_judgment: true
    rationale: "Визуальные backstop-критерии (тач-зоны ≥44px на 375px, loading-переход) требуют ручной проверки на устройстве — автоматизация недостаточна"

# Metrics
duration: 8min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 01: Сквозной срез редактирования покупки Summary

**Редактирование покупки end-to-end (ITEM-07): иконка «карандаш» на карточке → предзаполненная /list/[id]/edit → Server Action updateItem со scoping по userId → редирект /list с пересчитанным на чтении badge приоритета.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-02T06:23:23Z
- **Completed:** 2026-08-02T06:31:40Z
- **Tasks:** 2
- **Files modified:** 12 (5 создано, 7 изменено)

## Accomplishments

- Сквозной tracer редактирования: карточка → Pencil → prefill-форма → смена поля приоритета → редирект → пересчитанный badge (e2e зелёный).
- Изоляция по userId на чтение и запись (IDOR, T-3-01/T-3-02): `findItemForUser`/`updateItemForUser` скоупят каждый запрос `and(eq(items.id, id), eq(items.userId, userId))`; чужая/несуществующая покупка → null → `notFound()` (404).
- Единая форма add/edit (D-01): `AddItemForm` расширена props `mode/itemId/initialValues` без дублирования; submit-лейбл «Сохранить», текст ошибки «Не удалось сохранить изменения…».
- Деньги: prefill копейки→рубли (÷100) в RSC-обёртке, рубли→копейки (×100) ровно один раз в `updateItem` (BL-01).
- Пересчёт приоритета «бесплатный» (D-08, SCORE-05): `total` считается на чтении, отдельной логики инвалидации нет.

## Task Commits

Каждая задача закоммичена атомарно (TDD RED → GREEN):

1. **Task 1 (tracer): e2e-тест редактирования (RED)** — `df07574` (test)
2. **Task 1 (tracer): реализация сквозного среза (GREEN)** — `89d05e8` (feat)
3. **Task 2: изоляция + unit-тесты edit-слоя** — `bc0d6f5` (test)

**Plan metadata:** (docs-коммит ниже)

## Files Created/Modified

- `src/server/repos/items.ts` — `findItemForUser` (select-one, scoping) + `updateItemForUser` (update, scoping, .returning() → row ?? null); импорт расширен до `and, eq`.
- `src/app/(app)/list/[id]/edit/actions.ts` — Server Action `updateItem(id, input)`: requireUser + safeParse + toKopecks, `{ ok }`, без redirect.
- `src/app/(app)/list/[id]/edit/page.tsx` — RSC-обёртка: getCurrentUser → redirect("/login"); findItemForUser → notFound(); prefill (÷100, deadline → YYYY-MM-DD).
- `src/app/(app)/list/[id]/edit/loading.tsx` — route-level loading-состояние (backstop).
- `src/components/items/AddItemForm.tsx` — edit-режим (mode/itemId/initialValues), ветвление onSubmit на updateItem, submit «Сохранить».
- `src/components/items/ScoreBreakdown.tsx` — опциональный `actions`-слот в flex-ряду триггера (flex-1 min-w-0 h-11), иконки shrink-0.
- `src/components/items/ItemCard.tsx` — обязательный prop `id` + иконка Pencil (Button asChild Link → /list/[id]/edit, aria-label «Редактировать покупку»).
- `src/app/(app)/list/page.tsx` — прокидка `id={item.id}` в ItemCard.
- `src/server/repos/items.iso.test.ts` — блоки изоляции update/read на реальной Postgres.
- `src/app/(app)/list/[id]/edit/actions.test.ts` — unit-тесты updateItem (копейки, safeParse, userId из сессии).
- `src/components/items/AddItemForm.test.tsx` — кейсы edit-режима (prefill, monthlyPayment, updateItem, лейбл).
- `e2e/app/edit-item.spec.ts` — сквозной e2e-tracer.

## Decisions Made

- **ScoreBreakdown actions-слот** (вместо отдельного футер-ряда из UI-SPEC-альтернативы): чтобы триггер разбивки делил flex-ряд с иконкой Pencil (триггер `flex-1 min-w-0 h-11`, иконка `shrink-0`), при этом `CollapsibleContent` остаётся во всю ширину карточки, а тап по иконке не переключает Collapsible. Это первичная рекомендация UI-SPEC (компактнее по вертикали, mobile-first).
- **loading.tsx добавлен** — реализован UI-SPEC S4 backstop (route-level loading без пустого кадра при переходе на /list/[id]/edit). Плана допускал на усмотрение исполнителя.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Модификация ScoreBreakdown для actions-слота**
- **Found during:** Task 1 (реализация ряда действий на ItemCard)
- **Issue:** `ScoreBreakdown` инкапсулировал весь `Collapsible` с full-width триггером; чтобы иконка Pencil делила flex-ряд с триггером (UI-SPEC §Ряд действий) без вложения в него, нужен был слот рядом с триггером. `ScoreBreakdown` не входил в исходный `files_modified`.
- **Fix:** Добавлен опциональный prop `actions?: ReactNode`, триггер обёрнут в flex-ряд (`flex-1 min-w-0 h-11` + `actions` как shrink-0 сосед); `CollapsibleContent` не тронут (остаётся во всю ширину).
- **Files modified:** src/components/items/ScoreBreakdown.tsx
- **Verification:** e2e (тап Pencil ведёт на /edit, не раскрывает разбивку) + существующие RTL-тесты ScoreBreakdown/ItemCard зелёные (11/11).
- **Committed in:** 89d05e8 (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Модификация в духе UI-SPEC (план явно просил читать ScoreBreakdown и придать триггеру flex-1 min-w-0 h-11). Без scope creep; изменение аддитивное (prop опционален) и reversible.

## Issues Encountered

None — оба задания выполнены без блокеров. `seedItem` в `tests/helpers/db.ts` не потребовал расширения (изоляционные тесты используют дефолтные поля).

## User Setup Required

None — внешней конфигурации сервисов не требуется.

## Next Phase Readiness

- Edit-слой готов; Plan 02 (удаление) зеркалит его: `deleteItemForUser`/`deleteItem`/`DeleteItemButton` + `AlertDialog` + иконка `Trash2` в том же `actions`-ряду ItemCard (слот уже готов принять вторую иконку).
- Требуется установка shadcn `AlertDialog` в Plan 02 (`npx shadcn add alert-dialog`).
- Вся проверка зелёная: `npx vitest run` (144 теста), `npx playwright test` (9 e2e), `tsc --noEmit`, eslint (0 ошибок).

## Self-Check: PASSED

Все заявленные файлы существуют на диске; все коммиты задач (df07574, 89d05e8, bc0d6f5) присутствуют в истории git.

---
*Phase: 03-edit-delete-items*
*Completed: 2026-08-02*
