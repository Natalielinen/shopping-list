# Phase 2: Добавление покупок с автоматическим приоритетом — Research

**Researched:** 2026-08-01
**Domain:** Server Actions (Next 16) + Zod v4 валидация + чистый движок подсчёта очков (date-fns) + Drizzle-миграция + layered TDD
**Confidence:** HIGH (стек, паттерны и шкалы зафиксированы; исследованы только реализационные детали поверх них)

## Summary

Стек, шкалы очков и UI уже зафиксированы (`.claude/CLAUDE.md`, `SUMMARY.md`, `02-CONTEXT.md`, `02-UI-SPEC.md`). Это исследование не пересматривает выбор инструментов — оно де-рискует ПЛАНИРОВАНИЕ пяти реализационных швов: (1) чистый движок подсчёта с внедряемой «текущей датой», (2) единая Zod-схема покупки для формы и Server Action, (3) первый в проекте write-путь через Server Action, (4) миграция расширения таблицы `items`, (5) раскладка тестов по слоям TDD.

Главные находки. **Движок подсчёта** — набор чистых функций в новом модуле `src/lib/scoring/`, принимающих `now: Date` явным параметром; `deadlinePoints` требует **специального случая** для просрочки (D-04: любой `days < 0` = фиксированные +100), а не наивного `clamp(28 − days)`. **Библиотека `date-fns` НЕ установлена** (есть в CLAUDE.md, отсутствует в `package.json`) — её нужно добавить (`date-fns@4.4.0`, verdict OK). **`monthlyPayment` остаётся необязательным всегда** (SUMMARY + UI-SPEC: «Обяз. = нет») — «условность» из ITEM-04 касается только видимости поля в UI, а не требования валидации; это снимает необходимость в discriminated union. **Server Action — новый паттерн** для этого кодовой базы (Фаза 1 использовала `authClient`, не Server Actions); рекомендуется возвращать из action результат-объект и делать `router.push("/list")` на клиенте (переиспользует проверенный паттерн `RegisterForm`), а не `redirect()` внутри action.

**Primary recommendation:** Начать с TDD чистого движка подсчёта (`src/lib/scoring/` — юнит-тесты первыми, все шкалы + крайние случаи `deadlinePoints`), затем Zod-схема покупки (зеркалит `auth.test.ts`), затем миграция `items`, затем Server Action + форма, затем RSC-список с сортировкой по вычисленному `total`. Установить `date-fns@4` и shadcn-компоненты (`Select`, `Checkbox`, `Badge`, `Collapsible`, `Textarea`) до реализации.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `DoubtsType` — «Уверен(а)» (0, по умолчанию), «Сомневаюсь» (−1), «Сильно сомневаюсь» (−3). Очки зафиксированы roadmap (SCORE-04). Reversible.
- **D-02:** `BenefitType` — 5 пунктов ровно как в `SUMMARY.md`: «Экономит время/деньги/силы» +1, «Расходует время/деньги/силы» −1, «Никаких выгод» 0, «Приносит доход» +2, «Тратит больше, чем стоит» −2. Поле обязательное.
- **D-03:** `UrgencyType` «Жизненно важно» = **12 очков** (вершина шкалы, выше «экстра срочности» = 10). Остальные — по SUMMARY (экстра 10, очень срочно 4, срочно 3, не очень срочно 2, не срочно 1).
- **D-04:** `deadlinePoints` — без дедлайна = 0; иначе `clamp(28 − дни_до_дедлайна, −100, 100)`. Крайние случаи: дедлайн сегодня (0 дней) = +28; **любой просроченный дедлайн (дни < 0) = фиксированные +100** (не растущее по формуле). Reversible.
- **D-05:** `total` = простая сумма: `category + urgency + need + benefit + deadlinePoints + doubts − 2·isCredit`. Считается **на чтении** с внедряемой «текущей датой» (SCORE-01, SCORE-05); не «замораживается».
- **D-06:** Форма на **отдельной полноэкранной странице** (напр. `/list/new`). Reversible.
- **D-07:** **Все поля показываются сразу**; `monthlyPayment` появляется условно при `isCredit = true`.
- **D-08:** Вход — кнопка «Добавить» в `AppHeader.tsx` + кнопка в пустом состоянии списка. Reversible.
- **D-09:** После сохранения — **редирект на список**. Reversible.
- **D-10:** Badge = число `total` + цветовой уровень (высокий/средний/низкий); уровень кодируется не только цветом (текст/иконка). Пороги/палитра — UI-SPEC (`total ≥ 30` высокий, `10 ≤ total < 30` средний, `< 10` низкий).
- **D-11:** Разбивка очков (LIST-07) раскрывается по тапу (`Collapsible`), не постоянно.
- **D-12:** Список сразу отсортирован по убыванию `total`; стабильный tiebreaker в Фазе 2 — по `createdAt`.

### Claude's Discretion

