# Phase 2: Добавление покупок с автоматическим приоритетом — Карта паттернов

**Составлено:** 2026-08-01
**Проанализировано файлов (новых/изменяемых):** 15
**Найдено аналогов:** 12 / 15 (3 без прямого аналога — чистый движок подсчёта: новый вид модуля)

Эта карта отвечает планировщику на вопрос «какой существующий код копировать» для каждого нового/изменяемого файла Фазы 2. Все выдержки кода реальны (с путями и номерами строк). Проза — на русском, идентификаторы/пути/библиотеки — на английском (`.claude/CLAUDE.md`).

---

## Классификация файлов

| Новый/изменяемый файл | Роль | Data Flow | Ближайший аналог | Качество совпадения |
|-----------------------|------|-----------|------------------|---------------------|
| `src/lib/scoring/scales.ts` | utility (константы) | transform (pure) | — (нет: первый scoring-модуль) | no-analog |
| `src/lib/scoring/scoring.ts` | utility (pure functions) | transform (pure) | стиль `src/lib/validation/auth.ts` (чистый модуль) | style-match |
| `src/lib/scoring/scoring.test.ts` | test (unit) | — | `src/lib/validation/auth.test.ts` | exact |
| `src/lib/validation/item.ts` | model (Zod schema) | transform (validate) | `src/lib/validation/auth.ts` | exact |
| `src/lib/validation/item.test.ts` | test (unit) | — | `src/lib/validation/auth.test.ts` | exact |
| `src/server/db/schema.ts` (изменение) | model (Drizzle table) | — | `items` в том же файле (стр. 115-134) | exact |
| `src/server/repos/items.ts` (изменение) | repository | CRUD (write) | `findItemsForUser` в том же файле | exact (role+flow) |
| `src/server/repos/items.iso.test.ts` (расширение) | test (integration) | CRUD | тот же файл (read-изоляция) | exact |
| `src/app/(app)/list/new/actions.ts` | Server Action | request-response (write) | `RegisterForm.onSubmit` (write-путь) | role-match (первый Server Action) |
| `src/app/(app)/list/new/page.tsx` | route (RSC-обёртка) | — | `src/app/(app)/list/page.tsx` | role-match |
| `src/components/items/AddItemForm.tsx` | component (client form) | request-response | `src/components/auth/RegisterForm.tsx` | exact |
| `src/components/items/AddItemForm.test.tsx` | test (component/RTL) | — | `src/components/auth/RegisterForm.test.tsx` | exact |
| `src/components/items/ItemCard.tsx` | component (RSC) | — | empty-state в `list/page.tsx` + `AppHeader.tsx` (RSC-презентация) | partial |
| `src/components/items/PriorityBadge.tsx` | component (RSC-leaf) | — | нет прямого (shadcn `Badge` + lucide) | no-analog |
| `src/components/items/ScoreBreakdown.tsx` | component (client-leaf) | — | client-leaf `LogoutButton.tsx` (только `"use client"`-паттерн) | partial |
| `src/components/app/AppHeader.tsx` (изменение) | component (RSC) | — | тот же файл | exact |
| `tests/helpers/db.ts` (расширение `seedItem`) | test helper | CRUD | тот же файл `seedItem` (стр. 55-68) | exact |

---

## Назначения паттернов

### `src/lib/validation/item.ts` (model, Zod schema)

**Аналог:** `src/lib/validation/auth.ts` (весь файл, 20 строк) — единый Zod-контракт «клиент + сервер», тип через `z.infer`, русские тексты ошибок.

