---
phase: 04-list-sort-filter-archive
plan: 01
subsystem: database
tags: [drizzle, postgres, migration, idor, isolation, tdd, vitest, archive]

# Dependency graph
requires:
  - phase: 03-item-crud
    provides: "шов изоляции items по userId (deleteItemForUser/updateItemForUser), items.iso.test.ts на реальной Postgres, seedItem/seedUser хелперы, миграция 0001"
provides:
  - "nullable-колонка items.purchased_at (D-07: null = активна, non-null timestamp = куплена/в архиве)"
  - "аддитивная миграция drizzle/0002 (ADD COLUMN purchased_at timestamp, без переписи данных)"
  - "изолированный по userId write-шов setItemPurchasedForUser (обратимый true→Date / false→null)"
  - "IDOR/persist/reversal-тест статуса «куплено» на реальной Postgres"
  - "seedItem с опциональным purchasedAt (засеивание купленной покупки)"
affects: [04-02-sort, 04-03-purchase-action, 04-04-list-ui, archive, sort]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Одна nullable timestamp-колонка кодирует и статус, и ключ сортировки архива (D-07)"
    - "Write-шов статуса по образцу deleteItemForUser: .where(and(eq(id), eq(userId))) → no-op null для чужой строки"

key-files:
  created:
    - drizzle/0002_tranquil_slapstick.sql
    - drizzle/meta/0002_snapshot.json
  modified:
    - src/server/db/schema.ts
    - src/server/repos/items.ts
    - src/server/repos/items.iso.test.ts
    - tests/helpers/db.ts

key-decisions:
  - "Задача 1 (гейт необратимости D-07): выбран option-a — одна nullable purchased_at timestamp (без default). null = активна, non-null = куплена/в архиве. Вариант option-b (isPurchased boolean + отдельный purchasedAt) отклонён (две колонки, риск рассинхрона)."
  - "setItemPurchasedForUser не нормализует undefined → null (CR-01 не нужен): единственное поле задаётся явным Date | null."

patterns-established:
  - "Персистентный статус «куплено» = одна nullable timestamp-колонка (статус + сорт-ключ архива в одном поле)"
  - "Изолированный по userId шов записи статуса зеркалит deleteItemForUser (единый WHERE and(eq(id), eq(userId)))"

requirements-completed: [LIST-04]

coverage:
  - id: D1
    description: "Аддитивная nullable-колонка purchased_at на таблице items + миграция 0002 (существующие строки → NULL = активны, D-07)"
    requirement: "LIST-04"
    verification:
      - kind: integration
        ref: "npx drizzle-kit generate (чистый ADD COLUMN) + npx drizzle-kit migrate (0002 применена к dev-БД)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (тип Item авто-расширился purchasedAt: Date | null)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Изолированный по userId write-шов setItemPurchasedForUser: IDOR-невозможность (B не флипает статус A), persist true→Date, reversal false→null (D-05/D-08)"
    requirement: "LIST-04"
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#setItemPurchasedForUser — изоляция записи по userId (LIST-04 / D-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "seedItem расширен опциональным purchasedAt (засеивание купленной покупки для планов 04-02..04-04)"
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts (кейс reversal сеет purchasedAt: new Date())"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 01: Фундамент статуса «куплено» — Summary

**Nullable-колонка `items.purchased_at` (D-07) + аддитивная миграция 0002 + изолированный по userId, обратимый write-шов `setItemPurchasedForUser`, доказанный IDOR/persist/reversal-тестом на реальной Postgres**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-09 (после резолюции гейта Задачи 1)
- **Completed:** 2026-08-09
- **Tasks:** 3 (Задача 1 — решение гейта; Задачи 2–3 — реализация)
- **Files modified:** 6 (2 созданы, 4 изменены)

## Accomplishments

