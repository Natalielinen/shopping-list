---
phase: 02-add-item-scoring
plan: 05
subsystem: ui
tags: [react, nextjs, collapsible, shadcn, rtl, vitest, scoring]

# Dependency graph
requires:
  - phase: 02-add-item-scoring (план 01)
    provides: computeBreakdown — чистая функция знаковых вкладов + Contribution
  - phase: 02-add-item-scoring (план 03)
    provides: ItemCard + list/page.tsx (RSC-список, единый now, computeTotal)
provides:
  - ScoreBreakdown — client-leaf Collapsible с построчной знаковой разбивкой очков + «Итого» (LIST-07)
  - ItemCard форвардит breakdown-проп в ScoreBreakdown под PriorityBadge
  - list/page.tsx вычисляет computeBreakdown тем же now, что и computeTotal (общая дата на строку)
affects: [фаза фильтров/сортировки, фаза редактирования покупок, UI-ревью мобильной вёрстки]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-now: разбивка и total считаются одной датой в RSC-родителе, прокидываются как пропсы; лист не создаёт new Date"
    - "Client-leaf Collapsible: раскрытие интерактивно в 'use client'-листе при серверном родителе (ItemCard RSC)"
    - "Знак ± — первичный текстовый канал направления вклада, цвет вторичен (a11y)"

key-files:
  created:
    - src/components/items/ScoreBreakdown.tsx
    - src/components/items/ScoreBreakdown.test.tsx
  modified:
    - src/components/items/ItemCard.tsx
    - src/app/(app)/list/page.tsx

key-decisions:
  - "breakdown вычисляется в list/page.tsx тем же now, что и computeTotal; ItemCard/ScoreBreakdown НЕ создают new Date → сумма разбивки провабельно равна total (согласованность LIST-06/LIST-07)"
  - "Срок рендерится всегда: знаковые очки при дедлайне, иначе «—»; Сомнения показывает «нет» при sure (0); Кредит — только при isCredit (вклад присутствует в breakdown)"
  - "Знак ± — основной канал направления (текст «+N»/«-N»), цвет (emerald/red/muted) — вторичный"

patterns-established:
  - "Shared-now через пропсы: RSC-родитель — единственный источник даты; клиентские листья презентационны"
  - "Раскрытие по тапу через shadcn Collapsible c контролируемым open-состоянием; тач-зона триггера h-11 (44px)"

requirements-completed: [LIST-07]

coverage:
  - id: D1
    description: "Разбивка очков свёрнута по умолчанию и раскрывается по тапу на аффордансе (Collapsible), тач-зона ≥44px (D-11)"
    requirement: "LIST-07"
    verification:
      - kind: unit
        ref: "src/components/items/ScoreBreakdown.test.tsx#свёрнут по умолчанию / раскрывается по тапу"
        status: pass
    human_judgment: false
  - id: D2
    description: "Раскрытая панель показывает по одной знаковой строке на присутствующий вклад + «Итого: {total}»; Срок «—» без дедлайна, Кредит только при isCredit, Сомнения «нет» при sure"
    requirement: "LIST-07"
    verification:
      - kind: unit
        ref: "src/components/items/ScoreBreakdown.test.tsx#строки вкладов / без дедлайна и кредита"
        status: pass
    human_judgment: false
  - id: D3
    description: "Сумма знаковых строк разбивки равна total в badge (согласованность LIST-06/LIST-07); breakdown и total используют один now"
    requirement: "LIST-07"
    verification:
      - kind: unit
        ref: "src/components/items/ScoreBreakdown.test.tsx#сумма знаковых строк равна total"
        status: pass
    human_judgment: false
  - id: D4
    description: "Полная разбивка (до 7 строк + Итого) раскрывается без клиппинга на узком мобильном вьюпорте (375px)"
    verification: []
    human_judgment: true
    rationale: "UI-backstop (E3 overflow) — визуальная проверка на реальном мобильном вьюпорте; автоматической проверки клиппинга нет"

# Metrics
duration: 12min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 05: ScoreBreakdown — раскрываемая по тапу разбивка очков Summary