**Паттерн импорта и структуры схемы** (`auth.ts:1-19`):
```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

**Что копировать:** структуру «одна `z.object` + экспорт типа через `z.infer`»; позиционный string-аргумент для текста ошибки (Zod v4, как в `auth.ts`). Тексты ошибок — из `02-UI-SPEC.md` §Copywriting Contract («Заполните это поле», «Выберите значение», «Введите корректную ссылку», «Введите число», «Значение не может быть отрицательным»). Хелперы `optionalNumber`/`optionalUrl`/`optionalDate` (`z.preprocess(...)`) — из `02-RESEARCH.md` Pattern 2 (Pitfall 5 — пустая строка не должна становиться `0`). `monthlyPayment` — всегда `.optional()` (Pitfall 6, НЕ discriminated union).

---

### `src/lib/validation/item.test.ts` (test, unit)

**Аналог:** `src/lib/validation/auth.test.ts` (весь файл, 54 строки).

**Хелпер извлечения сообщения по полю** (`auth.test.ts:5-11`):
```typescript
function messageFor(
  result: ReturnType<typeof registerSchema.safeParse>,
  field: string
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}
```

**Структура кейса** (`auth.test.ts:13-38`): `describe(schemaName)` → `it("отклоняет ...")` c `safeParse` + `expect(result.success).toBe(false)` + `expect(messageFor(...)).toBe("<точный русский текст>")`, и `it("принимает ...")` для валидного входа. Копировать один-в-один; добавить кейсы для ITEM-01…05 (обязательные поля, enum, `optionalNumber` empty→undefined, url, negative).

---

### `src/lib/scoring/scoring.ts` + `scales.ts` (utility, pure functions) — НЕТ прямого аналога

Первый чистый вычислительный модуль в проекте. Прямого файла-аналога нет; копировать **стиль** чистого модуля (`auth.ts` — только экспорты, без сайд-эффектов) и следовать `02-RESEARCH.md` Pattern 1 + Code Examples (готовые сигнатуры `deadlinePoints`/`computeTotal`/`priorityLevel`, константы `URGENCY_POINTS`/`DOUBTS_POINTS`/`BENEFIT_POINTS`, `PRIORITY_THRESHOLDS`).

**Ключевые инварианты (из CONTEXT D-01…D-05, RESEARCH Pitfalls 1-3):**
- `now: Date` — обязательный параметр каждой функции с датой (никогда `new Date()` внутри).
- Спец-случай просрочки: `if (days < 0) return 100;` ДО `clamp` (D-04).
- `total` не хранится в БД (SCORE-05) — вычисляется на чтении.
- Шкалы — `Record<Enum, number>` из `SUMMARY.md` + D-03 (`vital: 12`).

**Аналог теста:** `src/lib/validation/auth.test.ts` (`describe`/`it`/`expect` — тот же Vitest-стиль). Табличные кейсы `deadlinePoints` из RESEARCH Pitfall 2: `null→0`, `сегодня(0)→+28`, `1дн→+27`, `28дн→0`, `40дн→−12`, `128дн→−100`, `−1дн→+100`. Даты в тестах — через `new Date(2026, 7, 5)` (локальные), не из строк (Pitfall 4).

---

### `src/server/db/schema.ts` (model, изменение — расширение таблицы `items`)

**Аналог:** существующее определение `items` в том же файле (`schema.ts:115-134`).

**Текущая таблица** (`schema.ts:115-130`):
```typescript
export const items = pgTable(
  "items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("items_user_id_idx").on(table.userId)]
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
```

**Что копировать/соблюсти:**
- Сохранить `id`/`userId`/`title`/`createdAt` и индекс `items_user_id_idx` (CONTEXT canonical_refs).
- Новые колонки — nullable или с `.default()` (RESEARCH Runtime State: не ломать существующие строки).
- НЕ добавлять колонки `total`/`deadlinePoints` (SCORE-05, Anti-Pattern).
- Импорты `date`/`integer` из `drizzle-orm/pg-core` (`deadline` как `date(..., { mode: "date" })` — Pitfall 4; `price`/`monthlyPayment` как `integer` в копейках — Pitfall 10 / A3, на усмотрение планировщика).
- Enum-поля (`category`/`urgency`/`need`/`benefit`/`doubts`) — `text(...).notNull()` (или `.$type<...>()`); реестр английских ключей — из scoring/validation модулей.
- Таблица помечена комментарием «не редактируется CLI» (`schema.ts:109`) — при регенерации Better Auth сохранять (Pitfall 8).
- После изменения — `drizzle-kit generate` + `migrate`, коммит SQL-миграции.

---

### `src/server/repos/items.ts` (repository, изменение — добавить `createItemForUser`)

**Аналог:** `findItemsForUser` в том же файле (`items.ts:1-14`).

**Существующий read-шов** (`items.ts:1-14`):
```typescript
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";

export async function findItemsForUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}
```

**Что копировать:** директиву `import "server-only"`; сигнатуру, где `userId: string` — первый обязательный параметр (изоляцию нельзя забыть, комментарий `items.ts:8-11`). Новая функция (RESEARCH Pattern 3):
```typescript
export async function createItemForUser(userId: string, data: ItemInsertData) {
  const [row] = await db.insert(items).values({ ...data, userId }).returning();
  return row;
}
```
`userId` подмешивается в `.values()` на сервере (никогда из payload — mass-assignment, Security V4).

---

### `src/server/repos/items.iso.test.ts` (test, integration — расширить write-изоляцией)

**Аналог:** тот же файл (`items.iso.test.ts:1-32`) — read-изоляция.

**Паттерн** (`items.iso.test.ts:1-18`): директива `// @vitest-environment node`; реальная тестовая БД (не мок ORM — комментарий стр. 9-10); `beforeEach(resetDb)` + `afterAll(closeTestDb)`; хелперы `seedUser`/`seedItem` из `tests/helpers/db.ts`. Добавить кейс: пользователь A создаёт покупку через `createItemForUser(a.id, ...)`, пользователь B её не видит (IDOR/mass-assignment на запись, Security V4).

