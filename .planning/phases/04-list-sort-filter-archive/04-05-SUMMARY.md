---
phase: 04-list-sort-filter-archive
plan: 05
subsystem: list-ui
tags: [nextjs, client-component, shadcn-checkbox, tailwind, touch-target, accessibility, mobile-first, vitest, rtl, gap-closure]

# Dependency graph
requires:
  - phase: 04-list-sort-filter-archive
    provides: "PurchaseCheckbox (client-leaf с useOptimistic/useTransition, Server Action setItemPurchased, sonner-тост, tracer 04-03); UAT 04-VERIFICATION → gap G-04-2 (чекбокс «слишком большой»)"
provides:
  - "Обёртка-тач-зона 44×44px (<label> h-11 w-11 shrink-0 flex items-center justify-center) вокруг Checkbox с нормальным глифом size-5 (20px) — тач-цель ≥44px сохранена, видимый глиф больше не 44px-квадрат"
  - "RTL-тест PurchaseCheckbox.test.tsx (4 теста: нормальный глиф, тач-зона на обёртке, тап переключает статус, aria-labels без регрессий)"
affects: [05-dependencies-blocking, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Тач-цель ≥44px через обёртку-<label> вокруг меньшего глифа (label форвардит клик на вложенный labelable button) — тот же принцип «большая зона, малый глиф», что и в DeleteItemButton (h-11 w-11 Button + size-4 иконка)"

key-files:
  created:
    - "src/components/items/PurchaseCheckbox.test.tsx — RTL-тест структуры и поведения чекбокса «куплено» (4 теста)"
  modified:
    - "src/components/items/PurchaseCheckbox.tsx — Checkbox обёрнут в <label>-тач-зону (h-11 w-11 shrink-0), сам Checkbox получил size-5 вместо h-11 w-11"

key-decisions:
  - "Обёртка-тач-зона — <label>, а не <span> с onClick: label штатно форвардит клик на вложенный labelable button чекбокса Radix, без ручной делегации событий — RTL-тест C (тап по обёртке → setItemPurchased) это подтверждает."
  - "size-5 (20px) на самом Checkbox переопределяет базовый size-4 (16px) из shadcn через tailwind-merge — глиф чуть крупнее дефолтного для комфортного попадания, но много меньше прежних 44px."

patterns-established:
  - "Тач-цель ≥44px обеспечивается родителем-обёрткой, НЕ раздуванием самого визуального контрола — глиф остаётся пропорциональным (mobile-first + доступность)"

requirements-completed: [LIST-08]

coverage:
  - id: D1
    description: "Видимый глиф чекбокса «куплено» — нормального размера (size-5, 20px), а не 44×44px квадрат: класса h-11/w-11 на самом элементе role=checkbox нет (G-04-2)"
    requirement: "LIST-08"
    verification:
      - kind: unit
        ref: "src/components/items/PurchaseCheckbox.test.tsx — A: видимый глиф чекбокса нормального размера (size-5, без h-11/w-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Тач-зона чекбокса ≥44px сохранена: обёртка-родитель несёт h-11 w-11 shrink-0; тап по всей зоне вызывает setItemPurchased(id, true) ровно один раз"
    requirement: "LIST-08"
    verification:
      - kind: unit
        ref: "src/components/items/PurchaseCheckbox.test.tsx — B: обёртка-родитель несёт h-11 w-11 shrink-0; C: тап по тач-зоне вызывает setItemPurchased(id, true) один раз"
        status: pass
    human_judgment: false
  - id: D3
    description: "aria-labels без регрессий: purchased=false → «Отметить купленной», purchased=true → «Вернуть в активные»; оптимистичный поток useOptimistic/useTransition и undo-тост не изменены"
    requirement: "LIST-08"
    verification:
      - kind: unit
        ref: "src/components/items/PurchaseCheckbox.test.tsx — D: aria-labels без регрессий (Отметить купленной / Вернуть в активные)"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 05: Нормальный глиф чекбокса «куплено» внутри 44px тач-зоны (G-04-2) — Summary

**Косметическая gap-правка: чекбокс «куплено» больше не рендерится как 44×44px квадрат — сам глиф вернулся к нормальному size-5 (20px), а тач-зона ≥44px обеспечена обёрткой-`<label>` (h-11 w-11 shrink-0); оптимистичное поведение, undo-тост и aria-labels не тронуты; TDD RED→GREEN, весь набор зелёный.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-08-09
- **Tasks:** 2 (Задача 1 — падающий RTL-тест RED; Задача 2 — обёртка-тач-зона + size-5 GREEN)
- **Files modified:** 2 (1 создан, 1 изменён)

## Accomplishments

- **Устранён косметический пробел G-04-2** (UAT-тест 2, severity `cosmetic`): в `PurchaseCheckbox.tsx` класс `h-11 w-11 shrink-0`, раздувавший сам видимый глиф shadcn `Checkbox` до 44×44px, снят. Вместо него `<Checkbox>` обёрнут в тач-зону-`<label>` `flex h-11 w-11 shrink-0 items-center justify-center`, а самому чекбоксу задан `className="size-5"` (20px) — обычный глиф поверх базового `size-4` из shadcn (tailwind-merge переопределяет).
- **Тач-цель ≥44px сохранена:** `<label>` форвардит клик на вложенный labelable button чекбокса Radix, поэтому тап по всей 44px-зоне по-прежнему вызывает `onCheckedChange → setItemPurchased`. Ручной делегации событий не понадобилось — предположение о форвардинге label подтверждено RTL-тестом C.
- **Логика не изменена:** `useOptimistic`/`useTransition`, оптимистичный флип, `router.refresh()`, undo-тост sonner («Отменить») и aria-labels («Отметить купленной» / «Вернуть в активные») остались как были. Обёртка оборачивает ТОЛЬКО чекбокс, поэтому гарантия «тап по чекбоксу не раскрывает Collapsible разбивки очков» (§Pitfall 7 / LIST-07) не нарушена.
- **Новый RTL-тест** `PurchaseCheckbox.test.tsx` (каркас `DeleteItemButton.test.tsx`, моки `next/navigation`, `@/app/(app)/list/actions`, `sonner`): Тест A — глиф без `h-11`/`w-11`, с `size-5`; Тест B — родитель-обёртка несёт `h-11 w-11 shrink-0`; Тест C — тап по обёртке вызывает `setItemPurchased(id, true)` один раз; Тест D — aria-labels при `purchased` false/true.

## Task Commits

Каждая задача закоммичена атомарно (TDD RED → GREEN):

1. **Задача 1 (RED): падающий RTL-тест на нормальный глиф + 44px тач-зону** — `c9a8b52` (test) — 4 теста A/B/C/D; на неисправленном компоненте (`h-11 w-11` на `Checkbox`, без обёртки и `size-5`) падал по A и B — состояние RED подтверждено, коммит сделан до GREEN.
2. **Задача 2 (GREEN): обёртка-тач-зона 44px + нормальный глиф** — `812a0a1` (fix) — `<label>`-тач-зона (`h-11 w-11 shrink-0`) вокруг `<Checkbox className="size-5">`; логика/aria/undo без изменений; все 4 теста зелёные.

**Plan metadata:** docs-коммит ниже (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md).

## Files Created/Modified

- `src/components/items/PurchaseCheckbox.tsx` (изм.) — `<Checkbox>` обёрнут в `<label className="flex h-11 w-11 shrink-0 items-center justify-center">` (тач-зона ≥44px); с самого `<Checkbox>` убраны `h-11 w-11 shrink-0`, задан `className="size-5"`. Ведущий комментарий-блок обновлён: описан принцип «тач-зона-обёртка 44px + нормальный глиф внутри».
- `src/components/items/PurchaseCheckbox.test.tsx` (нов.) — RTL-тест: 4 теста (нормальный глиф `size-5` без `h-11`/`w-11`; обёртка-родитель `h-11 w-11 shrink-0`; тап по зоне → `setItemPurchased(id, true)` один раз; aria-labels без регрессий).

## Decisions Made

- **Обёртка — `<label>`, а не `<span onClick>`:** label штатно форвардит клик на вложенный labelable button чекбокса Radix, без ручной делегации событий. RTL-тест C (тап по `checkbox.parentElement` → `setItemPurchased` один раз) подтверждает форвардинг — план не потребовал запасной схемы с onClick-делегацией.
- **`size-5` (20px) на самом `Checkbox`:** переопределяет базовый `size-4` (16px) shadcn через tailwind-merge — глиф чуть крупнее дефолтного для комфортного попадания, но много меньше прежних 44px, что и требует UI-SPEC §Spacing.

## Deviations from Plan

None — план выполнен как написано. TDD-порядок соблюдён: RED-тест (`c9a8b52`) закоммичен до GREEN-фикса (`812a0a1`).

## Issues Encountered

None — обе задачи выполнены без блокеров.

## Verification Results

- `npx vitest run src/components/items/PurchaseCheckbox.test.tsx` — **4/4 зелёный**.
- `npx vitest run` (весь набор) — **193/193 зелёный** (16 файлов; регрессий в add/edit/delete/scoring/sort/ListControls нет).
- `npx tsc --noEmit` — **чист** (exit 0).
- Ручная сверка на 375px (глиф обычного размера, тап по 44px-зоне отмечает купленной и НЕ раскрывает разбивку) — опциональна; закрывается общим UAT-бэкстопом фазы (LIST-08).

## User Setup Required

None — внешней настройки не требуется (изменение чисто презентационное: CSS-классы + DOM-обёртка).

## Next Phase Readiness

- Gap G-04-2 закрыт: чекбокс «куплено» опрятного размера при сохранённой тач-цели ≥44px. Фаза 4 функционально и косметически завершена.
- Фаза 5 (зависимости/блокировка) переиспользует `PurchaseCheckbox`/`setItemPurchased` без изменений контракта (тач-зона + оптимистичный поток стабильны).
- Блокеров нет.

## Self-Check: PASSED

Все заявленные файлы существуют на диске; оба коммита задач (`c9a8b52`, `812a0a1`) присутствуют в истории git.

---
*Phase: 04-list-sort-filter-archive*
*Completed: 2026-08-09*