**Client-leaf `ScoreBreakdown` на shadcn `Collapsible`: свёрнутая по умолчанию построчная знаковая разбивка вкладов (Категория/Срочность/Необходимость/Выгода/Срок/Сомнения/Кредит) + «Итого», согласованная с total badge через единый `now` в RSC-родителе.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 4 (2 создано, 2 изменено)

## Accomplishments

- `ScoreBreakdown` (LIST-07) — `"use client"`-лист на `Collapsible`, свёрнут по умолчанию, раскрывается по тапу; аффорданс «Показать разбивку»/«Скрыть разбивку», тач-зона триггера h-11 (44px).
- По одной знаковой строке на присутствующий вклад + «Итого: {total}»; условные строки: Срок «—» без дедлайна, Сомнения «нет» при sure, Кредит только при isCredit.
- Знак ± — первичный текстовый канал направления; цвет (emerald/red/muted) — вторичный (a11y-избыточность).
- `list/page.tsx` вычисляет `computeBreakdown(item, now)` тем же единственным `now`, что и `computeTotal`; `ItemCard` форвардит breakdown-проп в `ScoreBreakdown` — сумма разбивки провабельно равна total, без второго `new Date()` в листьях.

## Task Commits

1. **Task 1 (RED): failing RTL test for ScoreBreakdown** - `7aec9db` (test)
2. **Task 1 (GREEN): tap-to-expand ScoreBreakdown + wiring** - `9043d6e` (feat)

## Files Created/Modified

- `src/components/items/ScoreBreakdown.tsx` - client-leaf Collapsible: построчная разбивка + Итого; formatSigned/signClass; условные строки
- `src/components/items/ScoreBreakdown.test.tsx` - RTL: свёрнуто по умолчанию, раскрытие по тапу, строки вкладов, «Срок: —»/«Сомнения: нет»/отсутствие «Кредит», сумма == total
- `src/components/items/ItemCard.tsx` - принимает breakdown-проп, форвардит в ScoreBreakdown под PriorityBadge (layout стал вертикальным стеком)
- `src/app/(app)/list/page.tsx` - добавлен computeBreakdown(item, now) тем же now, что computeTotal; breakdown прокинут в ItemCard

## Decisions Made

- Shared-now через пропсы: RSC-родитель (`list/page.tsx`) — единственный источник даты; `ItemCard`/`ScoreBreakdown` не создают `new Date` (гарантия согласованности суммы разбивки с total).
- Срок рендерится всегда (строка присутствует и без дедлайна, показывая «—»), чтобы структура карточки была стабильной; Сомнения «нет» при 0; Кредит — только при наличии вклада в breakdown.
- Тесты передают массив `Contribution` напрямую как проп — компонент не зависит от даты/движка, тесты детерминированы.

## Deviations from Plan

None - plan executed exactly as written.

Замечание по acceptance-критерию «positive grep computeBreakdown в ScoreBreakdown.tsx»: по доминирующему замыслу плана (must_haves + action) сам вызов `computeBreakdown` живёт в RSC-родителе `list/page.tsx`, а `ScoreBreakdown` получает результат как проп и НЕ создаёт вторую дату. В `ScoreBreakdown.tsx` `computeBreakdown` присутствует в doc-комментарии (описывает происхождение пропа) — grep положительный, дублирования вычисления/`new Date` нет. Это согласовано с ключевым инвариантом «no second new Date» (строка 112 плана).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Карточка покупки полностью закрывает LIST-06 (badge) + LIST-07 (разбивка) — визуальный объяснимый приоритет готов.
- Открытый backstop (D4): визуальная сверка раскрытия полной разбивки (7 строк + Итого) без клиппинга на 375px — для UI-ревью/UAT.

## Self-Check: PASSED

- FOUND: src/components/items/ScoreBreakdown.tsx
- FOUND: src/components/items/ScoreBreakdown.test.tsx
- FOUND: .planning/phases/02-add-item-scoring/02-05-SUMMARY.md
- FOUND commit: 7aec9db (RED test)
- FOUND commit: 9043d6e (GREEN feat)

---
*Phase: 02-add-item-scoring*
*Completed: 2026-08-01*
