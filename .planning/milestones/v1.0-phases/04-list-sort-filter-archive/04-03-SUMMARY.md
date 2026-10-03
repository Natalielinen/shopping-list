---
phase: 04-list-sort-filter-archive
plan: 03
subsystem: list-ui
tags: [tracer, server-action, useOptimistic, sonner, rsc-boundary, idor, e2e, playwright]

# Dependency graph
requires:
  - phase: 04-list-sort-filter-archive
    provides: "изолированный по userId write-шов setItemPurchasedForUser (04-01) + nullable purchased_at; чистый модуль sort.ts (partitionByPurchased/sortActive, 04-02)"
  - phase: 03-item-crud
    provides: "образец client-leaf + Server Action без redirect (DeleteItemButton/deleteItem), каркас e2e (delete-item.spec), RSC-список с единым now"
provides:
  - "Server Action setItemPurchased(id, purchased) — requireUser, scoped, strict boolean, no-op≠успех, без redirect"
  - "client-leaf PurchaseCheckbox (useOptimistic + useTransition + router.refresh в одном startTransition) + sonner undo-тост"
  - "граница RSC→client на примитивах: page.tsx считает total/createdAtMs/purchasedAtMs единым now → клиентский ListView"
  - "минимальный ListView (партиция + рендер активных; купленные скрыты) — расширяется в 04-04"
  - "sonner@2.0.7 + Toaster (theme=light, bottom-center) смонтирован один раз в (app)/layout.tsx"
  - "сквозной e2e purchase-archive.spec.ts (mark → archive → undo)"
affects: [04-04-list-ui, sort, archive, filters]

# Tech tracking
tech-stack:
  added:
    - "sonner@2.0.7 (официальный shadcn-компонент; обёртка упрощена до theme=light, next-themes НЕ добавлен)"
  patterns:
    - "Оптимистичный toggle: useOptimistic(проп) + useTransition; setOptimistic → await action → router.refresh() внутри ОДНОГО startTransition (реконсиляция без отскока, §Pitfall 3)"
    - "Граница RSC→client на примитивах (числа/null, никаких Date) — total считается единым now в RSC (§Pitfall 4 / D-03)"
    - "Undo вместо подтверждения для недеструктивного действия — sonner toast с action «Отменить» (D-04/D-05)"

key-files:
  created:
    - src/app/(app)/list/actions.ts
    - src/components/items/PurchaseCheckbox.tsx
    - src/components/items/ListView.tsx
    - src/components/ui/sonner.tsx
    - e2e/app/purchase-archive.spec.ts
  modified:
    - src/app/(app)/layout.tsx
    - src/components/items/ItemCard.tsx
    - src/app/(app)/list/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "useOptimistic (не fallback A1): реконсиляция после router.refresh() внутри той же транзакции работает без отскока — e2e зелёный, плоский useState-фолбэк не понадобился."
  - "Граница page.tsx→ListView: RSC отдаёт массив ListViewItem (ListItem-примитивы + breakdown); partitionByPurchased/sortActive переупорядочивают ссылки, поэтому breakdown уцелевает и тип сужается обратно к ListViewItem без повторного поиска."
  - "Тост возврата в активные — без кнопки «Отменить» (Open Question 1): обратное действие само по себе undo, меньше визуального шума."
  - "sonner-обёртка упрощена до theme=light; next-themes удалён из зависимостей (тёмной темы в проекте нет)."

patterns-established:
  - "Оптимистичный обратимый toggle-статус через useOptimistic+useTransition+router.refresh (образец для будущих недеструктивных write-действий)"
  - "RSC precompute → client-контейнер на примитивах (первый 'use client'-контейнер поверх RSC-данных в проекте)"

requirements-completed: [LIST-04]