- Форматы ввода `price` (валюта/десятичные) и `deadline` (date input / picker).
- Тайминг валидации (submit vs live) и точные тексты ошибок (единый тон, русский).
- Точный маршрут формы (`/list/new` или иной) при соблюдении D-06…D-09.
- Механика data flow (Server Action + `useOptimistic` / `useActionState`) согласно `.claude/CLAUDE.md`.
- Пороги уровней badge и палитра (делегировано UI-фазе — уже зафиксировано в UI-SPEC).

### Deferred Ideas (OUT OF SCOPE)

- Переключатели сортировки (по добавлению/алфавиту), фильтр «показывать купленные», отметка «куплено», архив, детерминированный tiebreaker — **Фаза 4**.
- Редактирование/удаление покупок с пересчётом — **Фаза 3**.
- Зависимости (`depends`) и блокировка — **Фаза 5**.
- Настраиваемые шкалы и взвешенная сумма — **v2** (CUST-01, CUST-02).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEM-01 | Добавить покупку через форму; `title` обязателен | Zod `itemInputSchema` (`title: z.string().min(1)`); форма `/list/new`; Server Action insert |
| ITEM-02 | Обязательные `category`/`urgency`/`need`/`benefit` из Select | `z.enum(...)` с сообщением «Выберите значение»; shadcn `Select` |
| ITEM-03 | Необязательные `link`/`description`/`price`/`deadline` | `optionalUrl`/`optionalNumber`/`optionalDate` хелперы (empty→undefined) |
| ITEM-04 | `isCredit` + условное `monthlyPayment` | `Checkbox` управляет видимостью; `monthlyPayment` всегда optional (см. Pitfall 6) |
| ITEM-05 | `doubts` (по умолчанию — нет сомнений) | `z.enum(...).default("sure")`; Select default «Уверен(а)» |
| SCORE-01 | `total` = простая сумма очковых полей | `computeTotal(item, now)` — чистая функция |
| SCORE-02 | `deadlinePoints = clamp(28 − days, −100, 100)`; без дедлайна = 0 | `deadlinePoints(deadline, now)` + спец-случай просрочки |
| SCORE-03 | `isCredit=true` вычитает 2 | Слагаемое `− 2·Number(isCredit)` |
| SCORE-04 | `doubts`: нет (0), лёгкие (−1), сильные (−3) | `DOUBTS_POINTS` map |
| SCORE-05 | `total` на чтении, отражает текущую дату | `now: Date` внедряется в RSC-списке; ничего не хранится в БД |
| SCORE-06 | Шкалы `category`/`urgency`/`need`/`benefit` фиксированы по SUMMARY | Константные `Record<Enum, number>` maps + юнит-тесты по каждому пункту |
| LIST-06 | Badge приоритета (метка/цвет, доступно) | `priorityLevel(total)` + `PRIORITY_THRESHOLDS`; shadcn `Badge` + lucide-иконка |
| LIST-07 | Разбивка приоритета по полям | `computeBreakdown(item, now)` → массив вкладов; `Collapsible` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Рендер формы + клиентская валидация | Frontend / Client | — | RHF + zodResolver в client-компоненте (`"use client"`), как `RegisterForm` |
| Серверная валидация входа | API / Backend (Server Action) | — | Never-trust-client: та же Zod-схема повторно на сервере (V5 ASVS) |
| Вычисление очков (`total`, breakdown, deadline) | API / Backend (RSC read) | — | Чистый модуль, вызывается при чтении списка (SCORE-05); детерминирован через `now` |
| Персистентность покупки | Database / Backend | API (Server Action) | `insert` через `items.ts` со scoping по `userId` (AUTH-04) |
| Сортировка по приоритету | API / Backend (RSC) | — | `total` вычислим только на чтении → сортировка в JS после fetch, НЕ `ORDER BY` в SQL (см. Pitfall 8) |
| Badge + разбивка (рендер) | Frontend Server (RSC) | Client (Collapsible-leaf) | Карточка/badge рендерятся RSC из вычисленных данных; раскрытие — client-leaf `Collapsible` |

## Standard Stack

Стек зафиксирован в `.claude/CLAUDE.md` — ниже только то, что реально затрагивает Фазу 2, с фактическими версиями из `package.json`.

### Core (уже установлено)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.12 | Server Actions + RSC для формы и списка | Зафиксировано `[CITED: .claude/CLAUDE.md]` |
| react | 19.2.4 | `useActionState`/`useOptimistic` доступны | Идёт с Next 16 `[VERIFIED: package.json]` |
| zod | 4.4.3 | Единая валидация формы + Server Action | Зафиксировано `[VERIFIED: package.json]` |
| react-hook-form | 7.83.0 | Состояние формы | `[VERIFIED: package.json]` |
| @hookform/resolvers | 5.5.5 | Мост Zod ↔ RHF (`zodResolver`, авто-детект Zod 4) | `[VERIFIED: package.json]` |
| drizzle-orm | 0.45.2 | Расширение таблицы `items`, insert | `[VERIFIED: package.json]` |
| drizzle-kit | 0.31.10 | Генерация/применение миграции | `[VERIFIED: package.json]` |
| postgres | 3.4.9 | Драйвер | `[VERIFIED: package.json]` |
| lucide-react | 1.27.0 | Иконки badge (`ArrowUp/Right/Down`, `Plus`) | `[VERIFIED: package.json]` |