---

### `src/app/(app)/list/new/actions.ts` (Server Action) — первый в проекте

**Аналог:** write-путь `RegisterForm.onSubmit` (`RegisterForm.tsx:42-61`) для формы результатов + `current-user.ts` для источника userId. Фаза 1 использовала `authClient`, не Server Actions — паттерн новый; следовать `02-RESEARCH.md` Pattern 3.

**Источник userId** (`current-user.ts:15-21`):
```typescript
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
```

**Целевая форма action** (RESEARCH Pattern 3): `"use server"` → `requireUser()` (userId только из сессии) → `itemInputSchema.safeParse(input)` (повторная серверная валидация, never-trust-client V5) → `createItemForUser` → возвращает `{ ok: true } | { ok: false; error }`. НЕ вызывать `redirect()` внутри `try/catch` (Pitfall 7) — навигацию делает клиент. Текст ошибки сохранения — «Не удалось сохранить покупку. Попробуйте ещё раз.» (UI-SPEC).

---

### `src/components/items/AddItemForm.tsx` (component, client form)

**Аналог:** `src/components/auth/RegisterForm.tsx` (весь файл, 133 строки) — ближайший и точный аналог.

**Импорты и каркас** (`RegisterForm.tsx:1-38`):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
// ... Button, Input, Alert, Form/FormControl/FormField/FormItem/FormLabel/FormMessage

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const isPending = form.formState.isSubmitting;
```

**Submit + навигация** (`RegisterForm.tsx:42-61`):
```typescript
async function onSubmit(values: RegisterInput) {
  setFormError(null);
  const { error } = await authClient.signUp.email({ ... });
  if (error) { setFormError(mapAuthError(error, "register")); return; }
  router.push("/list");
  router.refresh();
}
```
Для `AddItemForm`: заменить вызов `authClient` на `createItem(values)`; при `!res.ok` → `setFormError(res.error)`, иначе `router.push("/list"); router.refresh()` (D-09).

**Поле формы (FormField pattern)** (`RegisterForm.tsx:76-95`):
```typescript
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input className="h-11 text-base" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Форм-левел ошибка (Alert)** (`RegisterForm.tsx:70-74`) и **pending-кнопка** (`RegisterForm.tsx:116-123`, спиннер `Loader2` + `disabled={isPending}`) — копировать.

**Отличия для AddItemForm (из UI-SPEC/RESEARCH):**
- shadcn `Select` для `category`/`urgency`/`need`/`benefit`/`doubts` (обернуть в `FormField` с `field.value`/`field.onChange`).
- `Checkbox` для `isCredit`; `monthlyPayment` рендерится условно при `isCredit=true` (при снятии — `form.setValue("monthlyPayment", undefined)`, Pitfall 6).
- `Textarea` для `description`; `Input type="date"` для `deadline`; `inputMode="decimal"` для `price`/`monthlyPayment`.
- Порядок полей и лейблы — из UI-SPEC §Подписи полей; CTA «Добавить покупку» + «Отмена».
- `min-height 44px` тач-цели (UI-SPEC), `text-base` (16px, анти-zoom iOS).

---

### `src/components/items/AddItemForm.test.tsx` (test, component/RTL)

