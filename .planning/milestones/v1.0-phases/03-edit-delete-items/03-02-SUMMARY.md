---
phase: 03-edit-delete-items
plan: 02
subsystem: ui
tags: [nextjs, server-actions, drizzle, radix, alert-dialog, playwright, vitest, idor]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: шов изоляции userId (requireUser/getCurrentUser), e2e-инфраструктура на DATABASE_URL_TEST
  - phase: 02-add-item-scoring
    provides: findItemsForUser/ItemCard/ScoreBreakdown (actions-слот), shadcn/radix-ui-примитивы
  - phase: 03-edit-delete-items
    plan: 01
    provides: updateItemForUser/updateItem (шов, зеркалируемый удалением), ItemCard actions-слот, edit/actions.ts + iso/actions-тесты
provides:
  - "deleteItemForUser(userId, id) — delete репо-функция со scoping по userId (hard delete, .returning() → row ?? null)"
  - "deleteItem(id) + тип DeleteItemResult — Server Action удаления (requireUser + { ok }, без payload-валидации, D-06)"
  - "shadcn AlertDialog примитив (src/components/ui/alert-dialog.tsx)"
  - "DeleteItemButton({ id }) — client-leaf: Trash2-триггер + AlertDialog confirm, pending-guard, error оставляет диалог открытым, успех → router.refresh()"
  - "ItemCard с delete-иконкой (Trash2) последней в actions-ряду"
