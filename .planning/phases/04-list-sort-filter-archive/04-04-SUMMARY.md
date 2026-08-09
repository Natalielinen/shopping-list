---
phase: 04-list-sort-filter-archive
plan: 04
subsystem: list-ui
tags: [nextjs, client-component, useState, shadcn-select, shadcn-checkbox, sort, filter, archive, playwright, vitest, mobile-first]

# Dependency graph
requires:
  - phase: 04-list-sort-filter-archive
    provides: "чистый модуль sort.ts (partitionByPurchased/sortActive/sortPurchased, SortKey, 04-02); минимальный клиентский ListView + PurchaseCheckbox + Server Action setItemPurchased + sonner-тост (tracer 04-03); граница RSC→client на примитивах (04-03)"
  - phase: 03-edit-delete-items
    provides: "ItemCard с рядом действий (Pencil/Delete), ScoreBreakdown actions-слот, каркас e2e"
provides:
  - "ListControls — sticky client-leaf панель управления (Select 3 режимов сортировки D-01 + Checkbox фильтра «показывать купленные» D-06), без собственного состояния"
  - "Расширенный ListView: эфемерный useState sortKey/showPurchased (D-09), sortActive для активных + sortPurchased для архива (§Pitfall 1), секция «Куплено» (условна на showPurchased && ≥1), все три empty-варианта (§Pitfall 2)"
  - "Приглушённое лечение купленной карточки в ItemCard (opacity-70 + line-through — избыточный канал статуса, не только цвет)"
  - "Расширенный сквозной e2e purchase-archive.spec.ts (фильтр открывает «Куплено», undo из архива, переключение Select меняет порядок активных)"
