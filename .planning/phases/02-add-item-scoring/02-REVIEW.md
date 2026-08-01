---
phase: 02-add-item-scoring
reviewed: 2026-08-01T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - src/lib/scoring/scoring.ts
  - src/lib/scoring/scales.ts
  - src/lib/validation/item.ts
  - src/app/(app)/list/new/actions.ts
  - src/server/repos/items.ts
  - src/app/(app)/list/page.tsx
  - src/server/db/schema.ts
  - drizzle/0001_cuddly_rhino.sql
  - src/components/items/AddItemForm.tsx
  - src/components/items/ItemCard.tsx
  - src/components/items/ScoreBreakdown.tsx
  - src/components/items/PriorityBadge.tsx
  - src/components/app/AppHeader.tsx
  - tests/helpers/db.ts
findings:
  blocker: 1
  high: 0
  medium: 2
  low: 3
  total: 6
status: issues_found
---

# Фаза 2: Отчёт код-ревью (add-item-scoring)

**Проверено:** 2026-08-01
**Глубина:** deep (кросс-файловый анализ движка подсчёта, слоя валидации, схемы БД и потока Server Action)
**Файлов проверено:** 14
**Статус:** issues_found (найдены дефекты; ревью advisory, не блокирует)

## Резюме

Ядро подсчёта очков (`scoring.ts` + `scales.ts`) реализовано корректно и точно
соответствует SUMMARY.md и решениям D-01…D-05: спецслучай просрочки (`days < 0 →
+100` до `clamp`), отсутствие дедлайна = 0, границы `clamp(−100..100)`, детерминизм
через внедряемый `now`, пороги badge (≥30 / 10–30 / <10), исчерпывающие
`Record<Тип, number>`-шкалы, `doubts` 0/−1/−3, штраф за кредит −2, `urgency vital =
12`. Контракт «единый `now`» между `computeTotal` и `computeBreakdown` соблюдён:
сумма строк разбивки провабельно равна `total` в badge. Изоляция по `userId`
выдержана — `createItemForUser` подмешивает `userId` из сессии ПОСЛЕ `data`,
mass-assignment исключён; Server Action берёт `userId` только из `requireUser()` и
не вызывает `redirect()` внутри `try/catch` (ловушка NEXT_REDIRECT обойдена).
Сортировка — в JS по вычисляемому `total` с детерминированным tiebreak по
`createdAt`, а не SQL `ORDER BY`. Badge кодирует уровень четырьмя каналами (число +
текст + иконка + цвет), не только цветом (LIST-06).

Главная проблема — на стыке слоя валидации и схемы БД: числовые поля `price` /
`monthlyPayment` объявлены `integer`, но валидация и форма допускают дробный ввод
без преобразования, из-за чего типичный ввод цены с копейками ломает сохранение
покупки. Есть также латентная TZ-ошибка на день для отрицательных смещений UTC и
несколько пробелов валидации.

## Blocker Issues

### BL-01: Дробный `price` / `monthlyPayment` ломает вставку (integer-колонка) + нарушен контракт «копейки»

**Файлы:**
`src/lib/validation/item.ts:20-26`,
`src/server/db/schema.ts:151-154`,
`src/components/items/AddItemForm.tsx:301-320, 391-414`

**Проблема:**
Колонки `price` и `monthly_payment` в схеме — `integer` (комментарий
`schema.ts:152` явно называет их «integer-копейки»). Но:

1. Валидатор `optionalNumber` = `z.coerce.number().nonnegative().optional()` — **нет
   `.int()`**, дробные значения проходят.
2. Поле формы `price` (и `monthlyPayment`) имеет `inputMode="decimal"` и placeholder
   `"0"` — интерфейс приглашает вводить копейки/дробную цену (например, `199.99`).
3. Нигде нет преобразования рублей → копейки (умножения на 100).

Итог для реального пользователя: при вводе цены `199.99` `parsed.data.price = 199.99`
попадает в `createItemForUser` → `INSERT` в колонку `int4`. `postgres.js` сериализует
значение как текст `"199.99"`; PostgreSQL при разборе текста в `int4` кидает
`invalid input syntax for type integer: "199.99"`. Исключение ловится `catch` в
`createItem` (`actions.ts:36`) и возвращается generic-ошибка
«Не удалось сохранить покупку» без указания проблемного поля. То есть **добавление
покупки с дробной ценой полностью не работает** при внешне валидном вводе, а
пользователь не понимает причину. Даже если конкретная связка драйвер/версия
округлит значение вместо ошибки — это тихая порча данных (199.99 → 200).

Дополнительно нарушен контракт «копейки»: целое `199` рублей сохраняется как `199`
(что по комментарию означает 1.99 ₽). Поле пока не отображается, поэтому эффект
латентный, но всплывёт в Фазе 3+ при выводе цены. Также нет `.max(...)` — значение
> `2147483647` (int4) тоже уронит вставку.

**Fix:** привести валидатор, форму и колонку к единому контракту. Если хранить в
копейках — принимать рубли и умножать на 100 при записи:
```ts
// src/lib/validation/item.ts — принимать рубли с ≤2 знаками и переводить в копейки
const optionalKopecks = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce
    .number({ message: "Введите число" })
    .nonnegative("Значение не может быть отрицательным")
    .max(21_000_000, "Слишком большое значение")
    .transform((rub) => Math.round(rub * 100)) // рубли → копейки (int)
    .optional()
);
```
Либо, если копейки не нужны в v1 — хранить целые рубли: добавить `.int("Введите
целое число")` в валидатор, убрать `inputMode="decimal"` (использовать
`inputMode="numeric"`), исправить вводящий в заблуждение комментарий «копейки» в
`schema.ts`. В любом случае клиент и сервер должны отвергать дробь ДО `INSERT`, а
не полагаться на generic-`catch`.

