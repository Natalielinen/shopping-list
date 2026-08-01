---
phase: 02-add-item-scoring
verified: 2026-08-01T12:10:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "На вьюпорте 375px открыть карточку покупки с трёхзначным total (напр. просроченный дедлайн → total ≥ 100). Проверить, что badge приоритета остаётся в одну строку и не ломает раскладку карточки."
    expected: "Badge (иконка + метка «Высокий» + число) не переносится на вторую строку и не выталкивает заголовок; карточка сохраняет форму."
    why_human: "Визуальный overflow-бэкстоп (UI-SPEC E2, verification: backstop) — grep/тесты не измеряют перенос строки и фактическую ширину на устройстве."
  - test: "На вьюпорте 375px создать покупку с очень длинным названием (60+ символов без пробелов) и открыть список. Проверить перенос/усечение заголовка."
    expected: "Длинное название усекается (truncate/min-w-0) и не выталкивает badge приоритета за пределы карточки; раскладка карточки не ломается."
    why_human: "Визуальный long-text бэкстоп (UI-SPEC E4, verification: backstop) — фактическое поведение truncate видно только при рендере в браузере."
  - test: "На вьюпорте 375px раскрыть полную разбивку очков у покупки со всеми полями + isCredit (до 7 строк вкладов + «Итого»). Проверить отсутствие клиппинга."
    expected: "Все строки разбивки и «Итого» видны полностью, без обрезки/горизонтального переполнения на узком мобильном экране."
    why_human: "Визуальный overflow-бэкстоп разбивки (UI-SPEC E3, verification: backstop) — вертикальный/горизонтальный клиппинг проверяется только визуально."
---

# Фаза 2: Добавление покупок с автоматическим приоритетом — отчёт верификации

**Цель фазы:** Авторизованный пользователь может добавить покупку через форму и сразу видит её автоматически рассчитанный приоритет (`total`) с разбивкой по полям, объясняющей оценку. (MVP, mobile-first, TDD; опирается на Фазу 1.)
**Проверено:** 2026-08-01
**Статус:** human_needed
**Ре-верификация:** Нет — первичная верификация

## Достижение цели

### Observable Truths

| # | Truth | Статус | Доказательство |
| --- | --- | --- | --- |
| 1 | Пользователь добавляет покупку с обязательным `title` + выпадающими `category/urgency/need/benefit` (SC-1, ITEM-01/02) | ✓ VERIFIED | `itemInputSchema` (item.ts:63-76): `title` `.trim().min(1)`, четыре `z.enum(*_VALUES)` с «Выберите значение»; форма `AddItemForm.tsx` рендерит поля; e2e `add-item.spec.ts` проходит полный путь; write-путь `actions.ts` → `createItemForUser` |
| 2 | Необязательные `link/description/price/deadline`; чекбокс «в кредит» показывает `monthlyPayment`; `doubts` по умолчанию «нет сомнений» (SC-2, ITEM-03/04/05) | ✓ VERIFIED | `AddItemForm.tsx` рендерит все поля; условный `monthlyPayment` через `form.watch("isCredit")`; `setValue(monthlyPayment, undefined)` при снятии; `doubts` default `"sure"`. RTL-тесты (AddItemForm.test.tsx) утверждают появление/скрытие и очистку поля — все зелёные |
| 3 | У каждой покупки виден доступный badge, чей `total` = сумме очковых полей, + разбивка по полям (SC-3, LIST-06/07) | ✓ VERIFIED | `PriorityBadge.tsx` — 4 избыточных канала (число + метка + иконка + цвет); `ScoreBreakdown.tsx` (Collapsible) — знаковая строка на вклад + «Итого». Юнит-тест: сумма `computeBreakdown` === `computeTotal`; единый `now` в list/page.tsx гарантирует согласованность |
| 4 | `deadlinePoints = clamp(28 − дни, −100, 100)`, 0 без дедлайна; `total` считается на чтении и отражает текущую дату (SC-4, SCORE-02/05) | ✓ VERIFIED | `scoring.ts`: `deadline=null → 0`; просрочка `days<0 → 100` до clamp; иначе clamp. Дни через `differenceInCalendarDays` с нормализацией к UTC-полуночи (WR-01 исправлен). Колонки `total`/`deadlinePoints` ОТСУТСТВУЮТ в схеме и миграции; list/page.tsx создаёт `now = new Date()` на каждый рендер. Юнит-тесты детерминизма зелёные |
| 5 | Кредит −2; `doubts` 0/−1/−3; фиксированные шкалы category/urgency/need/benefit из SUMMARY (SC-5, SCORE-01/03/04/06) | ✓ VERIFIED | `scales.ts` — exhaustive `Record<Тип,number>` ровно по SUMMARY + D-01…D-03 (`vital=12`); `computeTotal` вычитает `CREDIT_PENALTY=2`; `DOUBTS_POINTS` 0/−1/−3. Покрыто юнит-тестами (scoring.test.ts) |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