coverage:
  - id: D1
    description: "Отметка активной покупки купленной чекбоксом → исчезает из активного списка (дефолтный вид); undo-тост «Покупка отмечена купленной» + «Отменить» возвращает (LIST-04 / D-04)"
    requirement: "LIST-04"
    verification:
      - kind: e2e
        ref: "e2e/app/purchase-archive.spec.ts — mark → card leaves active list + toast → «Отменить» restores"
        status: pass
    human_judgment: false
  - id: D2
    description: "setItemPurchased берёт userId ТОЛЬКО из requireUser(); strict boolean; no-op (repo null) → { ok: false }; без redirect (D-08 / WR-01 / Pitfall 6)"
    requirement: "LIST-04"
    verification:
      - kind: other
        ref: "grep: actions.ts содержит requireUser(, не содержит redirect(; !row → { ok: false }; изоляция шва setItemPurchasedForUser доказана IDOR-тестом 04-01"
        status: pass
    human_judgment: false
  - id: D3
    description: "Граница RSC→client на примитивах: page.tsx считает total единым now и отдаёт createdAtMs/purchasedAtMs как числа/null (§Pitfall 4 / D-03/D-10); .sort из RSC удалён"
    requirement: "LIST-04"
    verification:
      - kind: other
        ref: "grep: page.tsx содержит getTime(), не передаёт Date; npx tsc --noEmit зелёный; e2e без hydration-mismatch"
        status: pass
    human_judgment: false
  - id: D4
    description: "Оптимистичный флип (useOptimistic) виден мгновенно, pending-guard (disabled) от двойного тапа, router.refresh() внутри той же транзакции — без отскока (D-04 / Pitfall 3)"
    requirement: "LIST-04"
    verification:
      - kind: e2e
        ref: "e2e/app/purchase-archive.spec.ts — переход групп стабилен, отскока нет"
        status: pass
    human_judgment: false
  - id: D5
    description: "sonner установлен (theme=light, без next-themes), Toaster смонтирован один раз в (app)/layout.tsx"
    verification:
      - kind: other
        ref: "package.json содержит sonner, не содержит next-themes; sonner.tsx = theme=\"light\" без useTheme; layout.tsx монтирует <Toaster один раз"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 03: TRACER — отметка «куплено» end-to-end — Summary

**Тончайший сквозной путь «отметить покупку купленной» прошит через ВСЕ слои Фазы 4 (RSC-примитивы → клиентский ListView → client-leaf PurchaseCheckbox с useOptimistic → Server Action setItemPurchased → repo-шов 04-01 → PG → router.refresh), доказан сквозным Playwright-тестом; undo-тост sonner смонтирован**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 2 (Задача 1 — sonner + Toaster; Задача 2 — TRACER TDD RED→GREEN)
- **Files modified:** 10 (5 созданы, 5 изменены — включая package.json/lock)

## Accomplishments