## Warnings (Medium)

### WR-01: Сдвиг `deadlinePoints` на день для отрицательных смещений UTC

**Файлы:** `src/lib/validation/item.ts:36-39`, `src/lib/scoring/scoring.ts:58-63`,
`src/server/db/schema.ts:150`

**Проблема:**
`deadline` вводится как строка `type="date"` (`"2026-08-15"`) и приводится
`z.coerce.date()` → `new Date("2026-08-15")`, что даёт **полночь UTC**. Колонка
`date` при чтении обратно тоже реконструируется как UTC-полночь. В `scoring.ts`
`differenceInCalendarDays(deadline, now)` считает КАЛЕНДАРНЫЕ дни в локальной зоне
рантайма (`now = new Date()` локальное). Для зон западнее UTC (например, UTC−5)
UTC-полночь 15-го числа = 14-е число 19:00 локально → `differenceInCalendarDays`
вернёт на 1 меньше, сместив и порог просрочки (`days < 0 → +100`), и обычную формулу
на день. Это противоречит заявленной «TZ-safety» (RESEARCH Pitfall 4). Аудитория
проекта — RU (UTC+3…+12, все положительные), поэтому фактический риск сейчас низкий,
но дефект корректности реальный и всплывёт при деплое/пользователях в западных зонах.

**Fix:** держать «сейчас» и дедлайн в одной системе координат. Простейший вариант —
считать разницу в UTC-днях, либо нормализовать `now` к UTC-полуночи перед
`differenceInCalendarDays`, либо использовать `date-fns-tz` с явной зоной. Например:
```ts
import { differenceInCalendarDays } from "date-fns";
// нормализуем обе даты к UTC-полуночи, чтобы избежать сдвига по локальной зоне
const toUtcMidnight = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const days = differenceInCalendarDays(toUtcMidnight(deadline), toUtcMidnight(now));
```
Зафиксировать выбранную зону в unit-тесте с датой-граничным случаем (просрочка на 1
день) при машинном TZ = UTC−5.

### WR-02: `title` пропускает строки из одних пробелов

**Файл:** `src/lib/validation/item.ts:42`

**Проблема:** `title: z.string().min(1, "Заполните это поле")` — значение `"   "`
(только пробелы) имеет длину 3 и проходит валидацию и клиента, и сервера. Пользователь
может создать покупку с визуально пустым названием; в списке (`ItemCard`, `truncate`)
это будет пустая строка.

**Fix:** тримить и валидировать длину после трима:
```ts
title: z.string().trim().min(1, "Заполните это поле"),
```

## Info (Low)

### IN-01: Исключение `requireUser()` не перехватывается клиентом формы

**Файлы:** `src/app/(app)/list/new/actions.ts:24`,
`src/components/items/AddItemForm.tsx:113-119`

**Проблема:** `requireUser()` вызывается ДО `try/catch` (осознанно — не глотать
NEXT_REDIRECT и не писать до проверки, T-2-03). Но при истёкшей сессии он бросает
`Error("UNAUTHENTICATED")`, Server Action реджектится, а `onSubmit` делает
`const res = await createItem(values)` без `try/catch` → необработанный reject,
пользователь не видит человекочитаемой ошибки (в prod — generic error Next).
Вероятность низкая (страница уже под auth-gate layout), но обработка ошибок
непоследовательна.

**Fix:** обернуть вызов в `onSubmit` в `try/catch` и показать `formError`, либо
вернуть из Server Action `{ ok: false, error }` для случая неаутентифицированности
(с редиректом на `/login` на клиенте).

### IN-02: Необязательные строки сохраняются как `""`, а не `null`

**Файлы:** `src/lib/validation/item.ts:48`, `src/components/items/AddItemForm.tsx:284-299`

**Проблема:** `description: z.string().optional()` не преобразует пустую строку в
`undefined` (в отличие от `optionalUrl`/`optionalNumber`/`optionalDate`, которые
через `preprocess` дают `undefined`). Если поле «Описание» тронуто и очищено,
в БД попадёт `""` вместо `NULL` — неконсистентно с остальными nullable-полями.

**Fix:** применить тот же приём `preprocess("" → undefined)`, что и для прочих
опциональных полей, либо `z.string().trim().optional().transform(v => v || undefined)`.

### IN-03: `optionalNumber` не отсекает `NaN` / `Infinity` информативно

**Файл:** `src/lib/validation/item.ts:20-26`

**Проблема:** `z.coerce.number()` для нечислового ввода даёт `NaN`, для `"Infinity"`
— `Infinity`. `NaN` затем падает на `.nonnegative()` с сообщением «Значение не может
быть отрицательным» (вводит в заблуждение), а `Infinity` проходит и роняет `INSERT`
в `integer`. Клиентский `inputMode` снижает, но не исключает такой ввод (вставка,
автозаполнение).

**Fix:** добавить `.finite()` и опереться на `{ message: "Введите число" }` в
`z.coerce.number(...)` для нечисловых значений; согласовать с фиксом BL-01.

---

_Проверено: 2026-08-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