affects: [05-dependencies-blocking, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Контролируемый client-leaf (ListControls) без собственного состояния — держит sortKey/showPurchased родитель (ListView), leaf получает значения + колбэки (D-09, эфемерность гарантирована на одном уровне)"
    - "Партиция ДО сортировки (§Pitfall 1): активный список управляется Select, архив ВСЕГДА sortPurchased (purchasedAt убыв.) независимо от Select"
    - "Избыточный канал статуса «куплено» — зачёркивание (line-through) + приглушение (opacity-70) + отдельная секция + checked-чекбокс, а не только цвет (§Color, доступность)"

key-files:
  created:
    - "src/components/items/ListControls.tsx — sticky-панель Select сортировки (D-01) + Checkbox фильтра (D-06)"
  modified:
    - "src/components/items/ListView.tsx — sortKey/showPurchased (useState, D-09), sortActive/sortPurchased, секция «Куплено», empty-состояния"
    - "src/components/items/ItemCard.tsx — приглушённое лечение при purchased=true (opacity-70 + line-through)"
    - "e2e/app/purchase-archive.spec.ts — расширен: фильтр раскрывает «Куплено», undo из архива, переключение Select"
    - "src/components/items/ListControls.test.tsx — RTL-тест панели (Select D-01 + чекбокс фильтра)"

key-decisions:
  - "ListControls — двухрядный вертикальный стек (Ряд A: полноширинный Select h-11; Ряд B: строка фильтра min-h-11), а НЕ один ряд: длинный русский label «Показывать купленные» рядом с Select сжал бы обе тач-цели ниже 44px на 375px."
  - "Заголовок секции архива — «Куплено · {n}» со счётчиком (text-muted-foreground): второстепенная поверхность, счётчик даёт контекст объёма архива без раскрытия."
  - "Купленная карточка помечена избыточным каналом (opacity-70 + line-through), а не только приглушением цвета — доступность (WCAG: статус не должен передаваться одним цветом)."

patterns-established:
  - "Контролируемый client-leaf без состояния (ListControls) поверх родителя-владельца эфемерного useState (ListView) — образец для будущих панелей управления"
  - "Три empty-варианта списка ветвятся по active.length × showPurchased (§Pitfall 2): пусто-совсем (page.tsx), все-куплены+фильтр-ВЫКЛ (heading+подсказка), все-куплены+фильтр-ВКЛ (короткий текст + секция «Куплено»)"

requirements-completed: [LIST-01, LIST-02, LIST-03, LIST-05]

coverage:
  - id: D1
    description: "ListControls: закреплённая панель с Select сортировки (aria-label «Сортировка», ровно 3 SelectItem в порядке D-01 приоритет→дата→алфавит) и Checkbox «Показывать купленные» (default OFF, D-06)"
    requirement: "LIST-01"
    verification:
      - kind: unit
        ref: "src/components/items/ListControls.test.tsx — Select содержит 3 опции в порядке D-01 + чекбокс фильтра"
        status: pass
    human_judgment: false
  - id: D2
    description: "ListView держит sortKey/showPurchased эфемерным useState (НЕ URL/localStorage/nuqs, D-09); переключение Select меняет порядок активных карточек через sortActive; смена сортировки не затрагивает архив"
    requirement: "LIST-02"
    verification:
      - kind: e2e
        ref: "e2e/app/purchase-archive.spec.ts — переключение Select меняет порядок активных карточек"
        status: pass
      - kind: unit
        ref: "npx vitest run src/lib/list/sort — регресс компараторов сортировки (04-02) зелёный"
        status: pass
    human_judgment: false
  - id: D3
    description: "Фильтр «показывать купленные» открывает отдельную секцию «Куплено» ниже активных (условна на showPurchased && ≥1 купленной); при выключенном фильтре купленные скрыты; архив всегда sortPurchased (purchasedAt убыв., §Pitfall 1)"
    requirement: "LIST-05"
    verification:
      - kind: e2e
        ref: "e2e/app/purchase-archive.spec.ts — фильтр раскрывает секцию «Куплено», undo из архива возвращает покупку в активные"
        status: pass
    human_judgment: false
  - id: D4
    description: "Все три empty-варианта (§Pitfall 2): 0 покупок → «Список пуст» (page.tsx, панель не рендерится); все куплены + фильтр ВЫКЛ → heading «Активных покупок нет» + подсказка включить фильтр; все куплены + фильтр ВКЛ → короткий «Активных покупок нет.» + секция «Куплено» ниже"
    requirement: "LIST-05"
    verification:
      - kind: unit
        ref: "src/lib/list/sort + tsc — логика ветвления active.length × showPurchased; тексты дословно из §Copywriting Contract"
        status: pass
    human_judgment: false
  - id: D5
    description: "Приглушённое лечение купленной карточки: контейнер opacity-70, title line-through text-muted-foreground (избыточный канал статуса, не только цвет); активная карточка без изменений"
    requirement: "LIST-05"
    verification:
      - kind: e2e
        ref: "e2e/app/purchase-archive.spec.ts — приглушённая карточка в секции «Куплено»"
        status: pass
    human_judgment: false
  - id: D6
    description: "Mobile-first бэкстоп на 375px (LIST-08): тач-зоны ≥44px (Select/строка фильтра/чекбокс «куплено»); sticky-панель не перекрывает первую карточку; длинный title усекается без выталкивания badge; тап по чекбоксу не раскрывает разбивку; undo-тост bottom-center не закрывает панель; приглушение+зачёркивание купленной карточки"
    requirement: "LIST-08"
    verification: []
    human_judgment: true
    rationale: "Визуальный/тактильный бэкстоп на 375px (тач-зоны ≥44px, sticky без перекрытия, усечение title, тост не закрывает панель) требует ручной проверки на устройстве — автоматизация недостаточна. Приложение сейчас не запущено; проверка ОТЛОЖЕНА в UAT (/gsd-verify-work 4), как и визуальные бэкстопы Фазы 3. НЕ провалена — ожидает подтверждения человеком."

# Metrics
duration: ~15min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 04: Панель сортировки/фильтра, секция «Куплено» и empty-состояния — Summary

**Управляемый mobile-first список: закреплённая панель ListControls (Select трёх режимов сортировки D-01 + Checkbox фильтра «показывать купленные» D-06), отдельная секция «Куплено» с приглушёнными (opacity-70 + line-through) карточками, все три empty-варианта и эфемерное клиентское состояние (useState, D-09); mobile-first бэкстоп на 375px отложен в UAT.**

## Performance

- **Duration:** ~15 min (включая паузу на checkpoint человек-верификации)
- **Completed:** 2026-08-09
- **Tasks:** 3 (Задача 1 — ListControls + ListView; Задача 2 — приглушение карточки + e2e; Задача 3 — визуальный бэкстоп 375px, отложен в UAT)
- **Files modified:** 5 (1 создан, 4 изменены)

## Accomplishments

- **ListControls** (`src/components/items/ListControls.tsx`, `"use client"`) — закреплённая панель `sticky top-0 z-10 bg-background border-b`. Ряд A: полноширинный `Select` (trigger `h-11 w-full`, `aria-label="Сортировка"`) с ровно 3 опциями в порядке D-01 — `По приоритету` (default, value `priority`) → `По дате добавления` (value `createdAt`) → `По алфавиту` (value `title`). Ряд B: label-обёртка (`min-h-11`, клик по всей строке) с `Checkbox` (default OFF) + span «Показывать купленные». Чистый контролируемый client-leaf — БЕЗ собственного состояния: получает `sortKey`/`showPurchased` и колбэки, состояние держит `ListView` (D-09).
- **Расширенный ListView** (`src/components/items/ListView.tsx`) — добавлены `useState<SortKey>("priority")` и `useState(false)` для `showPurchased` (эфемерно — НЕ URL/localStorage/nuqs, D-09; перезагрузка сбрасывает к дефолту приоритет + купленные-скрыты). `partitionByPurchased(items)` → `{ active, purchased }` ДО сортировки (§Pitfall 1); активные — `sortActive(active, sortKey)` (управляется Select), архив — `sortPurchased(purchased)` (ВСЕГДА purchasedAt убыв., независимо от Select). Рендер: `<ListControls>`, активный блок, затем (только при `showPurchased && purchased.length > 0`) секция «Куплено» — разделитель `border-t mt-8`, заголовок `Куплено · {n}` (`text-muted-foreground`), стопка приглушённых карточек.
- **Три empty-варианта** (§Pitfall 2, тексты дословно из §Copywriting Contract): 0 покупок → «Список пуст» (обрабатывает `page.tsx` из 04-03, панель не рендерится); все куплены + фильтр ВЫКЛ → heading «Активных покупок нет» + подсказка «Все покупки отмечены купленными. Включите „Показывать купленные“, чтобы увидеть архив.»; все куплены + фильтр ВКЛ → короткий «Активных покупок нет.» + секция «Куплено» ниже.
- **Приглушённое лечение купленной карточки** (`src/components/items/ItemCard.tsx`) — при `purchased === true` контейнер получает `opacity-70`, title — `line-through text-muted-foreground`. Избыточный канал статуса: «куплено» читается по зачёркиванию + приглушению + отдельной секции + checked-чекбоксу, а не одним цветом (доступность). При `purchased === false` — прежнее оформление без изменений (регресс не сломан).
- **Расширенный сквозной e2e** (`e2e/app/purchase-archive.spec.ts`) поверх happy-path из 04-03 (без дублирования регистрации/хелперов): 2-3 покупки → отметка одной купленной → исчезает из активных при фильтре ВЫКЛ → включение «Показывать купленные» раскрывает секцию «Куплено» с приглушённой карточкой → снятие чекбокса в архиве возвращает покупку в активные → переключение Select меняет порядок активных карточек.

## Task Commits

Каждая задача закоммичена атомарно (TDD RED → GREEN):

1. **Задача 1 (RED): падающий тест ListControls** — `d31a54f` (test) — Select D-01 (3 опции) + чекбокс фильтра
2. **Задача 1 (GREEN): ListControls + расширение ListView** — `803d532` (feat) — панель, сортировка, фильтр, секция «Куплено», empty-состояния
3. **Задача 2 (RED): расширенный e2e** — `aaccc67` (test) — фильтр раскрывает «Куплено», undo из архива, переключение Select
4. **Задача 2 (GREEN): приглушённая купленная карточка** — `da7b52b` (feat) — opacity-70 + line-through title при purchased=true

**Plan metadata:** (docs-коммит ниже)

_Задача 3 (визуальный бэкстоп 375px) — checkpoint человек-верификации, кода не производит; см. «Отложенная ручная проверка (UAT)»._

## Files Created/Modified

- `src/components/items/ListControls.tsx` (нов.) — sticky-панель: `Select` сортировки (`aria-label="Сортировка"`, 3 опции D-01) + `Checkbox` фильтра «Показывать купленные». Контролируемый client-leaf без состояния.
- `src/components/items/ListView.tsx` (изм.) — `useState` sortKey/showPurchased (D-09); `partitionByPurchased` → `sortActive`/`sortPurchased` (§Pitfall 1); секция «Куплено» (условна); три empty-варианта.
- `src/components/items/ItemCard.tsx` (изм.) — приглушённое лечение при `purchased=true` (`opacity-70` контейнер + `line-through text-muted-foreground` title).
- `e2e/app/purchase-archive.spec.ts` (изм.) — расширен сценарий: filter → «Куплено» → undo из архива → переключение Select.
- `src/components/items/ListControls.test.tsx` (нов.) — RTL-тест панели (Select D-01 + чекбокс фильтра).

## Decisions Made

- **ListControls — двухрядный стек, а не один ряд:** длинный русский label «Показывать купленные» рядом с Select сжал бы обе тач-цели ниже 44px на 375px. Ряд A — полноширинный Select (h-11), Ряд B — строка фильтра (min-h-11). Соответствует §UI-SPEC «Панель управления».
- **Заголовок архива «Куплено · {n}» со счётчиком** (`text-muted-foreground`): второстепенная поверхность; счётчик даёт объём архива без раскрытия карточек.
- **Избыточный канал статуса «куплено»:** opacity-70 + line-through + отдельная секция + checked-чекбокс — статус не передаётся ТОЛЬКО цветом (доступность, §Color).

## Deviations from Plan

None — план выполнен как написано (Задачи 1–2). Задача 3 (визуальный бэкстоп) обработана по решению разработчика на checkpoint: отложена в UAT (см. ниже), а не сфабрикована как пройденная.

## Отложенная ручная проверка (UAT)

**Задача 3 плана — checkpoint `human-verify` для mobile-first бэкстопа на 375px (LIST-08) — ОТЛОЖЕНА в end-of-phase UAT** (`/gsd-verify-work 4`), а не выполнена сейчас. Приложение в момент завершения плана не запущено; визуальная проверка на 375px невозможна автоматически. Так же обрабатывались визуальные бэкстопы Фазы 3 (стали UAT-элементами, фаза ушла в `human_needed` до verify-work). **Бэкстоп НЕ провален — ожидает подтверждения человеком.** Пройденного визуального прогона НЕ фабриковалось.

Проверяющему (verify-work / phase verifier) — подтвердить на ширине 375px в DevTools, войдя под пользователем с несколькими покупками:

1. **Тач-зоны ≥44px** — `Select` сортировки, строка фильтра «Показывать купленные» и чекбокс «куплено» на карточке — каждая ≥44px по высоте, свободно нажимаются пальцем.
2. **Sticky-панель не перекрывает первую карточку** — `ListControls` закреплена (`sticky top-0`), при прокрутке остаётся сверху и НЕ наезжает на первую карточку активного списка; вертикальный стек (Select над строкой фильтра) не ломается.
3. **Длинный title усекается без выталкивания badge** — длинное название покупки обрезается (`truncate`) и НЕ выталкивает badge приоритета за край; так же ведёт себя купленная (приглушённая) карточка.
4. **Тап по чекбоксу «куплено» не раскрывает Collapsible** — нажатие на чекбокс отмечает купленной, но НЕ переключает разбивку приоритета (три независимых тач-цели: чекбокс / title / badge).
5. **Undo-тост bottom-center не закрывает панель** — после отметки купленной тост sonner появляется снизу по центру и НЕ перекрывает панель управления сверху; кнопка «Отменить» работает.
6. **Купленная карточка — избыточный канал статуса** — приглушена (`opacity-70`) И зачёркнута (`line-through`), отличается не ТОЛЬКО цветом.

**Статус требования LIST-08:** done-pending-UAT-backstop — реализация завершена (панель, приглушение, тост), визуальный бэкстоп на 375px ждёт ручного подтверждения. В REQUIREMENTS.md остаётся `Pending` до прохождения UAT.

## Issues Encountered

None — Задачи 1–2 выполнены без блокеров. Автоматическая верификация зелёная: `npx vitest run` 189/189, `npx playwright test` 12/12, `npx tsc --noEmit` чист.

## Verification Results

- `npx vitest run` — **189/189 зелёный** (регресс sort-логики 04-02 + новый тест ListControls; add/edit/delete/scoring не сломаны).
- `npx tsc --noEmit` — **чист**.
- `npx playwright test` — **12/12 зелёный** (расширенный purchase-archive: filter → «Куплено» → undo → переключение Select; add/edit/delete/auth не сломаны).
- Ручной бэкстоп на 375px (LIST-08) — **ОТЛОЖЕН в UAT** (см. «Отложенная ручная проверка»).

## User Setup Required

None — использованы уже настроенные локальные БД `shopping_list` (dev) и `shopping_list_test` (test) из `.env.local`.

## Next Phase Readiness

- Фаза 4 функционально завершена: управляемый mobile-first список (3 режима сортировки, фильтр «показывать купленные», секция «Куплено» с архивом, все empty-состояния) готов. Остаётся один UAT-элемент — визуальный бэкстоп 375px (LIST-08), который подтвердит `/gsd-verify-work 4`; до этого фаза в состоянии `human_needed`.
- Фаза 5 (зависимости/блокировка) переиспользует: `ItemCard` (место для визуального отличия заблокированных, DEP-02), `PurchaseCheckbox`/`setItemPurchased` (блокировать отметку купленной при невыполненной зависимости, DEP-01), форму add/edit (выбор зависимости, ITEM-06).
- Блокеров нет.

## Self-Check: PASSED

Все заявленные файлы существуют на диске; все четыре коммита задач (`d31a54f`, `803d532`, `aaccc67`, `da7b52b`) присутствуют в истории git.

---
*Phase: 04-list-sort-filter-archive*
*Completed: 2026-08-09*