- Установлен `sonner@2.0.7` официальным shadcn-путём; обёртка `src/components/ui/sonner.tsx` упрощена до фиксированного `theme="light"` (убран `useTheme`/`next-themes` из дефолтного шаблона), а сама зависимость `next-themes` удалена из проекта. `<Toaster position="bottom-center" richColors={false} />` смонтирован ровно один раз в `(app)/layout.tsx` рядом с `<main>` — layout остаётся RSC (Toaster — client-leaf).
- Реализован Server Action `setItemPurchased(id, purchased)` (`src/app/(app)/list/actions.ts`, новый файл рядом с `page.tsx`) по образцу `deleteItem`: `requireUser()` (userId ТОЛЬКО из сессии, D-08), приведение аргумента к строгому boolean (V5/T-4-05), вызов изолированного шва `setItemPurchasedForUser`; `null` от repo → `{ ok: false }` (no-op ≠ успех, WR-01); БЕЗ `redirect()` (Pitfall 6). Изоляция записи (IDOR) уже доказана интеграционным тестом плана 04-01.
- Создан client-leaf `PurchaseCheckbox` (`useOptimistic` + `useTransition`): `setOptimistic(next)` → `await setItemPurchased(id, next)` → `router.refresh()` — всё внутри ОДНОГО `startTransition`, поэтому свежие RSC-данные подтягиваются до завершения транзакции и оптимистичное значение не «отскакивает» (§Pitfall 3). `disabled={isPending}` — guard от двойного тапа; `aria-label` переключается «Отметить купленной» / «Вернуть в активные». После успеха — `sonner`-тост «Покупка отмечена купленной» с действием «Отменить» (undo = `setItemPurchased(id, false)`); ошибка → `toast.error(...)`, оптимистика откатывается.
- Введена граница RSC→client на примитивах: `page.tsx` считает `total` единым `now`, приводит `createdAtMs: item.createdAt.getTime()` и `purchasedAtMs: item.purchasedAt?.getTime() ?? null` (§Pitfall 4), удаляет `.sort(...)` из RSC и передаёт массив `ListViewItem` в клиентский `ListView`. Наследуемый empty-state «Список пуст» (0 покупок) сохранён — панель/ListView не рендерятся.
- Создан минимальный клиентский `ListView` (`"use client"`): `partitionByPurchased(items)` (из 04-02) → рендер только активных `<ItemCard purchased={false} />` (купленные скрыты — дефолтный вид). Контролов сортировки/фильтра и секции «Куплено» здесь ещё нет — их добавит план 04-04.
- `ItemCard` получил проп `purchased: boolean` и встроенный `<PurchaseCheckbox>` ведущим контролом ряда заголовка (перед `title`): три независимых тач-цели ≥44px — чекбокс (`h-11 w-11 shrink-0`), title (`min-w-0 flex-1 truncate`), badge (`shrink-0`) (§Pitfall 7). Ряд действий (ScoreBreakdown + Pencil + DeleteItemButton) — без изменений.
- Написан RED-first сквозной e2e `e2e/app/purchase-archive.spec.ts` (happy path): регистрация через API → добавить покупку → чекбокс «Отметить купленной» → карточка исчезает из активного списка + тост → «Отменить» → карточка вернулась. Доводён до GREEN.

## Task Commits

1. **Задача 1: sonner (theme=light) + Toaster смонтирован один раз** — `81a3186` (feat)
2. **Задача 2 (RED): падающий e2e mark-purchased** — `4a628dd` (test)
3. **Задача 2 (GREEN): tracer end-to-end (action + checkbox + ItemCard + page + ListView)** — `bcfc5ca` (feat)

_REFACTOR-коммит не потребовался: реализация с самого начала соответствует §Code Examples RESEARCH; реконсиляция useOptimistic сработала без фолбэка._

## Files Created/Modified

- `src/components/ui/sonner.tsx` (нов.) — упрощённая обёртка Toaster (`theme="light"`, без `next-themes`)
- `src/app/(app)/layout.tsx` (изм.) — импорт + монтаж `<Toaster>` один раз
- `src/app/(app)/list/actions.ts` (нов.) — Server Action `setItemPurchased` + тип `SetPurchasedResult`
- `src/components/items/PurchaseCheckbox.tsx` (нов.) — client-leaf с `useOptimistic`/`useTransition`/`sonner`
- `src/components/items/ListView.tsx` (нов.) — минимальный клиентский контейнер (партиция + активные)
- `src/components/items/ItemCard.tsx` (изм.) — проп `purchased` + ведущий `<PurchaseCheckbox>`
- `src/app/(app)/list/page.tsx` (изм.) — RSC-примитивы (`total`/`createdAtMs`/`purchasedAtMs`) → `ListView`; `.sort` удалён
- `e2e/app/purchase-archive.spec.ts` (нов.) — сквозной e2e happy path
- `package.json` / `package-lock.json` (изм.) — +`sonner@2.0.7`, −`next-themes`

## Decisions Made

