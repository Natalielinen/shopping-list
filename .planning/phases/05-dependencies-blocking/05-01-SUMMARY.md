---
phase: 05-dependencies-blocking
plan: 01
subsystem: dependencies
tags: [typescript, vitest, tdd, pure-functions, graph-traversal]

# Dependency graph
requires:
  - phase: 04-purchased-status
    provides: "purchasedAt (nullable timestamp, null=активна) — семантика, которую читает isBlocked"
  - phase: 02-scoring-engine
    provides: "образец чистого модуля (src/lib/list/sort.ts) и табличного теста (scoring.test.ts)"
provides:
  - "isBlocked(dependsOn, dependencyPurchasedAt) — чистое производное прямой блокировки (DEP-01 / D-02)"
  - "wouldCreateCycle(map, sourceId, candidateId) — авторитетная защита от циклов с visited-set (ITEM-06 / D-05)"
affects: [05-02-schema-migration, 05-03-derivation-cycle, 05-04-purchase-guard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Чистое ядро в src/lib/deps/ без внешних импортов — потребляется Server Actions и RSC как never-trust-client backstop"
    - "Обход графа depends_on с Set-visited для конечности при уже испорченной (циклической) БД"

key-files:
  created:
    - src/lib/deps/blocked.ts
    - src/lib/deps/blocked.test.ts
    - src/lib/deps/cycle.ts
    - src/lib/deps/cycle.test.ts
  modified: []

key-decisions:
  - "isBlocked — прямая (не транзитивная) блокировка без обхода графа (D-02); undefined и null нормализуются как «не куплена», любое non-null (Date/число, включая 0) — как «куплена»"
  - "wouldCreateCycle ограничен visited-set: обход завершается даже при pre-existing corrupt cycle (DoS-безопасно, T-05-03 mitigate)"

patterns-established:
  - "Модуль src/lib/deps/*: блок-комментарий об инвариантах на русском, экспорт чистой функции, ноль import-ов (образец src/lib/list/sort.ts)"

requirements-completed: [DEP-01, ITEM-06]

coverage:
  - id: D1
    description: "isBlocked — производный флаг прямой блокировки: dependsOn null→false, зависимость не куплена→true, куплена→false"
    requirement: "DEP-01"
    verification:
      - kind: unit
        ref: "src/lib/deps/blocked.test.ts#isBlocked (DEP-01 / D-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "wouldCreateCycle — защита от self и транзитивного цикла (A↔B), ограничена visited-set при испорченной БД"
    requirement: "ITEM-06"
    verification:
      - kind: unit
        ref: "src/lib/deps/cycle.test.ts#wouldCreateCycle (D-05)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-09-19
status: complete
---

# Phase 5 Plan 01: Чистое ядро зависимостей и блокировки Summary

**Два чистых детерминированных модуля в `src/lib/deps/` (TDD RED→GREEN): `isBlocked` — производный флаг прямой блокировки, и `wouldCreateCycle` — защита от циклов с visited-set; 13 юнит-тестов зелёные за ~1.3 c.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-09-19T04:54:40Z
- **Completed:** 2026-09-19T04:58:05Z
- **Tasks:** 2 (каждая по циклу TDD RED→GREEN)
- **Files modified:** 4 (все созданы)

## Accomplishments
- `isBlocked(dependsOn, dependencyPurchasedAt)` — чистое производное прямой блокировки (DEP-01 / D-02): заблокирована ⇔ есть зависимость И она ещё не куплена. Без рекурсии, нормализует undefined→null и трактует любое non-null (Date/число, включая 0) как «куплена».
- `wouldCreateCycle(map, sourceId, candidateId)` — авторитетная серверная защита от циклов (ITEM-06 / D-05): ранний true при self, ранний false в create-режиме, обход цепочки `depends_on` с visited-set (конечен при уже испорченной циклической БД — T-05-03 mitigate).
- Оба модуля чистые: ноль `import`, без побочных эффектов, вход не мутируется — готовы к потреблению планами 05-03 (derivation + cycle) и 05-04 (guard).

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Задача 1 RED: тест isBlocked** — `8d385da` (test)
2. **Задача 1 GREEN: реализация isBlocked** — `136041c` (feat)
3. **Задача 2 RED: тест wouldCreateCycle** — `960d73a` (test)
4. **Задача 2 GREEN: реализация wouldCreateCycle** — `9a71dd0` (feat)

## Files Created/Modified
- `src/lib/deps/blocked.ts` — чистая `isBlocked` + блок-комментарий об инвариантах
- `src/lib/deps/blocked.test.ts` — табличный юнит-тест (7 кейсов)
- `src/lib/deps/cycle.ts` — чистая `wouldCreateCycle` с visited-set + инварианты
- `src/lib/deps/cycle.test.ts` — юнит-тест (6 кейсов, включая corrupt-cycle bound)

## Decisions Made
- None - выполнено ровно по плану (сигнатуры и алгоритмы из RESEARCH §Pattern 2/3).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. RED-фазы падали ожидаемо (несуществующий модуль), GREEN-фазы прошли с первого прогона.

## User Setup Required
None - no external service configuration required.

## Verification Evidence
- `npx vitest run src/lib/deps` → 2 файла, 13 тестов зелёные (~1.3 c).
- Проверка чистоты: `grep -v '^//' src/lib/deps/blocked.ts src/lib/deps/cycle.ts | grep -c '^import'` → 0.
- `npx tsc --noEmit` — ноль ошибок в новых модулях.

## Next Phase Readiness
- Чистое ядро готово. План 05-02 (миграция self-ref FK `dependsOn`) и планы 05-03/05-04 могут вызывать `isBlocked`/`wouldCreateCycle` как авторитетную серверную логику.
- Owner-проверка кандидатов (IDOR, T-05-01) закрывается в 05-03 в Server Action — здесь только чистое ядро.

## Self-Check: PASSED

Все 4 файла существуют, все 4 коммита (8d385da, 136041c, 960d73a, 9a71dd0) найдены в истории.

---
*Phase: 05-dependencies-blocking*
*Completed: 2026-09-19*