**Аналог:** `src/components/auth/RegisterForm.test.tsx` (весь файл, 107 строк).

**Моки роутера** (`RegisterForm.test.tsx:8-12`):
```typescript
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
```

**Мок серверной зависимости** (`RegisterForm.test.tsx:29-32`) — здесь мокать `createItem` (Server Action) вместо `authClient`.

**Кейсы для копирования** (`RegisterForm.test.tsx:43-106`): рендер лейблов/кнопки; ошибка валидации + `expect(action).not.toHaveBeenCalled()`; pending — `waitFor(() => expect(button).toBeDisabled())` + вызов ровно 1 раз; успех → `expect(push).toHaveBeenCalledWith("/list")`.

**Важно (Pitfall 9):** Radix `Select`/`Collapsible` требуют шимов в `vitest.setup.ts` (`hasPointerCapture`, `scrollIntoView`, `ResizeObserver`); полный клик-flow дропдауна лучше в Playwright, в RTL — `setValue` или проверка наличия опций.

---

### `src/app/(app)/list/new/page.tsx` (route, RSC-обёртка)

**Аналог:** `src/app/(app)/list/page.tsx` (`list/page.tsx:1-27`) — RSC, `getCurrentUser()` + `redirect("/login")` при отсутствии сессии.

**Паттерн защиты** (`list/page.tsx:11-15`):
```typescript
export default async function ListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
```
Страница формы — RSC-обёртка (заголовок «Новая покупка» из UI-SPEC), рендерит client-leaf `<AddItemForm />`.

---

### `src/app/(app)/list/page.tsx` (изменение — сортировка + карточки)

**Аналог:** тот же файл (`list/page.tsx:11-38`).

**Существующий каркас** (`list/page.tsx:11-27`): `getCurrentUser` → `redirect` → `findItemsForUser(user.id)` → empty-state (heading «Список пуст» + body + кнопка «Добавить покупку» из UI-SPEC).

**Расширение** (RESEARCH Pattern 4):
```typescript
const rows = await findItemsForUser(user.id);
const now = new Date();
const scored = rows
  .map((item) => ({ item, total: computeTotal(item, now) }))
  .sort((a, b) => b.total - a.total ||
    b.item.createdAt.getTime() - a.item.createdAt.getTime());
```
Сортировка в JS, НЕ `ORDER BY` (Pitfall 8). Рендерить `<ItemCard item scored />` вместо `<li>{item.title}</li>`. `now` создаётся один раз и прокидывается.

---

### `src/components/items/ItemCard.tsx` / `PriorityBadge.tsx` / `ScoreBreakdown.tsx`

**ItemCard (RSC)** — частичный аналог: shadcn `Card` (установлен) + презентационный RSC-стиль как empty-state в `list/page.tsx` и `AppHeader.tsx` (`AppHeader.tsx:11-26` — чистый серверный презентационный компонент, `truncate`/`min-w-0` для длинного текста → применимо к длинному `title`, UI-SPEC backstop E4).

**PriorityBadge (RSC-leaf)** — нет аналога: shadcn `Badge` + lucide (`ArrowUp`/`ArrowRight`/`ArrowDown`) + `priorityLevel(total)`. 4 избыточных канала (число + метка + иконка + цвет), UI-SPEC §Семантическая палитра. Импорт иконок как `Loader2` в `RegisterForm.tsx:8` (`import { X } from "lucide-react"`).

**ScoreBreakdown (client-leaf)** — частичный аналог `LogoutButton.tsx` (единственный существующий client-leaf, паттерн `"use client"` в листе при серверном родителе, комментарий `AppHeader.tsx:8-9`). Обёртка shadcn `Collapsible`; строки из `computeBreakdown(item, now)`; тач-зона ≥44px; тексты «Показать/Скрыть разбывку», «Итого: {total}» (UI-SPEC).

---

### `tests/helpers/db.ts` (расширение `seedItem`)

**Аналог:** `seedItem` в том же файле (`db.ts:55-68`).