affects: [04-archive (undo/восстановление удаления), 05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Destructive-действие через AlertDialog confirm: client-leaf вокруг Server Action, e.preventDefault() на AlertDialogAction удерживает диалог открытым до завершения async (ошибка не закрывает диалог)"
    - "deleteItemForUser — CRUD D со scoping and(eq(id), eq(userId)); IDOR на удаление невозможен (зеркало update-шва Plan 01)"

key-files:
  created:
    - "src/components/ui/alert-dialog.tsx — shadcn copy-in (unified radix-ui)"
    - "src/components/items/DeleteItemButton.tsx — client-leaf + AlertDialog confirm"
    - "src/components/items/DeleteItemButton.test.tsx — RTL confirm/cancel/error/pending"
    - "e2e/app/delete-item.spec.ts — сквозной e2e удаления"
  modified:
    - "src/server/repos/items.ts — deleteItemForUser (delete, scoping)"
    - "src/app/(app)/list/[id]/edit/actions.ts — Server Action deleteItem + тип DeleteItemResult"
    - "src/components/items/ItemCard.tsx — DeleteItemButton последним в actions-ряду"
    - "src/server/repos/items.iso.test.ts — изоляция delete по userId (T-3-05)"
    - "src/app/(app)/list/[id]/edit/actions.test.ts — unit-тесты deleteItem"

key-decisions:
  - "AlertDialog взят из уже установленного unified-пакета radix-ui (1.6.7), а не из отдельного @radix-ui/react-alert-dialog — нулевой прирост supply-chain-поверхности (T-3-SC ещё ниже ожидаемого)"
  - "onOpenChange сбрасывает error при закрытии диалога — следующее открытие стартует с чистого состояния (без залипшей ошибки прошлого клика)"

patterns-established:
  - "Удаление зеркалит update-шов Plan 01: меняется только глагол (update→delete) и то, что удаление НЕ валидирует payload (D-06 — только id + scoping)"
  - "Destructive-подтверждение: AlertDialogAction.onClick → e.preventDefault() + async-handler; успех сам закрывает диалог (setOpen(false)), ошибка оставляет открытым"

requirements-completed: [ITEM-08]

coverage:
  - id: D1
    description: "deleteItemForUser со scoping по userId — чужую покупку удалить нельзя (IDOR, T-3-05, SC-3)"
    requirement: ITEM-08
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#deleteItemForUser — изоляция удаления по userId (T-3-05 / AUTH-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deleteItem — requireUser, userId из сессии (не из аргумента), { ok }, ошибка репозитория → { ok: false } с delete-текстом (D-06)"
    requirement: ITEM-08
    verification:
      - kind: unit
        ref: "src/app/(app)/list/[id]/edit/actions.test.ts#deleteItem — изоляция по userId + обработка ошибок (D-06 / T-3-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "DeleteItemButton: тихого удаления нет (только через AlertDialog confirm), «Отмена» не удаляет, { ok: false } оставляет диалог открытым с текстом ошибки, pending-guard от двойного клика (D-05, T-3-06)"
    requirement: ITEM-08
    verification:
      - kind: unit
        ref: "src/components/items/DeleteItemButton.test.tsx#confirm/cancel/error/pending"
        status: pass
    human_judgment: false
  - id: D4
    description: "Сквозной путь: карточка → иконка «корзина» → AlertDialog → «Удалить» → покупка исчезает из /list; «Отмена» оставляет покупку (SC-2, D-05/D-07)"
    requirement: ITEM-08
    verification:
      - kind: e2e
        ref: "e2e/app/delete-item.spec.ts#удаление покупки: подтверждение убирает покупку, «Отмена» нет"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ряд действий: delete-иконка крайняя справа, нейтральна в покое → text-destructive на hover/focus, тач-зона ≥44px, тап по ней не переключает Collapsible (D-04)"
    verification: []
    human_judgment: true
    rationale: "Визуальные критерии (цвет hover/focus, тач-зоны на 375px, отсутствие срабатывания Collapsible при тапе) требуют ручной проверки на устройстве"

# Metrics
duration: 5min
completed: 2026-08-02
status: complete
---

# Phase 3 Plan 02: Сквозной срез удаления покупки Summary

**Удаление покупки end-to-end (ITEM-08): иконка «корзина» на карточке → AlertDialog подтверждения → Server Action deleteItem со scoping по userId → deleteItemForUser (hard delete) → router.refresh(), покупка исчезает из списка. Защита от случайного необратимого действия (D-05) и изоляция по userId (T-3-05, SC-3).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-02T06:35:32Z
- **Completed:** 2026-08-02T06:41:00Z
- **Tasks:** 3
- **Files modified:** 9 (4 создано, 5 изменено)

## Accomplishments

- Сквозной tracer удаления: карточка → «корзина» → AlertDialog → «Удалить» → покупка исчезает из /list; «Отмена» оставляет покупку (e2e зелёный).
- Изоляция удаления по userId (IDOR, T-3-05): `deleteItemForUser` скоупит DELETE `and(eq(items.id, id), eq(items.userId, userId))`; чужую покупку удалить нельзя (WHERE не находит строку → `.returning()` пуст → null, строка на месте). Доказано на реальной Postgres.
- `deleteItem(id)` — Server Action без payload-валидации (D-06): единственная защита — scoping по userId из `requireUser()`; userId никогда не из аргумента; ошибка репозитория → `{ ok: false }` с текстом «Не удалось удалить покупку. Попробуйте ещё раз.».
- `DeleteItemButton` — тихого удаления нет (D-05): только через AlertDialog confirm; `e.preventDefault()` на `AlertDialogAction` удерживает диалог открытым до завершения async, поэтому при ошибке диалог остаётся открыт и покупка не исчезает (T-3-06); pending-guard от двойного клика.
- `AlertDialog` установлен из уже присутствующего unified-пакета `radix-ui` — нулевой прирост supply-chain.

## Task Commits

Каждая задача закоммичена атомарно (Task 1 — TDD RED → GREEN):

1. **Task 1: изоляция delete + deleteItem action тесты (RED)** — `dffa932` (test)
2. **Task 1: deleteItemForUser (scoped) + deleteItem Server Action (GREEN)** — `f9d603e` (feat)
3. **Task 2: AlertDialog + DeleteItemButton в ряду действий ItemCard** — `4d4f12b` (feat)
4. **Task 3: e2e удаления** — `d36cb8d` (test)

**Plan metadata:** (docs-коммит ниже)

## Files Created/Modified

- `src/server/repos/items.ts` — `deleteItemForUser(userId, id)`: hard delete со scoping, `.returning()` → row ?? null.
- `src/app/(app)/list/[id]/edit/actions.ts` — Server Action `deleteItem(id)`: `requireUser` + try/catch + `{ ok }`, без `safeParse` (D-06); экспортирован тип `DeleteItemResult`.
- `src/components/ui/alert-dialog.tsx` — shadcn примитив AlertDialog (unified `radix-ui`).
- `src/components/items/DeleteItemButton.tsx` — client-leaf: Trash2-триггер (aria-label «Удалить покупку», нейтральный → `text-destructive` на hover/focus), AlertDialog confirm, filled-destructive «Удалить», pending-guard, error оставляет диалог открытым, успех → `setOpen(false)` + `router.refresh()`.
- `src/components/items/ItemCard.tsx` — `DeleteItemButton` последним в actions-ряду (разбивка → edit → delete), отдельные Button-элементы (тап по delete не переключает Collapsible).
- `src/server/repos/items.iso.test.ts` — блок изоляции delete на реальной Postgres (B → null, A → строка удалена).
- `src/app/(app)/list/[id]/edit/actions.test.ts` — unit-тесты `deleteItem` (userId из сессии, ошибка → `{ ok: false }`).
- `src/components/items/DeleteItemButton.test.tsx` — RTL: открытие диалога, «Отмена» не удаляет, подтверждение вызывает deleteItem один раз + refresh, `{ ok: false }` оставляет диалог с текстом ошибки, pending → «Удалить» disabled.
- `e2e/app/delete-item.spec.ts` — сквозной e2e-tracer удаления.

## Decisions Made

- **AlertDialog из unified `radix-ui`** (а не отдельного `@radix-ui/react-alert-dialog`, как ожидал план): проект использует единый пакет `radix-ui` 1.6.7 (установлен и провалидирован в Фазе 2 для select/checkbox/collapsible). shadcn CLI сгенерировал `alert-dialog.tsx` в той же конвенции (`import { AlertDialog as AlertDialogPrimitive } from "radix-ui"`). Итог: ни одной новой npm-зависимости — supply-chain-поверхность (T-3-SC) даже ниже принятого в threat-модели.
- **Сброс `error` при закрытии диалога** (`onOpenChange`): повторное открытие стартует с чистого состояния, без залипшей ошибки прошлой попытки.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AlertDialog взят из unified-пакета radix-ui, а не из @radix-ui/react-alert-dialog**
- **Found during:** Task 2 (установка примитива)
- **Issue:** План/threat-модель (T-3-SC) ожидали транзитивную установку `@radix-ui/react-alert-dialog`. Фактически проект использует unified-пакет `radix-ui` (1.6.7), который уже содержит `AlertDialog` и был установлен в Фазе 2.
- **Fix:** `npx shadcn@latest add alert-dialog --yes` сгенерировал `src/components/ui/alert-dialog.tsx` в конвенции проекта (импорт из `radix-ui`), новых пакетов не добавлено (`git status` не показал изменений `package.json`/lock). Slopcheck пройден — файл соответствует остальным примитивам ui/.
- **Files modified:** src/components/ui/alert-dialog.tsx (создан)
- **Verification:** `npx tsc --noEmit` (0 ошибок), RTL DeleteItemButton (5/5) и ItemCard-тесты зелёные.
- **Committed in:** 4d4f12b (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Улучшение относительно плана — нулевой прирост supply-chain вместо ожидаемой транзитивной зависимости. Поведение AlertDialog идентично ожидаемому (компоненты Header/Title/Description/Footer/Cancel/Action те же).

## Known Stubs

None — стабов, placeholder-значений или незавершённой логики не осталось. Удаление реализовано полностью: repo → Server Action → UI → e2e.

## Threat Flags

None — новой security-поверхности вне `<threat_model>` не введено. Единственная граница доверия (client → `deleteItem`) закрыта scoping-ом по userId (T-3-05); supply-chain (T-3-SC) — без новых пакетов.

## Issues Encountered

None — три задания выполнены без блокеров. `seedItem` в `tests/helpers/db.ts` не потребовал расширения (изоляционный delete-тест использует дефолтные поля).

## User Setup Required

None — внешней конфигурации сервисов не требуется.

## Next Phase Readiness

- Delete-слайс готов; Фаза 4 (архив/восстановление) может опереться на тот же actions-ряд ItemCard и шов `deleteItemForUser`. Текущее удаление — hard delete без undo (D-05); undo/восстановление — предмет Фазы 4.
- Вся проверка зелёная: `npx vitest run` (154 теста), `npx playwright test` (10 e2e), `tsc --noEmit`, eslint (0 ошибок на изменённых файлах).

## Self-Check: PASSED

Все заявленные файлы существуют на диске; все коммиты задач (dffa932, f9d603e, 4d4f12b, d36cb8d) присутствуют в истории git.

---
*Phase: 03-edit-delete-items*
*Completed: 2026-08-02*
