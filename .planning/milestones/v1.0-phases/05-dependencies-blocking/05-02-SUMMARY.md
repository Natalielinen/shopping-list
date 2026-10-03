---
phase: 05-dependencies-blocking
plan: 02
subsystem: database
tags: [drizzle, postgres, migration, self-fk, zod, on-delete-set-null]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: таблица items + шов изоляции userId (findItemsForUser / repos/items.ts) + drizzle-kit generate/migrate
  - phase: 05-dependencies-blocking (план 05-01)
    provides: чистое ядро isBlocked / wouldCreateCycle (D-02 / D-05)
provides:
  - Колонка items.depends_on (nullable self-FK на items.id, ON DELETE SET NULL, D-01/D-06)
  - Миграция 0003_groovy_grandmaster (ADD COLUMN + ADD CONSTRAINT), применена к dev БД
  - Поле dependsOn в itemInputSchema (sentinel "none"/""→null) и нормализация в updateItemForUser
  - Опциональный dependsOn в seedItem (граф-сиды для интеграционных тестов)
  - Интеграционные тесты FK на реальной PG (set null при удалении зависимости, persist, clear)
affects: [05-03 tracer блокировки зависимостей, ownership/cycle-проверка в Server Action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-referencing FK через AnyPgColumn-аннотацию для разрыва циклической инференции (Pitfall 1)"
    - "ON DELETE SET NULL для авто-разблокировки зависимой строки без каскадного удаления (D-06)"
    - "Аддитивная миграция nullable-колонки: существующие строки → NULL, поведение не меняется"

key-files:
  created:
    - drizzle/0003_groovy_grandmaster.sql
    - drizzle/meta/0003_snapshot.json
  modified:
    - src/server/db/schema.ts
    - src/lib/validation/item.ts
    - src/lib/validation/item.test.ts
    - src/server/repos/items.ts
    - src/server/repos/items.iso.test.ts
    - tests/helpers/db.ts
    - drizzle/meta/_journal.json

key-decisions:
  - "Единичный nullable self-FK depends_on (D-01), join-таблица many-to-many отложена в v2"
  - "onDelete set null (D-06): удаление зависимости обнуляет ссылку → авто-разблокировка, без каскада"
  - "Владение/цикл НЕ проверяются в Zod (схема синхронна, без БД) — переносятся в Server Action плана 05-03"
  - "dependsOn нормализуется undefined/null → NULL в updateItemForUser (CR-01), рядом с link/description/deadline"

patterns-established:
  - "Self-FK: text(col).references((): AnyPgColumn => items.id, { onDelete: 'set null' }) — nullable, аннотация обязательна"
  - "Интеграционный FK-тест на реальной PG: поведение ON DELETE SET NULL живёт в БД, не в типах (schema-gate)"

requirements-completed: [ITEM-06]

coverage:
  - id: D1
    description: "items.depends_on — nullable self-FK на items.id с ON DELETE SET NULL (миграция 0003, применена к dev БД)"
    requirement: ITEM-06
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#удаление покупки-зависимости → depends_on ссылающейся строки становится NULL (FK set null, без каскада)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dependsOn персистится при create с id другой своей покупки и читается обратно"
    requirement: ITEM-06
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#create с dependsOn = id другой своей покупки → персистится и читается обратно"
        status: pass
    human_judgment: false
  - id: D3
    description: "updateItemForUser обнуляет depends_on при dependsOn undefined/null (CR-01 — выбор «Без зависимости»)"
    requirement: ITEM-06
    verification:
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#update с dependsOn undefined → depends_on обнуляется (CR-01)"
        status: pass
      - kind: integration
        ref: "src/server/repos/items.iso.test.ts#update с dependsOn null → depends_on обнуляется"
        status: pass
    human_judgment: false
  - id: D4
    description: "itemInputSchema принимает dependsOn (sentinel none/\"\"→null, строка-id сохраняется, undefined optional)"
    requirement: ITEM-06
    verification:
      - kind: unit
        ref: "src/lib/validation/item.test.ts (sentinel-кейсы dependsOn)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-09-19
status: complete
---

# Phase 5 Plan 02: Модель данных зависимости (self-FK depends_on) Summary

**Self-referencing FK `items.depends_on → items.id ON DELETE SET NULL` (миграция 0003) плюс контракт Zod (`dependsOn`, sentinel→null) и нормализация репозитория — единственный one-way шаг фазы заложен, интеграционные тесты FK зелёные на реальной PG.**

## Performance

- **Duration:** ~15 min (продолжение после decision-чекпоинта)
- **Completed:** 2026-09-19
- **Tasks:** 3 (Задача 1 выполнена ранее; Задача 2 — decision-гейт approved; Задача 3 — эта сессия)
- **Files modified:** 7 (2 созданы: миграция + snapshot)

## Accomplishments

- Сгенерирована и применена миграция `0003_groovy_grandmaster` (`drizzle-kit generate` → `migrate`, НЕ push): `ALTER TABLE items ADD COLUMN depends_on text` + `ADD CONSTRAINT items_depends_on_items_id_fk ... ON DELETE set null`.
- Reversibility-гейт (D-01/D-06) подтверждён человеком (`proceed-single-fk`) до применения необратимой миграции.
- Добавлены интеграционные тесты FK на реальной PG: авто-обнуление `depends_on` при удалении зависимости (без каскада), персист ссылки на create, очистка на update (undefined/null → NULL). 20 iso-тестов зелёные.
- Схема/Zod/репозиторий/seedItem уже принимали `dependsOn` (Задача 1, коммиты `2308f3e`/`c3b2c06`); эта сессия закрыла миграцию и доказала поведение FK.

## Task Commits

1. **Задача 1 (RED): failing dependsOn validation cases** — `2308f3e` (test) _[предыдущая сессия]_
2. **Задача 1 (GREEN): dependsOn self-FK contract (schema/Zod/repo/seed)** — `c3b2c06` (feat) _[предыдущая сессия]_
3. **Задача 2: reversibility decision-гейт** — approved человеком (`proceed-single-fk`), без коммита
4. **Задача 3: генерация+применение миграции 0003** — `db3a6c3` (feat)
5. **Задача 3: интеграционные FK-тесты** — `7e46dd0` (test)

_Note: миграция 0003 применена к dev БД; тестовая БД подхватывает её автоматически через `ensureMigrated()` в `tests/helpers/db.ts`._

## Files Created/Modified

- `drizzle/0003_groovy_grandmaster.sql` — миграция: ADD COLUMN depends_on + FK ON DELETE set null (создан)
- `drizzle/meta/0003_snapshot.json` — snapshot схемы для миграции 0003 (создан)
- `drizzle/meta/_journal.json` — запись idx:3 в журнал миграций (изменён)
- `src/server/repos/items.iso.test.ts` — describe-блок «dependsOn — self-FK и очистка» (4 новых кейса)
- `src/server/db/schema.ts` — колонка dependsOn (Задача 1, предыдущая сессия)
- `src/lib/validation/item.ts` / `item.test.ts` — поле dependsOn + sentinel-кейсы (Задача 1)
- `src/server/repos/items.ts` — нормализация dependsOn ?? null (Задача 1)
- `tests/helpers/db.ts` — опциональный dependsOn в seedItem (Задача 1)

## Decisions Made

- **Единичный self-FK (D-01):** одна зависимость на покупку; join-таблица many-to-many осознанно отложена в v2 (CONTEXT §Deferred).
- **onDelete set null (D-06):** удаление покупки-зависимости обнуляет `depends_on` зависимой строки → авто-разблокировка, без каскадного удаления и висячих ссылок.
- **Проверка владения/цикла НЕ в Zod:** схема синхронна и общая клиент+сервер, без доступа к БД; ownership (`candidate ∈ findItemsForUser(userId)`) и cycle-guard переносятся в Server Action плана 05-03 (T-05-01 — защита на уровне БД недостаточна).

## Deviations from Plan

None — план выполнен ровно как написано. Миграция сгенерирована и применена через `generate`+`migrate` (не push, согласно CLAUDE.md); SQL проверен глазами на `ON DELETE set null` перед применением.

## Issues Encountered

None. `npx tsc --noEmit` без ошибок циклической инференции (AnyPgColumn разрывает цикл), `drizzle-kit migrate` применил миграцию без ошибок, все тесты зелёные.

## User Setup Required

None — новых внешних сервисов и пакетов не добавлено (T-05-SC: фаза не устанавливает пакетов).

## Next Phase Readiness

- Схема мигрирована с self-FK — tracer блокировки зависимостей (план 05-03) может строиться поверх реальной БД, типы `Item` подхватывают `dependsOn`.
- Открытый перенос: ownership-проверка кандидата зависимости и cycle-guard (wouldCreateCycle из плана 05-01) должны быть подключены в Server Action плана 05-03 (T-05-01 — FK не проверяет владельца).

## Self-Check: PASSED

Все заявленные файлы (миграция 0003, snapshot, iso-тесты, SUMMARY) присутствуют; коммиты `db3a6c3` (миграция) и `7e46dd0` (тесты) найдены в git.

---
*Phase: 05-dependencies-blocking*
*Completed: 2026-09-19*
