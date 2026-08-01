---
phase: 02-add-item-scoring
plan: 04
subsystem: ui
tags: [react-hook-form, zod, radix, shadcn, next, forms]

# Dependency graph
requires:
  - phase: 02-03
    provides: "тонкий AddItemForm (обязательные поля), Server Action createItem, Radix jsdom-шимы в vitest.setup, схема itemInputSchema"
provides:
  - "Полная форма AddItemForm со всеми необязательными полями (link/description/price/deadline/doubts)"
  - "Условное поле monthlyPayment по чекбоксу isCredit с очисткой значения при снятии (ITEM-04, Pitfall 6)"
  - "doubts Select по умолчанию «Уверен(а)» (ITEM-05, D-01)"
  - "Постоянная точка входа «Добавить» (Plus) в AppHeader на /list/new (D-08)"
  - "RTL-покрытие формы (AddItemForm.test.tsx)"
affects: [02-05, phase-03-edit-item]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Условная видимость поля через form.watch + очистка form.setValue(undefined) при снятии контрольного чекбокса"
    - "Radix Select/Checkbox в RTL: userEvent с pointerEventsCheck:0, выбор пункта по getByLabelText(триггер)+findByRole('option')"

key-files:
  created:
    - src/components/items/AddItemForm.test.tsx
  modified:
    - src/components/items/AddItemForm.tsx
    - src/components/app/AppHeader.tsx

key-decisions:
  - "monthlyPayment остаётся всегда optional в схеме — условна только видимость в UI (Pitfall 6), не валидация"
  - "Очистка monthlyPayment на onCheckedChange(false) через form.setValue(undefined) — скрытое поле не отправляет старое число"
  - "defaultValues задают doubts='sure' и isCredit=false явно (не полагаемся на schema .default() для первого рендера)"
  - "AppHeader остаётся серверным компонентом: кнопка — навигационная ссылка (Link + Button asChild), клиентское состояние не нужно"

patterns-established:
  - "Ассерт значения Radix Select по умолчанию через getByLabelText(триггер).toHaveTextContent (обход дубля в скрытом native option Radix)"
  - "Условный рендер поля формы по form.watch с очисткой значения при скрытии"

requirements-completed: [ITEM-03, ITEM-04, ITEM-05]

coverage:
  - id: D1
    description: "Форма показывает все необязательные поля сразу (link/description/price/deadline/doubts)"
    requirement: "ITEM-03"
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#рендерит лейблы всех полей формы"
        status: pass
    human_judgment: false
  - id: D2
    description: "Чекбокс isCredit управляет видимостью monthlyPayment (появляется/скрывается), поле остаётся optional"
    requirement: "ITEM-04"
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#поле «Ежемесячный платёж» появляется только при isCredit и скрывается при снятии"
        status: pass
    human_judgment: false
  - id: D3
    description: "Значение monthlyPayment очищается при снятии isCredit (скрытое поле не сохраняет старое число)"
    requirement: "ITEM-04"
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#очищает monthlyPayment при снятии isCredit"
        status: pass
    human_judgment: false
  - id: D4
    description: "doubts Select по умолчанию «Уверен(а)» (0 очков) без действий пользователя"
    requirement: "ITEM-05"
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#doubts по умолчанию «Уверен(а)»"
        status: pass
    human_judgment: false
  - id: D5
    description: "Успешный submit вызывает createItem один раз, блокирует кнопку в pending и делает push на /list; пустой title блокирует submit"
    verification:
      - kind: unit
        ref: "src/components/items/AddItemForm.test.tsx#успешный submit вызывает createItem один раз, блокирует кнопку и делает push на /list"
        status: pass
    human_judgment: false
  - id: D6
    description: "Кнопка «Добавить» (Plus) в AppHeader ведёт на /list/new (D-08); длинный email по-прежнему обрезается ellipsis"
    verification:
      - kind: unit
        ref: "grep /list/new + Plus + truncate в src/components/app/AppHeader.tsx; npx vitest run без регрессий (110 passed)"
        status: pass
      - kind: manual_procedural
        ref: "визуальная проверка отсутствия layout-скачка при появлении monthlyPayment и обрезки длинного email на мобильном"
        status: unknown
    human_judgment: true
    rationale: "Отсутствие layout-скачка и корректная ellipsis-обрезка на узком вьюпорте — визуальные свойства, не проверяемые unit-тестом"

# Metrics
duration: 7min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 04: Полная форма добавления + точка входа «Добавить» Summary

**Расширение доказанного tracer-среза до полной формы покупки: все необязательные поля + условный monthlyPayment по isCredit (с очисткой при снятии) + doubts по умолчанию «Уверен(а)», плюс постоянная кнопка «Добавить» (Plus) в шапке на /list/new.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-08-01T11:17Z
- **Completed:** 2026-08-01T11:21Z
- **Tasks:** 2
- **Files modified:** 3 (1 создан, 2 изменены)

