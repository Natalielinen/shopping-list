---
phase: 04-list-sort-filter-archive
plan: 02
subsystem: list-logic
tags: [sort, partition, pure-function, tdd, vitest, localeCompare, determinism]

# Dependency graph
requires:
  - phase: 02-scoring-engine
    provides: "образец чистого юнит-тестируемого модуля src/lib/scoring/scoring.ts (экспортируемые чистые функции, входы-примитивы, без Date.now() внутри)"
  - phase: 04-list-sort-filter-archive
    provides: "семантика purchasedAt (null = активна, non-null = архив, D-07) из плана 04-01"
provides:
  - "чистый модуль src/lib/list/sort.ts: SortKey, ListItem, partitionByPurchased, sortActive, sortPurchased"
  - "детерминированные компараторы 3 режимов с tiebreakers (priority: total→createdAtMs→id; createdAt: createdAtMs→id; title: localeCompare('ru',base)→createdAtMs→id)"
  - "sortPurchased — архив всегда по purchasedAt убыв., независимо от sortKey (Pitfall 1)"
  - "контракт ListItem (только примитивы из RSC — total/createdAtMs/purchasedAtMs/title/id) для клиентского ListView"
affects: [04-03-list-ui, 04-04-filters, sort, archive]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Клиентская сортировка на предвычисленных в RSC примитивах (total/createdAtMs/purchasedAtMs) — без Date/Date.now() в рантайме, устраняет hydration-mismatch (Pitfall 4 / D-03)"
    - "Полный детерминированный порядок через цепочку tiebreakers с финальным id.localeCompare (D-02)"
    - "Иммутабельные сортировки через [...items].sort — вход не мутируется"

key-files:
  created:
    - src/lib/list/sort.ts
    - src/lib/list/sort.test.ts
  modified: []

key-decisions:
  - "Компараторы byPriority/byCreatedAt/byTitle/byPurchasedAtDesc остаются приватными внутри sort.ts — тестируются через публичные sortActive/sortPurchased (инкапсуляция, как в scoring.ts)."
  - "Активным списком управляет sortKey (Select), а секция «Куплено» ВСЕГДА сортируется по purchasedAt убыв. независимо от sortKey — разрешение неоднозначности контракта (Pitfall 1)."

patterns-established:
  - "Чистый детерминированный слой сортировки на примитивах из RSC — юнит-TDD без БД и без окружения"
  - "localeCompare с явной локалью 'ru' + sensitivity:'base' фиксирует порядок Ё/регистра юнит-тестом (защита от недетерминизма локали, T-4-08)"

requirements-completed: [LIST-01, LIST-02, LIST-03, LIST-05]

coverage:
  - id: D1
    description: "sortActive(items,'priority') — total убыв. → createdAtMs убыв. → id (детерминированный tiebreaker, LIST-01 / D-02)"
    requirement: "LIST-01"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#sortActive — priority (LIST-01, D-02): разные total, tiebreak createdAtMs, финальный tiebreak id, отрицательные total"
        status: pass
    human_judgment: false
  - id: D2
    description: "sortActive(items,'createdAt') — createdAtMs убыв. → id (новые сверху, LIST-02 / D-02)"
    requirement: "LIST-02"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#sortActive — createdAt (LIST-02, D-02): новые сверху, tiebreak id, независимость от total"
        status: pass
    human_judgment: false
  - id: D3
    description: "sortActive(items,'title') — localeCompare('ru',{sensitivity:'base'}) → createdAtMs убыв. → id; Ё и регистр упорядочены корректно (LIST-03 / D-02 / Pitfall 5 / T-4-08)"
    requirement: "LIST-03"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#sortActive — title (LIST-03): алфавит ru, «Молоко»/«молоко» base-равны, «Ёлка»/«ёлка» base-равны, tiebreak createdAtMs→id"
        status: pass
    human_judgment: false
  - id: D4
    description: "partitionByPurchased делит по purchasedAtMs === null (активные) против non-null (архив, включая 0); порядок входа сохраняется"
    requirement: "LIST-05"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#partitionByPurchased (LIST-04, D-07): split null/non-null, purchasedAtMs===0 → архив, сохранение порядка входа"
        status: pass
    human_judgment: false
  - id: D5
    description: "sortPurchased всегда сортирует по purchasedAt убыв. → id, независимо от sortKey активного списка (LIST-05 / Pitfall 1)"
    requirement: "LIST-05"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#sortPurchased (LIST-05, Pitfall 1): purchasedAt убыв., tiebreak id, независимость от total/title"
        status: pass
    human_judgment: false
  - id: D6
    description: "sortActive/sortPurchased не мутируют входной массив ([...items].sort)"
    verification:
      - kind: unit
        ref: "src/lib/list/sort.test.ts#иммутабельность: новый массив, исходный порядок входа сохранён"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 02: Чистая логика сортировки и партиционирования — Summary