- Добавлена одна nullable-колонка `purchasedAt: timestamp("purchased_at")` (без default) в таблицу `items` — семантика D-07: `null` = активна, non-null timestamp = куплена/в архиве. Тип `Item` авто-расширился полем `purchasedAt: Date | null`, на очки колонка не влияет (не в `ScoredFields`).
- Сгенерирована и применена к dev-БД аддитивная миграция `drizzle/0002_tranquil_slapstick.sql` — чистый `ALTER TABLE "items" ADD COLUMN "purchased_at" timestamp;` без `DROP`/`SET NOT NULL`/переписи данных (существующие строки → NULL = активны).
- Реализован изолированный по `userId` write-шов `setItemPurchasedForUser(userId, id, purchased)` по образцу `deleteItemForUser`: `.where(and(eq(items.id, id), eq(items.userId, userId)))` → чужая строка недостижима (no-op null, IDOR невозможен). Обратимость: `true → new Date()`, `false → null`.
- Написан RED-first интеграционный тест на реальной тестовой Postgres (3 кейса: IDOR, persist, reversal); тестовая БД подхватила новую колонку автоматически через `ensureMigrated()`.
- `seedItem` расширен опциональным `purchasedAt` (по умолчанию `null` — существующие тесты не сломаны), что позволяет засеивать уже купленную покупку для планов 04-02..04-04.

## Task Commits

1. **Задача 2: колонка purchasedAt + миграция 0002 + seedItem** — `b3b32a8` (feat)
2. **Задача 3 (RED): падающий IDOR/persist/reversal-тест** — `d477b35` (test)
3. **Задача 3 (GREEN): реализация setItemPurchasedForUser** — `af4c782` (feat)

_Задача 1 — гейт необратимости (checkpoint:decision), решение зафиксировано пользователем (option-a); отдельного коммита не требует._

## Files Created/Modified

- `src/server/db/schema.ts` — добавлена nullable-колонка `purchasedAt` (после `createdAt`)
- `drizzle/0002_tranquil_slapstick.sql` — аддитивная миграция `ADD COLUMN purchased_at timestamp`
- `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json` — снапшот и журнал drizzle-kit
- `src/server/repos/items.ts` — новая функция `setItemPurchasedForUser`
- `src/server/repos/items.iso.test.ts` — новый `describe` с 3 кейсами изоляции/обратимости
- `tests/helpers/db.ts` — `seedItem` принимает опциональный `purchasedAt`

## Decisions Made

- **Задача 1 (гейт необратимости, D-07, one-way):** выбран **option-a** — одна nullable `purchased_at timestamp` (без default). Одна колонка кодирует и статус (`null?`), и ключ сортировки архива (`purchasedAt` убыв.); нет риска рассинхрона флага и времени; аддитивная миграция без переписи. Отклонён option-b (`isPurchased boolean` + отдельный `purchasedAt`) — две колонки, риск рассинхрона (RESEARCH §Alternatives — не рекомендуется).
- `setItemPurchasedForUser` не нормализует `undefined → null` (CR-01 неприменим): единственное поле задаётся явным выражением `purchased ? new Date() : null`.

## Deviations from Plan

None — plan executed exactly as written.

_Примечание: сгенерированное drizzle-kit имя миграции — `0002_tranquil_slapstick.sql` (детерминированный случайный суффикс), а не литеральное `0002_purchased_at.sql` из `files_modified` плана. Критерий приёмки задан по маске `drizzle/0002_*.sql`, поэтому имя соответствует ожиданиям._

## Issues Encountered

None.

## User Setup Required

None — использованы уже настроенные локальные БД `shopping_list` (dev) и `shopping_list_test` (test) из `.env.local`.

## Next Phase Readiness

- Персистентный, изолированный статус «куплено» готов: Wave 2 (04-03) может строить Server Action `setItemPurchased` поверх `setItemPurchasedForUser`.
- Ключ сортировки архива (`purchasedAt` убыв.) доступен для компараторов 04-02 и секции «Куплено» в 04-04.
- Блокеров нет.

## Self-Check: PASSED

Все заявленные файлы существуют на диске, все три коммита (`b3b32a8`, `d477b35`, `af4c782`) присутствуют в истории git.

---
*Phase: 04-list-sort-filter-archive*
*Completed: 2026-08-09*