## Accomplishments
- `AddItemForm` достроен до полного набора полей ITEM-03/04/05: `link` (Input url), `description` (Textarea), `price`/`deadline` (Input), `doubts` (Select, default «Уверен(а)»), `isCredit` (Checkbox).
- Условное поле `monthlyPayment` появляется/скрывается по `isCredit` через `form.watch`; при снятии значение очищается `form.setValue("monthlyPayment", undefined)` — скрытое поле не отправляет старое число (Pitfall 6). Схема оставляет поле всегда optional.
- Тонкий обязательный путь плана 03 (Server Action `createItem`, `router.refresh()` → `router.push("/list")`) сохранён без изменений.
- Форма покрыта RTL-тестами (6 кейсов): рендер лейблов, default doubts, условная видимость и очистка monthlyPayment, блокировка submit при пустом title, успешный submit с pending.
- В `AppHeader` добавлена постоянная кнопка-ссылка «Добавить» (иконка `Plus`) на `/list/new` (D-08); `shrink-0` сохраняет ellipsis-обрезку длинного email.

## Task Commits

Каждая задача закоммичена атомарно (TDD RED → GREEN):

1. **Task 1 (RED): failing RTL-тесты полной формы** — `ff1ecf2` (test)
2. **Task 1 (GREEN): полная форма + условный monthlyPayment** — `ed52201` (feat)
3. **Task 2: кнопка «Добавить» в AppHeader** — `09940b2` (feat)

**Plan metadata:** см. финальный docs-коммит.

## Files Created/Modified
- `src/components/items/AddItemForm.test.tsx` (создан) — RTL-покрытие формы: лейблы, default doubts, условный monthlyPayment + очистка, блокировка/успех submit; моки next/navigation + createItem.
- `src/components/items/AddItemForm.tsx` (изменён) — добавлены link/description/price/deadline/doubts/isCredit, условный monthlyPayment по `watch("isCredit")` с очисткой через `setValue`, label-мапа `DOUBTS_OPTIONS`.
- `src/components/app/AppHeader.tsx` (изменён) — кнопка «Добавить» (Plus) → /list/new; шапка остаётся серверным компонентом.

## Decisions Made
- **monthlyPayment всегда optional в схеме** — условна лишь видимость в UI (Pitfall 6). Валидация поля не зависит от isCredit.
- **Очистка при снятии isCredit** — `onCheckedChange(false)` вызывает `form.setValue("monthlyPayment", undefined)`, чтобы submit не отправил ранее введённое число.
- **Явные defaultValues** `{ doubts: "sure", isCredit: false }` — Select сразу показывает «Уверен(а)», чекбокс снят на первом рендере (не полагаемся на schema `.default()`).
- **AppHeader — серверный компонент** — кнопка сделана навигационной ссылкой (`Link` + `Button asChild`), интерактивное состояние `"use client"` не требуется.

## Deviations from Plan

None - plan executed exactly as written.

Единственная корректировка была в тесте (не в продукте): ассерт значения по умолчанию Radix Select изменён с `getByText("Уверен(а)")` на `getByLabelText("Сомнения").toHaveTextContent("Уверен(а)")` — Radix рендерит скрытый native `<option>` с тем же текстом, из-за чего `getByText` находил два узла. Это уточнение тестового запроса, не отклонение в реализации.

## Issues Encountered
- Radix Select добавляет скрытый native `<select>` с `<option>` для интеграции с формой → текст выбранного значения дублируется в DOM. Решено адресным запросом к триггеру через `getByLabelText(...).toHaveTextContent(...)`.
- Взаимодействие с Radix Select/Checkbox в jsdom требует `userEvent.setup({ pointerEventsCheck: 0 })` (Radix навешивает pointer-events на портал) — шимы `hasPointerCapture`/`scrollIntoView`/`ResizeObserver` уже добавлены в плане 03.

## User Setup Required
None — внешних сервисов не добавлено.

## Next Phase Readiness
- Полная форма готова; план 05 (`ScoreBreakdown`, LIST-07) строится поверх неё — `Collapsible` уже установлен.
- Финальные прогоны: `npx vitest run` → 110 passed (было 104 + 6 новых); `npx tsc --noEmit` → 0 ошибок.
- Ручная визуальная сверка (backstop): отсутствие layout-скачка при появлении monthlyPayment и ellipsis-обрезка длинного email — для UAT/verify-work.

## Self-Check: PASSED

Все заявленные файлы и коммиты (ff1ecf2, ed52201, 09940b2) присутствуют.

---
*Phase: 02-add-item-scoring*
*Completed: 2026-08-01*