Дополнительно к 5 контрактным критериям ROADMAP проверены plan-специфичные truths (изоляция записи по `userId`, отсутствие SQL `ORDER BY` по вычисляемому приоритету, серверная ре-валидация, отсутствие `redirect()` в try/catch) — все подтверждены кодом (см. ниже).

### Required Artifacts

| Артефакт | Назначение | Статус | Детали |
| --- | --- | --- | --- |
| `src/lib/scoring/scales.ts` | Фиксированные шкалы + значения enum | ✓ VERIFIED | Exhaustive Record'ы, `vital=12`, импортируется scoring.ts + item.ts |
| `src/lib/scoring/scoring.ts` | Чистый движок (deadlinePoints/computeTotal/computeBreakdown/priorityLevel) | ✓ VERIFIED | `now: Date` — единственный источник времени; `differenceInCalendarDays`; UTC-нормализация |
| `src/lib/validation/item.ts` | Единый Zod-контракт покупки | ✓ VERIFIED | enum-whitelist, `optionalRubles` (nonnegative/finite/max/≤2 знака), title `.trim()`, description → NULL |
| `src/server/db/schema.ts` | Расширенная таблица items | ✓ VERIFIED | Все поля покупки; БЕЗ total/deadlinePoints; deadline `date mode:date`; price/monthlyPayment `integer` |
| `drizzle/0001_cuddly_rhino.sql` | Миграция аддитивных колонок | ✓ VERIFIED | ALTER TABLE items 11 колонок; total/deadlinePoints отсутствуют |
| `src/server/repos/items.ts` | Write-seam createItemForUser | ✓ VERIFIED | `userId` подмешивается ПОСЛЕ data в `.values()` (mass-assignment исключён) |
| `src/app/(app)/list/new/actions.ts` | Server Action createItem | ✓ VERIFIED | requireUser + safeParse + перевод рубли→копейки один раз + createItemForUser; нет redirect в try/catch |
| `src/components/items/AddItemForm.tsx` | Полная форма | ✓ VERIFIED | Все поля + условный monthlyPayment; "use client"; вызывает createItem |
| `src/components/items/PriorityBadge.tsx` | Badge приоритета | ✓ VERIFIED | 4 канала; whitespace-nowrap |
| `src/components/items/ItemCard.tsx` | Карточка покупки | ✓ VERIFIED | truncate/min-w-0; форвардит breakdown |
| `src/components/items/ScoreBreakdown.tsx` | Раскрываемая разбивка | ✓ VERIFIED | "use client" Collapsible; свёрнута по умолчанию; нет new Date() |
| `src/app/(app)/list/page.tsx` | RSC-список | ✓ VERIFIED | Единый now; computeTotal + computeBreakdown; JS-сортировка по убыванию; пустое состояние |
| `src/components/app/AppHeader.tsx` | Кнопка входа «Добавить» | ✓ VERIFIED | Link на /list/new + Plus; email сохраняет truncate/min-w-0 |
| `e2e/app/add-item.spec.ts` | Сквозной e2e | ✓ VERIFIED | add → redirect → badge → сортировка по убыванию total |

### Key Link Verification

| From | To | Via | Статус |
| --- | --- | --- | --- |
| AddItemForm.tsx | actions.ts | `createItem(values)` + router.push при ok | ✓ WIRED |
| actions.ts | repos/items.ts | `createItemForUser(user.id, …)` после requireUser + safeParse | ✓ WIRED |
| list/page.tsx | scoring.ts | `computeTotal`/`computeBreakdown` на чтении, единый now, JS-сортировка | ✓ WIRED |
| PriorityBadge.tsx | scoring.ts | `priorityLevel(total)` → метка/иконка/цвет | ✓ WIRED |
| item.ts | scoring/scales.ts | импорт `*_VALUES` для z.enum (единый источник) | ✓ WIRED |
| ItemCard.tsx | ScoreBreakdown.tsx | форвардит breakdown под PriorityBadge | ✓ WIRED |
| AppHeader.tsx | /list/new | Link «Добавить» | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Артефакт | Источник данных | Реальные данные | Статус |
| --- | --- | --- | --- |
| list/page.tsx → ItemCard | `findItemsForUser(user.id)` (реальный Drizzle-select) | Да — реальные строки БД, изоляция по userId | ✓ FLOWING |
| PriorityBadge / ScoreBreakdown | `computeTotal`/`computeBreakdown(item, now)` из строк списка | Да — вычисляются из полей покупки, не хардкод | ✓ FLOWING |

### Behavioral Spot-Checks

