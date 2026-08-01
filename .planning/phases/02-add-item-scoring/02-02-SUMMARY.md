---
phase: 02-add-item-scoring
plan: 02
subsystem: database
tags: [zod, drizzle, postgres, migration, isolation, tdd, vitest, validation]

# Dependency graph
requires:
  - phase: 02-01
    provides: scales.ts (*_VALUES массивы enum) — единый источник значений для z.enum
  - phase: 01-foundation-auth
    provides: таблица items (id/userId/title/createdAt) + items_user_id_idx, findItemsForUser, seedItem/resetDb, drizzle.config + loadEnvLocal
provides:
  - Единый Zod-контракт покупки itemInputSchema + тип ItemInput (клиент + сервер)
  - Хелперы optionalNumber/optionalUrl/optionalDate (пустая строка → undefined, не 0)
  - Расширенная таблица items (category/urgency/need/benefit/doubts/isCredit/link/description/deadline/price/monthlyPayment) + SQL-миграция 0001
  - Тип ItemInsertData (поля покупки без id/userId/createdAt)
  - Write-seam createItemForUser(userId, data) со scoping по userId
  - Интеграционный тест read+write изоляции (items.iso.test.ts)
affects: [02-03-server-action-form, 02-04-list-sorting, 02-05-score-breakdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Единая Zod-схема клиент+сервер через z.infer (зеркалит auth.ts)"
    - "z.preprocess: пустая строка необязательного поля → undefined до coerce (Pitfall 5)"
    - "monthlyPayment всегда optional — условна лишь видимость в UI, не валидация (Pitfall 6)"
    - "Аддитивная миграция ADD COLUMN (nullable/defaulted) на пустой таблице (D-06)"
    - "userId подмешивается в .values() ПОСЛЕ data — mass-assignment невозможен (Security V4)"
    - "text().$type<EnumType>() — колонка привязана к union-типу шкалы"

key-files:
  created:
    - src/lib/validation/item.ts
    - src/lib/validation/item.test.ts
    - drizzle/0001_cuddly_rhino.sql
  modified:
    - src/server/db/schema.ts
    - src/server/repos/items.ts
    - src/server/repos/items.iso.test.ts
    - tests/helpers/db.ts

key-decisions:
  - "Деньги (price/monthlyPayment) хранятся как integer-копейки (Pitfall 10 — numeric→string, без float-ошибок); display-only, на очки не влияют"
  - "deadline — date({ mode: 'date' }) без времени/TZ, чтобы вклад срока не сдвигался на день (Pitfall 4)"
  - "total/deadlinePoints НЕ добавлены в таблицу (SCORE-05 — считаются на чтении)"
  - "ItemInsertData выведен из NewItem через Omit id/userId/createdAt"
  - "Enum-колонки NOT NULL без default (кроме doubts=sure) — безопасно, т.к. таблица пуста (D-06)"

patterns-established:
  - "Pattern 1: единый Zod-контракт покупки, повторно валидируется на сервере в Server Action (never-trust-client)"
  - "Pattern 2: write-seam createItemForUser — userId первым параметром из сессии, изоляцию нельзя забыть"
  - "Pattern 3: TDD RED (test-коммит) → GREEN (feat-коммит) для behavior-adding задач"

requirements-completed: [ITEM-01, ITEM-02, ITEM-03, ITEM-04, ITEM-05]

coverage:
  - id: D1
    description: "itemInputSchema валидирует обязательные/необязательные поля покупки с текстами из UI-SPEC (пустая строка → undefined не 0; отрицательное отклоняется; doubts default sure; deadline coerce в Date)"
    requirement: "ITEM-01"
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts (20 кейсов)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Enum-whitelist category/urgency/need/benefit; невыбранное значение → «Выберите значение»"
    requirement: "ITEM-02"
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts#обязательные поля"
        status: pass
    human_judgment: false
  - id: D3
    description: "link/price/deadline необязательны; empty→undefined, url/число валидируются, отрицательное отклоняется"
    requirement: "ITEM-03"
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts#link,price,deadline"
        status: pass
    human_judgment: false
  - id: D4
    description: "isCredit + monthlyPayment всегда optional (условна только видимость в UI)"
    requirement: "ITEM-04"
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts#monthlyPayment"
        status: pass
    human_judgment: false
  - id: D5
    description: "doubts по умолчанию sure «нет сомнений» при отсутствии в payload"
    requirement: "ITEM-05"
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts#doubts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Таблица items физически расширена в живой БД (миграция 0001 применена к dev+test), без хранения total/deadlinePoints (SCORE-05)"
    requirement: "ITEM-01"
    verification:
      - kind: other
        ref: "npx drizzle-kit generate && npx drizzle-kit migrate (exit 0); drizzle/0001_cuddly_rhino.sql ALTER TABLE items"
        status: pass
    human_judgment: false
  - id: D7
    description: "createItemForUser пишет со scoping по userId; read+write изоляция подтверждена на реальной тестовой БД (A пишет — B не видит; mass-assignment userId из payload не проходит)"
    requirement: "ITEM-01"
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts (3 кейса — реальная Postgres)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 2: Модель данных покупки (Zod-схема + миграция items + write-seam) Summary

**Единый Zod-контракт `itemInputSchema` (клиент+сервер), таблица `items` физически расширена полями покупки через применённую миграцию, и write-seam `createItemForUser` со scoping по `userId`, подтверждённый интеграционным тестом read+write изоляции.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-01T10:39:00Z
- **Completed:** 2026-08-01T10:46:00Z
- **Tasks:** 2 (обе TDD — RED→GREEN)
- **Files modified:** 7 (3 создано, 4 изменено)

## Accomplishments
- `itemInputSchema` + тип `ItemInput` — единый контракт валидации покупки (клиент RHF + серверный Server Action), значения enum импортированы из `scales.ts` (не продублированы); 20 юнит-тестов зелёные.
- Хелперы `optionalNumber`/`optionalUrl`/`optionalDate` через `z.preprocess`: пустая строка необязательного поля → `undefined`, а не `0`/ошибка (Pitfall 5); `monthlyPayment` всегда `.optional()` (Pitfall 6, не discriminated union).
- Таблица `items` расширена 11 аддитивными колонками; SQL-миграция `0001_cuddly_rhino.sql` сгенерирована и **применена к живой dev-БД и тестовой БД** (schema-gate закрыт). Без колонок `total`/`deadlinePoints` (SCORE-05).
- `createItemForUser(userId, data)` — write-seam, `userId` подмешивается в `.values()` из серверной сессии (mass-assignment невозможен, Security V4). Интеграционный тест изоляции (read + write + mass-assignment guard) зелёный на реальной Postgres.

## Task Commits

1. **Task 1 (RED): failing tests для itemInputSchema** - `f645f1b` (test)
2. **Task 1 (GREEN): itemInputSchema реализован** - `08b98c9` (feat)
3. **Task 2 (RED): failing write-seam isolation tests** - `a957e28` (test)
4. **Task 2 (GREEN): schema + миграция + createItemForUser + seedItem** - `6267447` (feat)

_Обе задачи следовали циклу TDD RED→GREEN (MVP+TDD gate)._

## Files Created/Modified
- `src/lib/validation/item.ts` (создан) — `itemInputSchema`, `ItemInput`, хелперы optional*.
- `src/lib/validation/item.test.ts` (создан) — 20 юнит-кейсов валидации (зеркало auth.test.ts).
- `drizzle/0001_cuddly_rhino.sql` (создан) — ALTER TABLE items ADD COLUMN × 11.
- `src/server/db/schema.ts` (изменён) — новые колонки items + импорт date/integer + тип ItemInsertData; сохранён индекс items_user_id_idx.
- `src/server/repos/items.ts` (изменён) — добавлен `createItemForUser`.
- `src/server/repos/items.iso.test.ts` (изменён) — write-изоляция + mass-assignment guard; хуки уровня файла.
- `tests/helpers/db.ts` (изменён) — `seedItem` расширен новыми NOT NULL колонками с дефолтами.

## Decisions Made
- **Деньги как integer-копейки** (Pitfall 10): избегает float-ошибок и string-возврата `numeric`; display-only.
- **deadline как `date({ mode: "date" })`**: без TZ, чтобы вклад срока не сдвигался на день (Pitfall 4).
- **Enum-колонки NOT NULL без default** (кроме `doubts`): безопасно на пустой таблице (D-06); `seedItem` и `createItemForUser` всегда поставляют значения.

## Deviations from Plan

None - plan executed exactly as written. Миграция сгенерирована и применена штатным workflow (`generate` + `migrate`), drizzle-kit не запрашивал переименований (чисто аддитивные ADD COLUMN).

## Issues Encountered
1. **Двойной `closeTestDb` рвал соединение** — при первом написании write-теста каждый `describe` имел свой `afterAll(closeTestDb)`, а тестовая БД использует один module-level postgres-клиент; первый `afterAll` закрывал его, ломая второй блок (`CONNECTION_ENDED`). Исправлено переносом `beforeEach(resetDb)`/`afterAll(closeTestDb)` на уровень файла (единственное закрытие). Часть GREEN-коммита `6267447`.
2. **Миграция 0001 падала на тестовой БД (23502 not-null)** — от прошлых RED-прогонов в `shopping_list_test.items` осталась 1 строка со старой схемой, из-за чего `ADD COLUMN category text NOT NULL` не применялся к непустой таблице. Устранено разовым `TRUNCATE items` в тестовой БД (D-06: таблица должна быть пустой). После очистки миграция и все тесты зелёные.

## User Setup Required
None - внешних сервисов не добавлено. Использованы существующие `DATABASE_URL`/`DATABASE_URL_TEST` из `.env.local`.

## Next Phase Readiness
- Контракт `itemInputSchema` готов к переиспользованию в Server Action и форме (план 03).
- `createItemForUser` — точка записи для Server Action `createItem`.
- Финальный прогон: `npx vitest run src/lib/validation src/server/repos` → 28 passed; `npx tsc --noEmit` → 0.

## Self-Check: PASSED

Все заявленные файлы существуют на диске; все 4 коммита присутствуют в истории.

---
*Phase: 02-add-item-scoring*
*Completed: 2026-08-01*