### Supporting (ТРЕБУЕТ УСТАНОВКИ)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **date-fns** | **4.4.0** | `differenceInCalendarDays(deadline, now)` для `deadlinePoints` (timezone-safe целые дни) | **НЕ установлена** — добавить перед движком подсчёта `[VERIFIED: npm registry — verdict OK, 95M/нед, официальный repo]` |

**shadcn-компоненты для добавления (copy-in из официального реестра, НЕ npm-зависимости):** `Select`, `Checkbox`, `Badge`, `Collapsible`, `Textarea` — см. `02-UI-SPEC.md` §Инвентарь. Команды: `npx shadcn add select checkbox badge collapsible textarea`.

**НЕ требуется в Фазе 2:** `nuqs` (URL-состояние фильтров — Фаза 4), `@tanstack/react-query` (defer), `Dialog` (форма на отдельной странице, D-06).

### Installation
```bash
npm install date-fns@4
npx shadcn add select checkbox badge collapsible textarea
```

**Version verification:** `date-fns` — `npm view date-fns version` → `4.4.0` `[VERIFIED: npm registry 2026-08-01]`. Прочие пакеты уже в `package.json`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| date-fns | npm | опубл. 2026-05-29 | 95.5M/нед | github.com/date-fns/date-fns | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`date-fns` подтверждён через `gsd-tools query package-legitimacy check` (verdict OK, `postinstall: null`, не deprecated) И указан как канонический выбор в `.claude/CLAUDE.md` → тег `[VERIFIED: npm registry]`.

## Architecture Patterns

### System Architecture Diagram

```
[Пользователь: /list/new]
        │  (кнопка «Добавить» в AppHeader / пустом состоянии — D-08)
        ▼
[AddItemForm  (client "use client")]
        │  RHF + zodResolver(itemInputSchema)  ← клиентская валидация (тексты из UI-SPEC)
        │  submit → вызов Server Action с типизированным payload
        ▼
[createItem  (Server Action "use server")]
        │  1. requireUser() → userId ИЗ СЕССИИ (никогда из payload)   ← V4 Access Control
        │  2. itemInputSchema.safeParse(input)  ← ПОВТОРНАЯ серверная валидация (V5)
        │  3. createItemForUser(userId, data)
        ▼
[items.ts  (server-only repo)]
        │  db.insert(items).values({ ...data, userId })   ← scoping AUTH-04
        ▼
[PostgreSQL  items]   (deadlinePoints/total НЕ хранятся — SCORE-05)
        │
   action возвращает { ok: true }  →  client: router.push("/list"); router.refresh()
        ▼
[ListPage  (RSC)]
        │  1. getCurrentUser() → userId
        │  2. findItemsForUser(userId)  → строки покупок
        │  3. now = new Date()
        │  4. items.map → computeTotal(item, now) + computeBreakdown(item, now)
        │  5. sort desc by total, tiebreak createdAt (D-12)
        ▼
[ItemCard (RSC)]  →  Badge(priorityLevel(total))  +  Collapsible(breakdown)  ← client-leaf
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── scoring/
│   │   ├── scales.ts            # CATEGORY_POINTS / URGENCY_POINTS / NEED_POINTS /
│   │   │                        #   BENEFIT_POINTS / DOUBTS_POINTS (Record<Enum,number>)
│   │   ├── scoring.ts           # deadlinePoints / computeBreakdown / computeTotal /
│   │   │                        #   priorityLevel / PRIORITY_THRESHOLDS (чистые функции)
│   │   └── scoring.test.ts      # юнит-тесты ПЕРВЫМИ (TDD)
│   └── validation/
│       ├── item.ts              # itemInputSchema (единый источник) + type ItemInput
│       └── item.test.ts         # зеркалит auth.test.ts
├── server/
│   ├── db/schema.ts             # РАСШИРИТЬ таблицу items новыми колонками
│   └── repos/items.ts          # ДОБАВИТЬ createItemForUser(userId, data)
├── app/(app)/list/
│   ├── page.tsx                 # РАСШИРИТЬ: вычисление total + сортировка + карточки
│   └── new/
│       ├── page.tsx             # RSC-обёртка страницы формы (Новая покупка)
│       └── actions.ts           # "use server" createItem
├── components/
│   ├── items/
│   │   ├── AddItemForm.tsx      # "use client" — RHF + Select/Checkbox/Textarea
│   │   ├── AddItemForm.test.tsx # RTL
│   │   ├── ItemCard.tsx         # RSC карточка
│   │   ├── PriorityBadge.tsx    # badge (число + метка + иконка + цвет)
│   │   └── ScoreBreakdown.tsx   # "use client" Collapsible разбивка
│   └── app/AppHeader.tsx        # ДОБАВИТЬ кнопку «Добавить» (D-08)
└── e2e/
    └── add-item.spec.ts         # Playwright: add → redirect → badge → sort
```