| Поведение | Команда | Результат | Статус |
| --- | --- | --- | --- |
| Весь unit/RTL/integration-набор | `npx vitest run` | 132 passed (11 файлов) | ✓ PASS |
| Типобезопасность | `npx tsc --noEmit` | 0 ошибок | ✓ PASS |
| Условная видимость + очистка monthlyPayment | AddItemForm.test.tsx (RTL, включён в набор) | Появление/скрытие и очистка утверждены — зелёные | ✓ PASS |
| Изоляция записи + mass-assignment + копейки | items.iso.test.ts (реальная Postgres) | Зелёный | ✓ PASS |

### Requirements Coverage

| Требование | План | Описание | Статус | Доказательство |
| --- | --- | --- | --- | --- |
| ITEM-01 | 02-02/03 | Добавление покупки, title обязателен | ✓ SATISFIED | схема + форма + e2e |
| ITEM-02 | 02-02/03 | Обязательные выпадающие списки | ✓ SATISFIED | z.enum-whitelist + Select |
| ITEM-03 | 02-02/04 | Необязательные link/description/price/deadline | ✓ SATISFIED | схема + форма |
| ITEM-04 | 02-04 | isCredit → monthlyPayment | ✓ SATISFIED | условный рендер + RTL |
| ITEM-05 | 02-02/04 | doubts по умолчанию «нет сомнений» | ✓ SATISFIED | default "sure" |
| SCORE-01 | 02-01 | total = сумма очковых полей | ✓ SATISFIED | computeTotal + тесты |
| SCORE-02 | 02-01 | deadlinePoints clamp, 0 без дедлайна | ✓ SATISFIED | scoring.ts + тесты |
| SCORE-03 | 02-01 | isCredit −2 | ✓ SATISFIED | CREDIT_PENALTY |
| SCORE-04 | 02-01 | doubts 0/−1/−3 | ✓ SATISFIED | DOUBTS_POINTS |
| SCORE-05 | 02-01/02/03 | Считается на чтении, не замораживается | ✓ SATISFIED | нет колонок; now на рендер |
| SCORE-06 | 02-01 | Фиксированные шкалы из SUMMARY | ✓ SATISFIED | scales.ts exhaustive |
| LIST-06 | 02-03 | Badge приоритета (доступный) | ✓ SATISFIED | 4 канала |
| LIST-07 | 02-05 | Разбивка приоритета | ✓ SATISFIED | ScoreBreakdown |

Все 13 требований из PLAN frontmatter присутствуют в REQUIREMENTS.md именно под Фазой 2; orphaned-требований нет (REQUIREMENTS.md маппит на Фазу 2 ровно эти 13 ID).

### Anti-Patterns Found

Не обнаружено. Debt-маркеров (TODO/FIXME/XXX/HACK) в изменённых файлах нет. Совпадения по `placeholder` — легитимные HTML-атрибуты полей формы и Tailwind-классы shadcn, не заглушки. Все 6 находок код-ревью (BL-01, WR-01, WR-02, IN-01, IN-02, IN-03) подтверждены исправленными в коде:
- **BL-01:** price/monthlyPayment валидируются как рубли (`optionalRubles`), перевод в копейки (`Math.round(×100)`) выполняется РОВНО ОДИН РАЗ на сервере в actions.ts; колонки integer; интеграционный тест копеек зелёный.
- **WR-01:** `deadlinePoints` нормализует оба операнда к UTC-полуночи (`toUtcMidnight`) перед `differenceInCalendarDays`.
- **WR-02:** `title` — `.trim().min(1)`.
- **IN-01:** `onSubmit` оборачивает `createItem` в try/catch с форм-левел Alert.
- **IN-02:** `optionalText` переводит пустую/пробельную строку описания в undefined (→ NULL).
- **IN-03:** `optionalRubles` содержит `.refine(Number.isFinite)` с сообщением «Введите число».

### Human Verification Required

Три UI-бэкстопа из 02-UI-SPEC (`## UI Considerations`, `verification: backstop`) — визуальные проверки на узком мобильном вьюпорте, которые нельзя подтвердить grep/тестами. Детали — во frontmatter `human_verification`:

1. **Badge при трёхзначном total (E2)** — одна строка, без слома карточки на 375px.
2. **Длинное название (E4)** — усечение без вытеснения badge.
3. **Полная разбивка (E3)** — до 7 строк + «Итого» без клиппинга на 375px.

### Gaps Summary

Функциональных пробелов не обнаружено: все 5 критериев успеха ROADMAP и все 13 требований подтверждены в коде и покрыты зелёными тестами (vitest 132/132, tsc 0, e2e добавления зелёный). Движок подсчёта, слой валидации, схема/миграция, write-путь с изоляцией по `userId`, badge и разбивка — реализованы и провязаны. Единственное, что осталось, — 3 визуальных мобильных бэкстопа, требующих человеческого подтверждения на реальном вьюпорте 375px. Поэтому статус — `human_needed`, а не `passed`.

---

_Проверено: 2026-08-01_
_Verifier: Claude (gsd-verifier)_