**Текущий хелпер** (`db.ts:55-68`):
```typescript
export async function seedItem(
  userId: string,
  fields: { title: string }
): Promise<{ id: string }> {
  const id = randomUUID();
  await testDb.insert(items).values({ id, userId, title: fields.title, createdAt: new Date() });
  return { id };
}
```
Расширить `fields` под новые NOT NULL/defaulted колонки (`category`/`urgency`/`need`/`benefit`/`doubts` и т.д.) с разумными дефолтами, чтобы существующий тест изоляции не сломался (RESEARCH Runtime State / Wave 0 Gap).

---

## Общие (сквозные) паттерны

### Изоляция по userId (AUTH-04)
**Источник:** `src/server/repos/items.ts:8-14` + `src/server/auth/current-user.ts:10-21`.
**Применять к:** `actions.ts` (createItem), `createItemForUser`, `list/page.tsx`, `list/new/page.tsx`.
`userId` — ТОЛЬКО из `requireUser()`/`getCurrentUser()` (серверная сессия), всегда попадает в WHERE/values на сервере, никогда из payload.
```typescript
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
```

### Единая Zod-валидация (клиент + сервер)
**Источник:** `src/lib/validation/auth.ts` (используется в `RegisterForm.tsx:34-38` через `zodResolver` И должна повторно вызываться в Server Action).
**Применять к:** `item.ts` → `AddItemForm.tsx` (RHF `zodResolver`) + `actions.ts` (`safeParse`, never-trust-client V5).

### Форм-паттерн RHF + результат-объект + router.push
**Источник:** `src/components/auth/RegisterForm.tsx:30-133`.
**Применять к:** `AddItemForm.tsx`. `mode: "onSubmit"`, `isPending = form.formState.isSubmitting`, `Alert` для форм-левел ошибки, `Loader2` спиннер, `router.push("/list"); router.refresh()` при успехе.

### Стиль юнит-теста (Vitest)
**Источник:** `src/lib/validation/auth.test.ts:1-54` (хелпер `messageFor`, `safeParse` + `expect(...).toBe(точный русский текст)`).
**Применять к:** `scoring.test.ts`, `item.test.ts`.

### Интеграционный тест с реальной БД
**Источник:** `src/server/repos/items.iso.test.ts:1-32` (`// @vitest-environment node`, `resetDb`/`closeTestDb`/`seedUser`/`seedItem`).
**Применять к:** расширение `items.iso.test.ts` (write-изоляция).

### Тексты на русском, идентификаторы на английском
**Источник:** все файлы Фазы 1 (`RegisterForm.tsx`, `list/page.tsx`, `AppHeader.tsx`).
**Применять ко всем** новым файлам: пользовательские строки — русские (из UI-SPEC §Copywriting), ключи enum/переменные/пути — английские.

---

## Файлы без аналога

Планировщику опираться на `02-RESEARCH.md` (Patterns, Code Examples) и `02-UI-SPEC.md`.

| Файл | Роль | Data Flow | Причина |
|------|------|-----------|---------|
| `src/lib/scoring/scales.ts` | utility (константы) | transform | Первый scoring-модуль; шкалы из `SUMMARY.md` + D-01…D-03. Ориентир — RESEARCH Code Examples. |
| `src/lib/scoring/scoring.ts` | utility (pure) | transform | Чистые функции с внедряемой `now`; нет аналога вычислительного модуля. Ориентир — RESEARCH Pattern 1. |
| `src/components/items/PriorityBadge.tsx` | component (RSC-leaf) | — | shadcn `Badge` не установлен; UI-SPEC §Семантическая палитра приоритета. |

**Частичные аналоги** (`ItemCard.tsx`, `ScoreBreakdown.tsx`): каркас есть (`Card`, client-leaf `LogoutButton`), но конкретная композиция — новая; детали в UI-SPEC §Component Behaviour Contracts.

---

## Метаданные

**Область поиска аналогов:** `src/lib/validation/`, `src/lib/scoring/` (пусто), `src/server/repos/`, `src/server/db/`, `src/server/auth/`, `src/app/(app)/list/`, `src/components/auth/`, `src/components/app/`, `src/components/ui/`, `tests/helpers/`.
**Файлов просмотрено:** 11 (schema.ts, items.ts, current-user.ts, auth.ts, auth.test.ts, RegisterForm.tsx, RegisterForm.test.tsx, AppHeader.tsx, list/page.tsx, items.iso.test.ts, db.ts).
**Дата извлечения паттернов:** 2026-08-01.