### Pattern 1: Чистый движок подсчёта с внедряемой датой
**What:** Все очки — чистые функции; «сейчас» приходит параметром `now: Date`, никогда `new Date()` внутри.
**When to use:** Всегда — обеспечивает детерминированные юнит-тесты (SCORE-05) и вычисление на чтении.
```typescript
// src/lib/scoring/scoring.ts
// Источник шкал: SUMMARY.md + D-01..D-05. Источник формулы: SCORE-02 + D-04.
import { differenceInCalendarDays } from "date-fns";

export function deadlinePoints(deadline: Date | null, now: Date): number {
  if (!deadline) return 0;                                  // без дедлайна = 0 (D-04)
  const days = differenceInCalendarDays(deadline, now);     // целые календарные дни
  if (days < 0) return 100;                                 // ЛЮБАЯ просрочка = +100 (D-04)
  return clamp(28 - days, -100, 100);                       // сегодня(0)=+28; 40 дн=-12
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computeTotal(item: ScoredFields, now: Date): number {
  return (
    CATEGORY_POINTS[item.category] +
    URGENCY_POINTS[item.urgency] +
    NEED_POINTS[item.need] +
    BENEFIT_POINTS[item.benefit] +
    deadlinePoints(item.deadline, now) +
    DOUBTS_POINTS[item.doubts] -
    (item.isCredit ? 2 : 0)                                  // SCORE-03
  );
}
```

### Pattern 2: Единая Zod-схема покупки (клиент + сервер)
**What:** Одна схема в `src/lib/validation/item.ts`; `z.infer` даёт тип; клиент (RHF) и Server Action используют её же.
**When to use:** ITEM-01…05. Зеркалит существующий `auth.ts`.
```typescript
// src/lib/validation/item.ts
import { z } from "zod";

// Хелпер: пустая строка из необязательного числового Input → undefined,
// иначе coerce в число. Без этого z.coerce.number() превращает "" в 0 (Pitfall 5).
const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number({ message: "Введите число" })
    .nonnegative("Значение не может быть отрицательным")
    .optional()
);

export const itemInputSchema = z.object({
  title: z.string().min(1, "Заполните это поле"),
  category: z.enum(CATEGORY_VALUES, { message: "Выберите значение" }),
  urgency: z.enum(URGENCY_VALUES, { message: "Выберите значение" }),
  need: z.enum(NEED_VALUES, { message: "Выберите значение" }),
  benefit: z.enum(BENEFIT_VALUES, { message: "Выберите значение" }),
  link: z.preprocess((v) => (v === "" ? undefined : v),
    z.url("Введите корректную ссылку").optional()),
  description: z.string().optional(),
  price: optionalNumber,
  deadline: z.preprocess((v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional()),
  doubts: z.enum(DOUBTS_VALUES).default("sure"),           // ITEM-05 default
  isCredit: z.boolean().default(false),
  monthlyPayment: optionalNumber,                          // ВСЕГДА optional (Pitfall 6)
});

export type ItemInput = z.infer<typeof itemInputSchema>;
```

### Pattern 3: Server Action write-путь (возврат результата, НЕ redirect в action)
**What:** Action валидирует, берёт `userId` из сессии, пишет, возвращает `{ ok }`; навигацию делает клиент.
**When to use:** ITEM-01. Переиспользует проверенный паттерн `RegisterForm` (router.push + refresh) и избегает NEXT_REDIRECT-ловушек (Pitfall 7).
```typescript
// src/app/(app)/list/new/actions.ts
"use server";
import { requireUser } from "@/server/auth/current-user";
import { createItemForUser } from "@/server/repos/items";
import { itemInputSchema } from "@/lib/validation/item";

export async function createItem(
  input: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();                        // userId ТОЛЬКО из сессии
  const parsed = itemInputSchema.safeParse(input);         // never-trust-client (V5)
  if (!parsed.success) return { ok: false, error: "Проверьте поля формы." };
  try {
    await createItemForUser(user.id, parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить покупку. Попробуйте ещё раз." };
  }
}
```
```typescript
// src/server/repos/items.ts — ДОБАВИТЬ
export async function createItemForUser(userId: string, data: ItemInsertData) {
  const [row] = await db.insert(items).values({ ...data, userId }).returning();
  return row;
}
```
Клиент (`AddItemForm`, зеркалит `RegisterForm`): `const res = await createItem(values); if (!res.ok) setFormError(res.error); else { router.push("/list"); router.refresh(); }`. Pending — `form.formState.isSubmitting` (уже установленный паттерн).

### Pattern 4: Сортировка по вычисленному приоритету в RSC
```typescript
// src/app/(app)/list/page.tsx — расширение
const rows = await findItemsForUser(user.id);
const now = new Date();
const scored = rows
  .map((item) => ({ item, total: computeTotal(item, now) }))
  .sort((a, b) => b.total - a.total ||
    b.item.createdAt.getTime() - a.item.createdAt.getTime()); // tiebreak createdAt (D-12)
```