- **useOptimistic вместо фолбэка A1:** реконсиляция после `router.refresh()` внутри той же транзакции работает без отскока — e2e зелёный, плоский `useState`-оптимизм (каркас `DeleteItemButton`) не понадобился. Assumption A1 подтверждена.
- **Форма границы `page.tsx → ListView`:** RSC отдаёт `ListViewItem[]` = примитивы `ListItem` (04-02) + `breakdown`. `partitionByPurchased`/`sortActive` только переупорядочивают ссылки на исходные объекты (не копируют), поэтому `breakdown` уцелевает и тип сужается обратно к `ListViewItem` без повторного поиска по id.
- **Тост возврата в активные — без кнопки «Отменить»** (Open Question 1): обратное действие само по себе undo прямого — меньше визуального шума.
- **`next-themes` удалён из зависимостей:** тёмной темы в проекте нет; обёртка sonner зафиксирована на `theme="light"` (§Anti-Patterns RESEARCH).

## Deviations from Plan

None — план выполнен как написано.

_Примечание: `sonner.tsx` реализован в минимальной форме из RESEARCH §Code Examples (без иконок/CSS-vars дефолтного shadcn-шаблона) — достаточно для контракта UI-SPEC (`theme="light"`, без `next-themes`) и не тянет неиспользуемые классы._

## Issues Encountered

None. `npx shadcn add sonner` штатно подтянул `next-themes` как транзитивную зависимость обёртки — удалён `npm uninstall next-themes` после упрощения обёртки (ожидаемый шаг плана).

## TDD Gate Compliance

Задача 2 (`tdd="true"`) прошла RED→GREEN: коммит `test(...)` (`4a628dd`, падающий e2e) предшествует коммиту `feat(...)` (`bcfc5ca`, реализация). RED-состояние гарантировано структурно (в момент теста не существовало `PurchaseCheckbox`/aria-label «Отметить купленной»); GREEN наблюдался прямым прогоном `npx playwright test e2e/app/purchase-archive` (1 passed).

## Verification Results

- `npx playwright test e2e/app/purchase-archive` — зелёный (1 passed): happy path mark → archive → undo.
- `npx playwright test` (полный e2e) — 11/11 зелёный (add/edit/delete/auth не сломаны).
- `npx vitest run` — 182/182 зелёный (unit+integration не сломаны).
- `npx tsc --noEmit` — чист.
- `package.json` содержит `sonner`, НЕ содержит `next-themes`; `<Toaster>` смонтирован ровно один раз.

## Known Stubs

- `src/components/items/ListView.tsx` — намеренно минимальный скелет: `sortKey` захардкожен `"priority"`, купленные скрыты, контролов сортировки/фильтра и секции «Куплено» нет. Это осознанный tracer-срез (см. `<objective>` плана); полноценные `ListControls`/сортировка/секция «Куплено»/empty-состояния «все куплены» реализует план **04-04**. Данные (примитивы + breakdown) полностью проведены до карточки — стуб не мешает цели tracer (отметить покупку купленной end-to-end).

## User Setup Required

None — использованы уже настроенные локальные БД `shopping_list` (dev) и `shopping_list_test` (test) из `.env.local`.

## Next Phase Readiness

- Архитектура Фазы 4 прошита насквозь на happy-path: план 04-04 достраивает клиентский слой (ListControls — Select сортировки D-01 + Checkbox фильтра D-06; секция «Куплено» D-06; приглушённое лечение купленной карточки; empty-состояния «все куплены»; расширенный e2e с фильтром/сортировкой).
- `PurchaseCheckbox` и Server Action готовы; 04-04 переиспользует их для чекбокса в секции «Куплено» (обратный toggle, D-05).
- LIST-08 (mobile-first, human/visual backstop) остаётся открытым до 04-04 — панель управления (ключевая мобильная поверхность) ещё не построена; backstop-проверки на 375px выполняются после 04-04.
- Блокеров нет.

## Self-Check: PASSED

Все заявленные файлы существуют на диске; все три коммита (`81a3186`, `4a628dd`, `bcfc5ca`) присутствуют в истории git.

---
*Phase: 04-list-sort-filter-archive*
*Completed: 2026-08-09*