**Чистый детерминированный модуль `src/lib/list/sort.ts` (SortKey/ListItem + partitionByPurchased/sortActive/sortPurchased) с компараторами трёх режимов, tiebreakers D-02, localeCompare('ru', base) и независимой сортировкой архива по purchasedAt убыв. — покрыт 19 юнит-тестами TDD RED→GREEN**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 1 (TDD RED→GREEN, без REFACTOR — реализация уже чистая)
- **Files modified:** 2 (оба созданы)

## Accomplishments

- Создан чистый модуль `src/lib/list/sort.ts` по образцу `src/lib/scoring/scoring.ts`: тип `SortKey` (`"priority" | "createdAt" | "title"`), интерфейс `ListItem` (только примитивы из RSC — `id`, `title`, `total`, `createdAtMs`, `purchasedAtMs: number | null`), функции `partitionByPurchased`, `sortActive`, `sortPurchased`.
- Реализованы три компаратора активного списка с детерминированными цепочками tiebreakers (D-02): `byPriority` (`total` убыв. → `createdAtMs` убыв. → `id`), `byCreatedAt` (`createdAtMs` убыв. → `id`), `byTitle` (`localeCompare('ru', {sensitivity:'base'})` → `createdAtMs` убыв. → `id`). Финальный `id.localeCompare` гарантирует полный стабильный порядок.
- `partitionByPurchased` делит по `purchasedAtMs === null` (активные) против non-null (архив, включая `0`), сохраняя исходный порядок входа до отдельной сортировки.
- `sortPurchased` всегда сортирует архив по `purchasedAt` убыв. (tiebreak `id`) — независимо от `sortKey` активного списка (§Pitfall 1): `Select` управляет только активным списком, секция «Куплено» упорядочена по времени покупки.
- Модуль чист и иммутабелен: никаких `Date`/`Date.now()` в рантайме (сортировка по предвычисленным ms, §Pitfall 4 / D-03), сортировки через `[...items].sort` не мутируют вход.
- Написан RED-first юнит-тест `src/lib/list/sort.test.ts` (19 кейсов): priority-tiebreak (включая отрицательные total), createdAt, title (алфавит ru, «Молоко»/«молоко» и «Ёлка»/«ёлка» base-равны), partition (в т.ч. `purchasedAtMs===0` → архив), независимость `sortPurchased` от sortKey, иммутабельность.

## Task Commits

1. **Задача 1 (RED): падающий тест модуля сортировки/партиции** — `7c3a959` (test)
2. **Задача 1 (GREEN): реализация sort.ts** — `800377f` (feat)

_REFACTOR-коммит не потребовался: реализация с самого начала соответствует §Code Examples RESEARCH и чиста._

## Files Created/Modified

- `src/lib/list/sort.ts` — новый чистый модуль сортировки/партиционирования (тип `SortKey`, интерфейс `ListItem`, приватные компараторы, публичные `partitionByPurchased`/`sortActive`/`sortPurchased`)
- `src/lib/list/sort.test.ts` — новый Vitest-тест (19 кейсов из `<behavior>`)

## Decisions Made

- Компараторы `byPriority`/`byCreatedAt`/`byTitle`/`byPurchasedAtDesc` оставлены приватными внутри `sort.ts` и тестируются через публичные `sortActive`/`sortPurchased` (инкапсуляция по образцу `scoring.ts`; потребитель символов — `ListView` планов 04-03/04-04).
- Неоднозначность контракта сортировки разрешена в пользу §Pitfall 1: `sortKey` (Select) управляет только активным списком, а `sortPurchased` игнорирует его и всегда сортирует архив по `purchasedAt` убыв.
- Тест «Ё/регистр» зафиксирован как проверка base-равенства: `«Ёлка»`/`«ёлка»` и `«Молоко»`/`«молоко»` не расходятся по регистру (localeCompare возвращает 0), поэтому порядок решает tiebreaker `createdAtMs` убыв. — это и есть корректное поведение для 'ru' + `sensitivity:'base'` (митигация T-4-08).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — чистая логика, без БД и окружения.

## Next Phase Readiness

- Контракт `ListItem` (примитивы из RSC) и функции `partitionByPurchased`/`sortActive`/`sortPurchased` готовы к потреблению клиентским `ListView` (Wave 2/3, планы 04-03/04-04).
- RSC-шов (план 04-03) должен предвычислить `total = computeTotal(item, now)`, `createdAtMs = createdAt.getTime()`, `purchasedAtMs = purchasedAt?.getTime() ?? null` перед передачей клиенту.
- Блокеров нет.

## Self-Check: PASSED

Оба заявленных файла существуют на диске, оба коммита (`7c3a959`, `800377f`) присутствуют в истории git; `npx vitest run src/lib/list` зелёный (19/19), `npx tsc --noEmit` чист, модуль не содержит `Date.now(`/`new Date(`.

---
*Phase: 04-list-sort-filter-archive*
*Completed: 2026-08-09*
