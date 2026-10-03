---
phase: 02-add-item-scoring
plan: 01
subsystem: scoring
tags: [typescript, date-fns, vitest, tdd, pure-functions, scoring]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: Vitest-тулчейн, стиль чистого модуля auth.ts, alias @/*
provides:
  - Чистый движок подсчёта очков (deadlinePoints, computeTotal, computeBreakdown, priorityLevel)
  - Фиксированные exhaustive Record-шкалы (CATEGORY/URGENCY/NEED/BENEFIT/DOUBTS) + *_VALUES массивы
  - PRIORITY_THRESHOLDS (high=30, medium=10) и типы CategoryType/UrgencyType/NeedType/BenefitType/DoubtsType/ScoredFields
  - date-fns@4 в зависимостях; test/test:watch/test:e2e npm-скрипты
affects: [02-02-item-schema, 02-03-server-action-form, 02-04-list-sorting, 02-05-score-breakdown]

# Tech tracking
tech-stack:
  added: [date-fns@4.4.0]
  patterns:
    - "Чистый вычислительный модуль с внедряемой now:Date (детерминизм, вычисление на чтении)"
    - "Exhaustive Record<Enum,number> шкалы без `?? 0` — пропуск ключа ловит компилятор"
    - "Спец-случай просрочки (days<0 → +100 ДО clamp)"

key-files:
  created:
    - src/lib/scoring/scales.ts
    - src/lib/scoring/scoring.ts
    - src/lib/scoring/scoring.test.ts
  modified:
    - package.json

key-decisions:
  - "URGENCY_POINTS.vital=12 — вершина шкалы срочности (D-03), выше extra=10"
  - "deadlinePoints: любая просрочка возвращает фиксированные +100 ДО clamp (D-04), а не растущее значение формулы"
  - "Английские ключи enum + русские подписи полей в computeBreakdown (label-мапа UI отдельно)"
  - "computeBreakdown: сумма знаковых вкладов === computeTotal; «Кредит»/«Срок» условны"
  - "CATEGORY_POINTS содержит 14 категорий ровно по SUMMARY.md (не 13 из приблизительного комментария RESEARCH)"

patterns-established:
  - "Pattern 1: now:Date — обязательный параметр каждой функции с датой; никогда new Date() внутри движка (SCORE-05)"
  - "Pattern 2: Record<Type,number> из *_VALUES as const — exhaustive типобезопасные шкалы"
  - "Pattern 3: TDD RED (test-коммит) → GREEN (feat-коммит) для behavior-adding задач"

requirements-completed: [SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, LIST-06, LIST-07]

coverage:
  - id: D1
    description: "date-fns@4 установлена + test/test:watch/test:e2e npm-скрипты добавлены (Wave 0 тулчейн)"
    verification:
      - kind: automated
        ref: "node -e package.json check (date-fns + 3 scripts present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deadlinePoints: null→0, сегодня→+28, просрочка→фикс+100 ДО clamp, нижний clamp −100 (D-04, SCORE-02)"
    requirement: SCORE-02
    verification:
      - kind: unit
        ref: "src/lib/scoring/scoring.test.ts#deadlinePoints (D-04, SCORE-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exhaustive шкалы CATEGORY/URGENCY/NEED/BENEFIT/DOUBTS по SUMMARY.md + D-01/D-02/D-03 (vital=12), каждый пункт покрыт"
    requirement: SCORE-06
    verification:
      - kind: unit
        ref: "src/lib/scoring/scoring.test.ts#CATEGORY_POINTS/URGENCY_POINTS/NEED_POINTS/BENEFIT_POINTS/DOUBTS_POINTS"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeTotal = сумма очковых полей + deadlinePoints + doubts − 2·isCredit; детерминирован через now; price/monthlyPayment исключены (SCORE-01/03/04/05)"
    requirement: SCORE-01
    verification:
      - kind: unit
        ref: "src/lib/scoring/scoring.test.ts#computeTotal (SCORE-01, D-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "priorityLevel: total≥30→high, 10≤total<30→medium, <10→low (LIST-06, D-10)"
    requirement: LIST-06
    verification:
      - kind: unit
        ref: "src/lib/scoring/scoring.test.ts#priorityLevel (LIST-06, D-10)"
        status: pass
    human_judgment: false
  - id: D6
    description: "computeBreakdown: сумма знаковых вкладов === computeTotal; «Кредит» только при isCredit; «Срок» только при заданном дедлайне (LIST-07)"
    requirement: LIST-07
    verification:
      - kind: unit
        ref: "src/lib/scoring/scoring.test.ts#computeBreakdown (LIST-07)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 01: Инфраструктура + чистый движок подсчёта Summary

**Чистый детерминированный движок приоритета (deadlinePoints/computeTotal/computeBreakdown/priorityLevel) на exhaustive Record-шкалах с внедряемой now:Date, покрыт 57 юнит-тестами; date-fns@4 и test-скрипты подключены.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-01T07:30:08Z
- **Completed:** 2026-08-01T07:35:26Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified; + package-lock.json)

## Accomplishments
- Установлена `date-fns@4.4.0` (verdict OK, §Package Legitimacy Audit) и добавлены npm-скрипты `test`/`test:watch`/`test:e2e` — тестовый тулчейн Фазы 2 готов.
- Создан чистый модуль подсчёта очков: `deadlinePoints` (спец-случай просрочки +100 ДО clamp через `differenceInCalendarDays`), `computeTotal`, `computeBreakdown`, `priorityLevel` + `PRIORITY_THRESHOLDS`.
- Зафиксированы exhaustive `Record<Enum,number>` шкалы (14 категорий, 6 срочностей с `vital=12`, 3 need, 5 benefit, 3 doubts) + массивы `*_VALUES` — единый источник для последующих планов.
- TDD-цикл соблюдён: RED (`test`-коммит, 0 тестов из-за отсутствия модулей) → GREEN (`feat`-коммит, 57 тестов зелёные); `tsc --noEmit` чист.

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Установить date-fns@4 и test-скрипты** — `569e692` (chore)
2. **Task 2 (RED): Failing unit tests движка** — `68d2e9e` (test)
3. **Task 2 (GREEN): Реализация scales + scoring** — `236c861` (feat)

_TDD-задача имеет два коммита (test → feat); REFACTOR не потребовался._

## Files Created/Modified
- `src/lib/scoring/scales.ts` — exhaustive Record-шкалы очков + `*_VALUES` массивы и типы enum (единый источник — SUMMARY.md + D-01/D-02/D-03).
- `src/lib/scoring/scoring.ts` — чистые функции подсчёта с внедряемой `now:Date`; `ScoredFields`/`Contribution`/`PriorityLevel` типы.
- `src/lib/scoring/scoring.test.ts` — 57 табличных юнит-тестов (SCORE-01..06, LIST-06/07), фиксированный `now`, локальные даты через числовые аргументы.
- `package.json` — `date-fns@4` + три test-скрипта.

## Decisions Made
- **vital=12 (D-03):** «Жизненно важно» — максимум шкалы срочности, тест утверждает `Math.max(...URGENCY) === vital`.
- **Просрочка = фикс +100 (D-04):** `if (days < 0) return 100` ДО `clamp` — иначе давняя просрочка давала бы растущее/обрезанное значение (RESEARCH Pitfall 1).
- **14 категорий:** SUMMARY.md перечисляет 14 пунктов CategoryType; приблизительный комментарий «13 категорий» в RESEARCH проигнорирован в пользу единого источника (SUMMARY.md).
- **Разбивка без строки-итога в сумме:** `computeBreakdown` возвращает массив вкладов, сумма `points` которых === `computeTotal` (итог не дублируется отдельной суммируемой строкой; UI показывает «Итого» через `computeTotal`).
- **Русские подписи полей в Contribution.label** («Категория»/«Срочность»/…/«Срок»/«Кредит») при английских ключах enum — соответствует поведению из плана (условные строки «Кредит»/«Срок»).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Единственное уточнение — число категорий (14, а не «13» из вспомогательного комментария RESEARCH); разрешено в пользу SUMMARY.md как единого источника истины (задокументировано в решениях).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Движок готов к переиспользованию планами 02-02..02-05: Zod-схема покупки (`item.ts`) может импортировать `*_VALUES` для `z.enum`; RSC-список — `computeTotal`/`priorityLevel`/`computeBreakdown`.
- `*_VALUES` массивы предназначены как источник enum-значений для схемы БД и Zod (план 02-02).
- Русские отображаемые тексты пунктов (Select) — отдельная label-мапа в UI-слое (не в этом модуле), как решено в RESEARCH Open Q1.

## Self-Check: PASSED
- Файлы: `src/lib/scoring/scales.ts`, `scoring.ts`, `scoring.test.ts` — FOUND.
- Коммиты: `569e692`, `68d2e9e`, `236c861` — FOUND.
- `npx vitest run src/lib/scoring` — 57 passed; `npx tsc --noEmit` — exit 0.

---
*Phase: 02-add-item-scoring*
*Completed: 2026-08-01*