### Anti-Patterns to Avoid
- **`new Date()` внутри движка подсчёта:** ломает детерминизм тестов и SCORE-05. Всегда параметр `now`.
- **Хранение `total`/`deadlinePoints` в БД:** нарушает SCORE-05 (значение устаревает со временем). Не добавлять эти колонки.
- **`ORDER BY total` в SQL:** невозможно — `total` вычислим только на чтении с текущей датой. Сортировать в JS.
- **`userId` из тела формы/payload:** только из серверной сессии (`requireUser`). Mass-assignment угроза.
- **`z.coerce.number()` без preprocess для необязательных полей:** `""` → `0`, ложное значение.
- **Наивный `clamp(28 − days)` для просрочки:** даст растущее/обрезанное значение вместо фиксированных +100 (D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Целые дни до дедлайна | Ручной `(a - b)/86400000` | `differenceInCalendarDays` (date-fns) | Ручной расчёт ломается на DST и границах суток; date-fns считает КАЛЕНДАРНЫЕ дни (дедлайн сегодня = 0) |
| Валидация формы | Ручные `if`-проверки в onSubmit | `itemInputSchema` (Zod) | Один источник для клиента+сервера, авто-типы, тексты ошибок |
| Форм-состояние/ошибки полей | Ручной `useState` на поле | RHF `FormField`/`FormMessage` | Установленный паттерн (`RegisterForm`); a11y-связка label↔error |
| Select/Checkbox/Collapsible | Нативные + ручная a11y | shadcn (Radix) | Клавиатура, ARIA, фокус-менеджмент из коробки |
| Парсинг даты из `type="date"` | `new Date("YYYY-MM-DD")` | Drizzle `date({ mode: "date" })` + date-fns | Строковый конструктор парсит как UTC → сдвиг дня в отрицательных TZ (Pitfall 4) |

**Key insight:** Единственная «своя» логика фазы — арифметика очков (шкалы + сумма), и именно она должна быть чистой и покрытой юнит-тестами первой. Всё остальное (даты, валидация, формы, UI-примитивы) — готовые библиотеки.

## Runtime State Inventory

> Greenfield-расширение внутри активного проекта; миграция затрагивает только структуру таблицы. Инвентарь для полноты.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Таблица `items` содержит только `id/userId/title/createdAt` (Фаза 1 не пишет строк — D-06). Новые колонки nullable/с дефолтами → существующие строки (если есть) не ломаются | Миграция `drizzle-kit generate` + `migrate` |
| Live service config | None — внешних сервисов с состоянием нет (self-hosted Postgres) | None |
| OS-registered state | None | None |
| Secrets/env vars | `DATABASE_URL` / `DATABASE_URL_TEST` в `.env.local` (не в git) — имена не меняются | None |
| Build artifacts | `./drizzle/` — новая SQL-миграция добавится (коммитится в git); `seedItem` в `tests/helpers/db.ts` придётся расширить под новые NOT NULL колонки | Обновить `seedItem`, закоммитить миграцию |

**Важно:** Better Auth CLI (`@better-auth/cli generate`) регенерирует `schema.ts` и может затереть таблицу `items` — она помечена комментарием «не редактируется CLI / должна сохраняться при регенерации» (schema.ts, стр. 109-114). При любой будущей регенерации auth-схемы проверить, что расширенная таблица `items` и `items_user_id_idx` сохранены.

## Common Pitfalls

### Pitfall 1: Просрочка ≠ наивная формула
**What goes wrong:** `clamp(28 − days, −100, 100)` при `days = −10` даёт `+38`, при `days = −80` → `+108` → clamp `+100`. Разные просрочки дают разные очки, а D-04 требует ФИКСИРОВАННЫХ +100 для любой просрочки.
**Why:** SCORE-02 формула не учитывает решение D-04.
**How to avoid:** Спец-случай `if (days < 0) return 100;` ДО clamp. Тест-кейсы: `−1 день → 100`, `−80 дней → 100`.
**Warning signs:** Тест на «вчерашний дедлайн» ожидает ≠ 100.

### Pitfall 2: Граничные случаи `deadlinePoints`
**What goes wrong:** Путаница «дней до дедлайна» на границе суток.
**How to avoid:** Табличные тесты с фиксированным `now`: `null→0`, `сегодня(0дн)→+28`, `1дн→+27`, `28дн→0`, `40дн→−12`, `128дн→−100 (clamp)`, `−1дн→+100`.

### Pitfall 3: `now` внутри чистой функции
**What goes wrong:** `new Date()` в движке → флейки-тесты, зависящие от системного времени; нарушение SCORE-05.
**How to avoid:** `now: Date` — обязательный параметр каждой функции с датой. В RSC-списке `now` создаётся один раз и прокидывается.

### Pitfall 4: TZ-сдвиг при парсинге `type="date"`
**What goes wrong:** `new Date("2026-08-05")` = UTC-полночь; в TZ с отрицательным смещением → 4 августа локально → `deadlinePoints` ошибается на день.
**Why:** ISO date-only строки парсятся как UTC.
**How to avoid:** Хранить колонку как Drizzle `date("deadline", { mode: "date" })` (без времени/TZ) и сравнивать через `differenceInCalendarDays`. В тестах создавать даты через `new Date(2026, 7, 5)` (локальные), не из строк.

### Pitfall 5: `z.coerce.number()` превращает `""` в `0`
**What goes wrong:** Пустое необязательное поле `price`/`monthlyPayment` сохраняется как `0`, а не «не указано».
**How to avoid:** `z.preprocess((v) => v === "" ? undefined : v, z.coerce.number()...optional())` (см. `optionalNumber`).

### Pitfall 6: `monthlyPayment` — условная ВИДИМОСТЬ, не условная обязательность
**What goes wrong:** Планировщик может смоделировать discriminated union «monthlyPayment required when isCredit», но SUMMARY (стр. 31) и UI-SPEC (labels: «Обяз. = нет») говорят: поле ВСЕГДА необязательное; при `isCredit=false` оно лишь скрыто. Discriminated union здесь избыточен и усложняет RHF.
**How to avoid:** `monthlyPayment` — просто `optional` в схеме. Условность — UI (`isCredit` управляет рендером поля, ITEM-04). При снятии `isCredit` рекомендуется очистить значение (`form.setValue("monthlyPayment", undefined)`), чтобы скрытое поле не отправляло старое число.

### Pitfall 7: `redirect()` внутри Server Action бросает NEXT_REDIRECT
**What goes wrong:** `redirect("/list")` работает через throw специального исключения; обёртка `try/catch` вокруг всего action его проглотит, и навигация не произойдёт.
**How to avoid:** Рекомендуемый паттерн — action возвращает `{ ok }`, клиент делает `router.push("/list")` (зеркалит `RegisterForm`, D-09). Если всё же `redirect()` — вызывать его ВНЕ `try/catch`, после успешного insert.

### Pitfall 8: Сортировка приоритета не через SQL
**What goes wrong:** Попытка `ORDER BY total` — колонки `total` нет (не хранится). `ORDER BY` по «дню дедлайна» тоже невозможен.
**How to avoid:** Fetch всех строк пользователя → `computeTotal` в JS → `sort`. Список у пользователя мал; приемлемо. Индекс `items_user_id_idx` обеспечивает быстрый scoped-fetch.

### Pitfall 9: Radix Select/Collapsible в jsdom (RTL)
**What goes wrong:** Radix `Select` использует Pointer Capture / `scrollIntoView` / `ResizeObserver`, которых нет в jsdom → падения `userEvent` при открытии дропдауна.
**How to avoid:** Добавить шимы в `vitest.setup.ts`: `Element.prototype.hasPointerCapture`, `scrollIntoView`, `ResizeObserver`. Часто проще тестировать выбор через RHF `setValue` или проверять наличие опций, а полный клик-flow дропдауна оставить Playwright.

### Pitfall 10: Drizzle `numeric` возвращает string
**What goes wrong:** `numeric` колонки читаются как `string` из postgres.js → `price`/`monthlyPayment` придут строкой.
**How to avoid:** `price`/`monthlyPayment` не влияют на очки (display-only). Варианты: `integer` в копейках/центах (без float-ошибок) — рекомендуется, либо `numeric(...).$type<number>()` с явным приведением при чтении/записи. Решение — на усмотрение планировщика.

## Code Examples

### Шкалы как константные maps (SCORE-06, SUMMARY + D-01..D-03)
```typescript
// src/lib/scoring/scales.ts — источник истины продублирован из SUMMARY.md
export const URGENCY_POINTS = {
  vital: 12,       // «Жизненно важно» (D-03 — вершина шкалы)
  extra: 10,       // «Экстра срочность»
  veryUrgent: 4, urgent: 3, notVeryUrgent: 2, notUrgent: 1,
} as const;
export const DOUBTS_POINTS = { sure: 0, doubt: -1, strongDoubt: -3 } as const; // D-01
export const BENEFIT_POINTS = {                                                 // D-02
  savesResources: 1, spendsResources: -1, noBenefit: 0, income: 2, overpriced: -2,
} as const;
// CATEGORY_POINTS / NEED_POINTS — аналогично из SUMMARY.md (13 категорий / 3 need)
```

### Порог уровня badge (D-10 / UI-SPEC)
```typescript
export const PRIORITY_THRESHOLDS = { high: 30, medium: 10 } as const;
export function priorityLevel(total: number): "high" | "medium" | "low" {
  if (total >= PRIORITY_THRESHOLDS.high) return "high";
  if (total >= PRIORITY_THRESHOLDS.medium) return "medium";
  return "low";
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.enum(x, { invalid_type_error })` | Zod v4 `z.enum(x, { message })` / `{ error }` | Zod 4 (2025) | Использовать `{ message: "..." }`; позиционный string тоже работает (как в `auth.ts`) |
| `pages/` API routes для write | Server Actions (`"use server"`) | Next 13→16 | CRUD без отдельного API-слоя; первый Server Action в этом проекте |
| Ручной form-state | RHF + `useActionState`/`isSubmitting` | React 19 | Проект использует `isSubmitting` (проще, установленный паттерн) |

**Deprecated/outdated:**
- `redirect()` внутри `try/catch` в Server Action — антипаттерн (проглатывает NEXT_REDIRECT). См. Pitfall 7.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `monthlyPayment` всегда optional (условна лишь видимость) | Pitfall 6 / Pattern 2 | LOW — прямо подтверждено SUMMARY стр.31 + UI-SPEC labels; но research_focus формулировал как «required when isCredit» — при ином намерении нужен superRefine |
| A2 | Рекомендация «return-result из action + router.push» вместо `redirect()` | Pattern 3 | LOW — обе валидны; D-09 требует лишь «редирект на список», механика — Claude's Discretion |
| A3 | `price`/`monthlyPayment` хранить как `integer` (копейки) | Pitfall 10 | LOW — display-only, на очки не влияет; формат — Claude's Discretion |
| A4 | Radix Select клик-flow лучше покрывать Playwright, а не RTL | Pitfall 9 / Validation | MEDIUM — зависит от jsdom-шимов; если шимы добавлены, RTL справится |
| A5 | Английские идентификаторы enum-значений (`vital`, `savesResources`, …) | Code Examples | LOW — русские тексты в UI приходят из label-мапы; ключи — на усмотрение планировщика |

## Open Questions

1. **Ключи enum vs отображаемые русские тексты**
   - Что знаем: UI-тексты пунктов — русские, из SUMMARY/D-01..D-03 (единый источник).
   - Что неясно: хранить ли в БД английские ключи (`vital`) или русские строки.
   - Рекомендация: английские ключи в схеме/БД + отдельная label-мапа `ключ → русский текст` для Select и разбивки (устойчивее к переименованию текстов, реверсивно).

2. **`price` формат хранения (integer-копейки vs numeric)**
   - Что знаем: display-only, на очки не влияет; ввод `inputMode="decimal"`.
   - Рекомендация: `integer` в копейках (без float-погрешностей) — но это Claude's Discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (dev + test) | Insert, integration-тесты изоляции | ✓ | Postgres 18 @ D:\Programs\pg (`shopping_list`, `shopping_list_test`) | — |
| Node.js | Runtime, drizzle-kit, Vitest | ✓ | 20.9+/22 LTS (Next 16 baseline) | — |
| date-fns | `deadlinePoints` | ✗ | — (установить 4.4.0) | Нет разумного fallback — установить |
| shadcn Select/Checkbox/Badge/Collapsible/Textarea | Форма, badge, разбивка | ✗ | — (`npx shadcn add ...`) | Нативные контролы (хуже a11y) — не рекомендуется |

**Missing dependencies with no fallback:** `date-fns` (блокирует движок) — установить первым шагом.
**Missing dependencies with fallback:** shadcn-компоненты (fallback — нативные, но UI-SPEC требует shadcn).

## Validation Architecture

> `workflow.nyquist_validation: true` → раздел включён.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + React Testing Library 16.3.2 + Playwright 1.62.0 |
| Config file | `vitest.config.ts` (jsdom, globals, alias `@/*`, setup: `vitest-db-setup.ts` + `vitest.setup.ts`); `playwright.config.ts` (порт 3100, тестовая БД) |
| Quick run command | `npx vitest run src/lib/scoring src/lib/validation` |
| Full suite command | `npx vitest run && npx playwright test` |

**Wave 0 gap:** в `package.json` НЕТ `test`-скриптов (только `dev/build/start/lint`) — добавить `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | `total` = сумма слагаемых | unit | `npx vitest run src/lib/scoring/scoring.test.ts` | ❌ Wave 0 |
| SCORE-02 | `deadlinePoints` формула + без дедлайна=0 | unit | ↑ (табличные кейсы) | ❌ Wave 0 |
| SCORE-02/D-04 | просрочка = фикс +100; сегодня=+28; 128дн=−100 | unit | ↑ (крайние случаи) | ❌ Wave 0 |
| SCORE-03 | `isCredit` −2 | unit | ↑ | ❌ Wave 0 |
| SCORE-04 | doubts 0/−1/−3 | unit | ↑ | ❌ Wave 0 |
| SCORE-06 | шкалы по SUMMARY (каждый пункт) | unit | ↑ | ❌ Wave 0 |
| LIST-06 | `priorityLevel` пороги (29→low? нет; 30→high; 10→medium) | unit | ↑ | ❌ Wave 0 |
| SCORE-05 | детерминизм через `now` | unit | ↑ (fixed now) | ❌ Wave 0 |
| ITEM-01/02/05 | обязательные поля + тексты ошибок | unit | `npx vitest run src/lib/validation/item.test.ts` | ❌ Wave 0 |
| ITEM-03 | optional coercion (empty→undefined, url, negative) | unit | ↑ | ❌ Wave 0 |
| ITEM-01/AUTH-04 | `createItemForUser` пишет со scoping; изоляция | integration (node + real test DB) | `npx vitest run src/server/repos/items.iso.test.ts` | ⚠ расширить (мокать нельзя — реальная БД) |
| ITEM-02/04 | форма: Select-ы, условный `monthlyPayment`, pending | component (RTL) | `npx vitest run src/components/items/AddItemForm.test.tsx` | ❌ Wave 0 |
| LIST-07 | разбивка раскрывается (Collapsible) | component (RTL) | ↑ ScoreBreakdown | ❌ Wave 0 |
| ITEM-01/D-09/D-12/LIST-06 | add→redirect→badge→сортировка | e2e (Playwright) | `npx playwright test e2e/add-item.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <затронутый модуль>` (движок/схема < 30с).
- **Per wave merge:** `npx vitest run` (весь unit+RTL+integration).
- **Phase gate:** `npx vitest run && npx playwright test` — зелёные до `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `package.json` — добавить `test` / `test:watch` / `test:e2e` скрипты
- [ ] `npm install date-fns@4`
- [ ] `npx shadcn add select checkbox badge collapsible textarea`
- [ ] `src/lib/scoring/scoring.test.ts` + `scales.ts`/`scoring.ts` — покрывают SCORE-01..06, LIST-06
- [ ] `src/lib/validation/item.test.ts` — покрывает ITEM-01..05 (зеркало `auth.test.ts`)
- [ ] Расширить `tests/helpers/db.ts` `seedItem` под новые NOT NULL/defaulted колонки
- [ ] `vitest.setup.ts` — шимы `hasPointerCapture`/`scrollIntoView`/`ResizeObserver` для Radix Select в RTL
- [ ] `src/components/items/AddItemForm.test.tsx`, e2e `add-item.spec.ts`

## Security Domain

> `security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Готово в Фазе 1 (Better Auth); Фаза 2 лишь читает сессию |
| V3 Session Management | no | Better Auth DB-сессии (Фаза 1) |
| V4 Access Control | **yes** | `userId` из `requireUser()` (серверная сессия), insert scoped через `items.ts`; тест изоляции на запись (IDOR/mass-assignment) |
| V5 Input Validation | **yes** | `itemInputSchema` ПОВТОРНО на сервере в Server Action (never-trust-client); enum whitelisting, `nonnegative`, `z.url` |
| V6 Cryptography | no | Нет новой крипты в фазе |

### Known Threat Patterns for Next 16 Server Action + Postgres

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass-assignment / over-posting (клиент шлёт `userId`/`total`/`id`) | Tampering / Elevation | `userId` только из сессии; вставлять только валидированные `parsed.data`-поля; `total`/`deadlinePoints` вычислять на сервере, не принимать |
| IDOR при записи в чужой список | Elevation of Privilege | Insert всегда с `userId` из `requireUser()`; интеграционный тест изоляции на write (расширить `items.iso.test.ts`) |
| Незалогиненный вызов Server Action | Spoofing | `requireUser()` бросает при отсутствии сессии — до любой записи |
| SQL-инъекция через поля | Tampering | Drizzle параметризует запросы; строки не конкатенируются |
| XSS через `title`/`description`/`link` | Tampering | React экранирует по умолчанию; `link` валидируется `z.url`; не использовать `dangerouslySetInnerHTML`; для `link` в `href` — только http/https |
| Отрицательные/мусорные числа в `price`/`monthlyPayment` | Tampering | Zod `nonnegative` + coercion; серверная ре-валидация |

## Sources

### Primary (HIGH confidence)
- `.claude/CLAUDE.md` — зафиксированный стек и решения (ORM/Auth/Data-flow/Testing) — прочитан
- `SUMMARY.md` — item schema + шкалы `Category/Urgency/Need/Benefit`, формула `deadlinePoints` — прочитан
- `.planning/phases/02-add-item-scoring/02-CONTEXT.md` — D-01..D-12 — прочитан
- `.planning/phases/02-add-item-scoring/02-UI-SPEC.md` — контракт формы/badge/разбивки, инвентарь shadcn — прочитан
- `.planning/REQUIREMENTS.md` — ITEM-01..05, SCORE-01..06, LIST-06/07 — прочитан
- Кодовая база: `schema.ts`, `items.ts`, `current-user.ts`, `auth.ts`/`auth.test.ts`, `RegisterForm.tsx`/`.test.tsx`, `items.iso.test.ts`, `vitest.config.ts`, `drizzle.config.ts`, `playwright.config.ts`, `tests/helpers/db.ts` — прочитаны
- npm registry (`date-fns` version 4.4.0) + `gsd-tools package-legitimacy check` (verdict OK) — выполнено

### Secondary (MEDIUM confidence)
- Zod v4 enum/coerce API-нюансы (`{ message }`, `z.coerce.number()` пустая строка) — training knowledge, сверено с существующим `auth.ts`
- Radix Select + jsdom шимы для RTL — training knowledge (широко известный паттерн)

### Tertiary (LOW confidence)
- Точные ключи enum-значений (`vital`/`savesResources`/…) — предложение, финализирует планировщик

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — зафиксирован в CLAUDE.md + сверен с `package.json`
- Architecture: HIGH — прямое чтение существующих Фаза-1 паттернов (repo, RSC, RHF-форма)
- Pitfalls: HIGH — выведены из фактических решений (D-04), кода и известных Zod/Radix/Drizzle-нюансов
- Scoring: HIGH — шкалы и формула однозначны в SUMMARY + D-01..D-05

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (стабильный стек; пере-проверить `date-fns`/shadcn при задержке > 30 дней)
