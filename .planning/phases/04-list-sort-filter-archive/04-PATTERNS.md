# Фаза 4: Список — сортировка, фильтры и архив — Карта паттернов

**Составлено:** 2026-08-02
**Файлов проанализировано (создаётся/изменяется):** 12
**Аналогов найдено:** 11 / 12

Документ отвечает на вопрос «с какого существующего кода Фаз 1–3 копировать паттерны для каждого нового/изменяемого файла Фазы 4». Прозой на русском; идентификаторы, пути и имена библиотек — на английском. Потребитель — `gsd-planner`.

---

## File Classification

| Новый/изменяемый файл | Роль | Data Flow | Ближайший аналог | Качество |
|-----------------------|------|-----------|------------------|----------|
| `src/server/db/schema.ts` (изм.) | model / schema | — (миграция) | сам себя (блок `items`, строки 125–162) + миграция `drizzle/0001_*` | exact |
| `src/server/repos/items.ts` (изм.) — `setItemPurchasedForUser` | repo (write-seam) | CRUD (update) | `deleteItemForUser` / `updateItemForUser` (тот же файл, строки 53–84) | exact |
| `src/app/(app)/list/actions.ts` (нов.) — `setItemPurchased` | server action | request-response | `deleteItem` в `list/[id]/edit/actions.ts` (строки 66–84) | exact |
| `src/lib/list/sort.ts` (нов.) | utility (чистая логика) | transform | `src/lib/scoring/scoring.ts` (чистый, детерминированный, unit-tested) | role-match |
| `src/lib/list/sort.test.ts` (нов.) | test (unit) | — | `src/lib/scoring/scoring.test.ts` | role-match |
| `src/app/(app)/list/page.tsx` (изм.) | RSC (route/page) | request-response (read) | сам себя (текущий RSC, строки 18–68) | exact |
| `src/components/items/ListView.tsx` (нов.) | component (client) | event-driven (UI state) | нет прямого аналога (первый `'use client'`-контейнер поверх RSC-данных) | no-analog |
| `src/components/items/ListControls.tsx` (нов.) | component (client) | event-driven | `src/components/ui/select.tsx` + `checkbox.tsx` (примитивы) | partial |
| `src/components/items/PurchaseCheckbox.tsx` (нов.) | component (client-leaf) | request-response (optimistic write) | `DeleteItemButton.tsx` (client-leaf + Server Action + router.refresh) | role-match |
| `src/components/items/ItemCard.tsx` (изм.) | component (RSC) | — | сам себя (текущая карточка, строки 26–69) | exact |
| `src/components/ui/sonner.tsx` (нов., shadcn) | config / ui wrapper | — | генерируется `npx shadcn add sonner`, упрощается до `theme="light"` | external |
| `src/app/(app)/layout.tsx` (изм.) — монтаж `<Toaster/>` | layout (RSC shell) | — | сам себя (строки 13–27) | exact |
| `src/server/repos/items.iso.test.ts` (изм.) | test (integration, real PG) | CRUD | существующие `describe`-блоки (строки 121–302) | exact |
| `tests/helpers/db.ts` (изм.) — `seedItem` + `purchasedAt` | test helper | — | текущий `seedItem` (строки 58–84) | exact |
| `e2e/app/purchase-archive.spec.ts` (нов.) | test (e2e) | — | `e2e/app/delete-item.spec.ts` | role-match |

---

## Pattern Assignments

### `src/server/db/schema.ts` (model, миграция)

**Аналог:** блок `pgTable("items", {...})` в том же файле (строки 125–162) + аддитивная миграция `drizzle/0001_*.sql`.

Добавить одну nullable-колонку внутри объекта колонок `items`, после `createdAt` (строки 155–157). `timestamp` уже импортирован (строка 9). Семантика D-07: `null` = активна, non-null = куплена. Не участвует в подсчёте очков (в `ScoredFields` не добавляется — `scoring.ts` не трогаем).

```typescript
// после createdAt внутри pgTable("items", {...})
purchasedAt: timestamp("purchased_at"),
```

Тип `Item = typeof items.$inferSelect` (строка 165) авто-расширится полем `purchasedAt: Date | null`. Затем `npx drizzle-kit generate` → `npx drizzle-kit migrate` (executor через npm/CLI — env-файлы заблокированы для файловых инструментов, см. MEMORY).

---

### `src/server/repos/items.ts` — `setItemPurchasedForUser` (repo, CRUD-write)

**Аналог:** `deleteItemForUser` (строки 78–84) и `updateItemForUser` (строки 53–71) — тот же файл.

Копировать точный шов изоляции: `userId` — обязательный параметр из сессии, попадает в `.where(and(eq(items.id, id), eq(items.userId, userId)))`; `.returning()` пуст при чужой/несуществующей строке → возврат `null` (no-op, IDOR невозможен). Импорты `and, eq`, `db`, `items` уже есть (строки 3–6).

```typescript
export async function setItemPurchasedForUser(
  userId: string,
  id: string,
  purchased: boolean
) {
  const [row] = await db
    .update(items)
    .set({ purchasedAt: purchased ? new Date() : null })
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}
```

Отличие от `updateItemForUser`: НЕ нужна нормализация `undefined → null` (CR-01) — здесь единственное поле `purchasedAt` задаётся явным `Date | null`.

---

### `src/app/(app)/list/actions.ts` — `setItemPurchased` (server action)

**Аналог:** `deleteItem` в `src/app/(app)/list/[id]/edit/actions.ts` (строки 66–84).

Новый файл рядом с `page.tsx` (action не привязан к `[id]/edit`-маршруту — Open Question 2 research рекомендует `list/actions.ts`). Копировать форму `deleteItem`: `"use server"`, `requireUser()` (userId ТОЛЬКО из сессии, никогда из аргумента — mass-assignment невозможен), результат-объект `{ ok } | { ok: false; error }`, БЕЗ `redirect()` (Pitfall 7 — `NEXT_REDIRECT` поймался бы try/catch; навигацию делает клиент через `router.refresh()`). `no-op` (repo вернул `null`) НЕ рапортуется как успех (WR-01).

**Шапка (образец строк 1–5, 66–68):**
```typescript
"use server";
import { requireUser } from "@/server/auth/current-user";
import { setItemPurchasedForUser } from "@/server/repos/items";

const STATUS_ERROR = "Не удалось обновить статус. Попробуйте ещё раз.";
export type SetPurchasedResult = { ok: true } | { ok: false; error: string };
```

**Тело (образец строк 70–84):**
```typescript
export async function setItemPurchased(
  id: string,
  purchased: boolean
): Promise<SetPurchasedResult> {
  const user = await requireUser();
  try {
    const row = await setItemPurchasedForUser(user.id, id, purchased);
    if (!row) return { ok: false, error: STATUS_ERROR }; // no-op ≠ успех (WR-01)
    return { ok: true };
  } catch {
    return { ok: false, error: STATUS_ERROR };
  }
}
```

Валидация входа (V5): `purchased` привести к строгому boolean на вызывающей стороне; тяжёлой Zod-валидации нет (нет form-payload).

---

### `src/lib/list/sort.ts` (utility, transform) — TDD-ядро

**Аналог:** `src/lib/scoring/scoring.ts` — чистый, детерминированный, без БД, без `Date.now()` внутри, покрыт unit-тестами.

Копировать стиль scoring: экспортируемые чистые функции, все входы — примитивы (никаких `Date` в рантайме, §Pitfall 4 — RSC отдаёт `total: number`, `createdAtMs: number`, `purchasedAtMs: number | null`). Сначала `partitionByPurchased`, ЗАТЕМ `sortActive`/`sortPurchased` (§Pitfall 1 — не сортировать до партиции). Архив всегда `purchasedAt` убыв. независимо от `sortKey`. Алфавит — `localeCompare(b, "ru", { sensitivity: "base" })` (§Pitfall 5). Не мутировать вход (`[...items].sort`).

Готовые сигнатуры и компараторы см. RESEARCH §Code Examples (строки 316–368) — планировщик берёт оттуда дословно: `SortKey`, `ListItem`, `partitionByPurchased`, `byPriority`/`byCreatedAt`/`byTitle`/`byPurchasedAtDesc`, `sortActive`, `sortPurchased`.

---

### `src/lib/list/sort.test.ts` (test, unit)

**Аналог:** `src/lib/scoring/scoring.test.ts` (Vitest, чистые функции без БД/окружения).

TDD RED-first. Покрыть: tiebreak `total → createdAt → id` (LIST-01); `createdAt` убыв. → `id` (LIST-02); алфавит с проверкой Ё/регистра (LIST-03, конкретные строки — верификация A2 full-ICU); партиция `null`/non-null (LIST-04); архив `purchasedAt` убыв. независимо от `sortKey` (LIST-05).

---

### `src/app/(app)/list/page.tsx` (RSC, read)

**Аналог:** сам себя (строки 18–68) — расширяется, не переписывается.

Сохранить: `getCurrentUser()` + `redirect("/login")` подстраховка (строки 19–21); `findItemsForUser(user.id)` — теперь возвращает и купленные строки (D-10, WHERE не меняется, фильтра по `purchasedAt` НЕТ); единый `now = new Date()` (строка 42, SCORE-05/D-03). Изменения: грузить ВСЕ покупки; для каждой считать `total` через `computeTotal(item, now)`; привести к примитивам (§Pitfall 4) — `createdAtMs: item.createdAt.getTime()`, `purchasedAtMs: item.purchasedAt?.getTime() ?? null`; отдать массив в `<ListView items={...} />` вместо прямого рендера `<ul>`. Ветка `rows.length === 0` (строки 25–37) остаётся для наследуемого empty-state `Список пуст` (панель не рендерится, §Pitfall 2 / UI-SPEC). Клиентская сортировка/партиция переезжает в `ListView` (сейчас `.sort` на строках 49–53 — удаляется из RSC).

---

### `src/components/items/ListView.tsx` (component, client) — НЕТ прямого аналога

**Аналог:** нет (первый `'use client'`-контейнер поверх RSC-данных). Опорные ориентиры: клиентский стиль из `DeleteItemButton.tsx` (директива `"use client"`, `useState`); чистая логика — из `sort.ts`.

Планировщику ориентироваться на RESEARCH §Architecture Pattern 2 и диаграмму (строки 126–166). Держит `useState` `sortKey='priority'` и `showPurchased=false` (эфемерно, D-09 — НЕ URL/localStorage/nuqs). Вызывает `partitionByPurchased(items)` → `sortActive(active, sortKey)` + `sortPurchased(purchased)`. Рендерит `<ListControls>`, затем активный список из `<ItemCard>`, затем (только при `showPurchased && purchased.length`) секцию «Куплено» (`border-t mt-8`, заголовок Heading приглушён). Empty-ветвление (§Pitfall 2 / UI-SPEC §Empty): `active.length === 0` × `showPurchased`.

---

### `src/components/items/ListControls.tsx` (component, client)

**Аналог:** примитивы `src/components/ui/select.tsx` и `src/components/ui/checkbox.tsx` (установлены Фаза 2). Раскладку `Select` + `Checkbox` см. в форме добавления (`isCredit`-чекбокс) и UI-SPEC §Панель управления (строки 135–150).

Sticky-панель `sticky top-0 z-10 bg-background border-b px-4 py-3 flex flex-col gap-3`. Ряд A: `Select` `w-full h-11`, `aria-label="Сортировка"`, 3 опции в порядке D-01. Ряд B: label-обёртка `flex items-center gap-2 min-h-11` с `Checkbox` + span «Показывать купленные». Тексты — UI-SPEC §Copywriting Contract (строки 111–127).

---

### `src/components/items/PurchaseCheckbox.tsx` (component, client-leaf) — оптимистичный write

**Аналог:** `src/components/items/DeleteItemButton.tsx` (строки 1–121) — client-leaf, `"use client"`, `useRouter`, вызов Server Action в async try/catch, `router.refresh()` при успехе, pending-guard.

Ключевое отличие: НЕТ модалки (действие недеструктивно, D-04/D-05); вместо `useState`-pending — `useOptimistic` + `useTransition` (§Pitfall 3: вызывать action И `router.refresh()` внутри одного `startTransition`; базовое значение `useOptimistic` = `purchased` из пропа; `disabled={isPending}` — guard от двойного тапа). После успеха — `sonner`-тост с кнопкой «Отменить» (undo = `setItemPurchased(id, false)`). Ошибка — `toast.error(...)`, оптимистика откатывается.

**Fallback (A1, если реконсиляция капризна):** плоский `useState`-оптимизм точно по каркасу `DeleteItemButton` (доказан Фазой 3) + `router.refresh()`.

Готовая форма компонента — RESEARCH §Code Examples (строки 414–454). Использует примитив `@/components/ui/checkbox` (строки поддержки: `data-checked:bg-primary` даёт accent-состояние из UI-SPEC §Color).

**Раскладка (UI-SPEC §Чекбокс, строки 158–176 / §Pitfall 7):** `h-11 w-11 shrink-0`, ведущий контрол ряда заголовка карточки, `aria-label` переключается «Отметить купленной» / «Вернуть в активные».

---

### `src/components/items/ItemCard.tsx` (component, RSC)

**Аналог:** сам себя (строки 26–69) — расширяется.

Добавить `<PurchaseCheckbox id purchased />` ведущим контролом ряда заголовка (перед `<span>` title, строки 40–44) — три независимых тач-цели ≥44px (§Pitfall 7). Title сохраняет `min-w-0 truncate`, badge — `shrink-0`. Новый проп `purchased: boolean` (и опц. флаг приглушения). Приглушённое лечение купленной (UI-SPEC §Color, строки 100–103): контейнер `opacity-70`, title `line-through text-muted-foreground` — избыточный (не только цветом) канал статуса. Ряд действий (`ScoreBreakdown` + Pencil + `DeleteItemButton`, строки 46–65) — без изменений.

---

### `src/components/ui/sonner.tsx` (config / ui wrapper) — external

**Аналог:** генерируется `npx shadcn add sonner`. Дефолтная обёртка тянет `next-themes` — УБРАТЬ импорт `useTheme`, зафиксировать `theme="light"` (тёмной темы в проекте нет, §Anti-Patterns).

```typescript
"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";
export function Toaster(props: ToasterProps) {
  return <Sonner theme="light" className="toaster group" {...props} />;
}
```

---

### `src/app/(app)/layout.tsx` (layout, RSC shell)

**Аналог:** сам себя (строки 13–27) — RSC guard остаётся, добавляется монтаж тоста.

Импортировать `{ Toaster } from "@/components/ui/sonner"`; смонтировать один раз рядом с `<main>` (строка 25): `<Toaster position="bottom-center" richColors={false} />`. `<Toaster>` — client-leaf, layout остаётся RSC (секрет `BETTER_AUTH_SECRET` не утекает).

---

### `src/server/repos/items.iso.test.ts` (test, integration real PG)

**Аналог:** существующие `describe`-блоки, особенно `deleteItemForUser — изоляция удаления` (строки 272–302) и `updateItemForUser` (строки 121–157).

Добавить `describe("setItemPurchasedForUser — изоляция записи по userId (LIST-04 / D-08)")`. Копировать структуру: file-level `beforeEach(resetDb)` / `afterAll(closeTestDb)` (строки 17–23) не дублировать. Кейсы (RED-first, real PG): (1) B не может отметить покупку A → `null`, строка A цела; (2) владелец A ставит `purchased=true` → `purchasedAt` non-null timestamp; (3) A снимает `purchased=false` → `purchasedAt` = `null` (обратимость D-05, persist). Импорт `setItemPurchasedForUser` добавить в блок строк 4–10.

---

### `tests/helpers/db.ts` — `seedItem` + `purchasedAt` (test helper)

**Аналог:** текущий `seedItem` (строки 58–84).

Расширить `fields`-объект опциональным `purchasedAt?: Date | null` и прокинуть в `.insert(items).values({...})`. По умолчанию не задаётся → строка активна (существующие тесты не ломаются). Нужно для засева купленной покупки в новых тестах (Wave 0).

---

### `e2e/app/purchase-archive.spec.ts` (test, e2e)

**Аналог:** `e2e/app/delete-item.spec.ts` (строки 1–70).

Копировать каркас: регистрация через `POST /api/auth/sign-up/email` (строки 30–33), хелпер `selectOption` (строки 15–22), добавление покупки через `/list/new`, локатор карточки `page.locator("ul > li").filter({ hasText })`. Сквозной срез (RESEARCH строка 543): добавить 2–3 покупки → отметить купленной (чекбокс `aria-label="Отметить купленной"`) → исчезает из активных (фильтр ВЫКЛ) + тост → «Отменить» возвращает → включить «Показывать купленные» → появляется секция «Куплено» с приглушённой карточкой → снять чекбокс в архиве → возврат в активные → переключить `Select` → порядок меняется.

---

## Shared Patterns

### Изоляция по userId (V4 / AUTH-04)

**Источник:** `src/server/repos/items.ts` (все write-seam, напр. `deleteItemForUser` строки 78–84).
**Применить к:** `setItemPurchasedForUser`, `setItemPurchased`, `items.iso.test.ts`.
```typescript
.where(and(eq(items.id, id), eq(items.userId, userId)))
.returning();
return row ?? null; // null = чужая/нет строки → no-op, IDOR невозможен
```
`userId` — ТОЛЬКО из `requireUser()` / серверной сессии, НИКОГДА из аргумента (mass-assignment).

### Server Action без redirect + результат-объект (Pitfall 7 / WR-01)

**Источник:** `src/app/(app)/list/[id]/edit/actions.ts` `deleteItem` (строки 70–84).
**Применить к:** `setItemPurchased`.
Возвращать `{ ok: true } | { ok: false; error }`; НЕ вызывать `redirect()`; `no-op` (repo `null`) НЕ рапортовать успехом; навигацию/ресинк (`router.refresh()`) делает клиент.

### Client-leaf + router.refresh() ресинк RSC

**Источник:** `DeleteItemButton.tsx` (строки 39–67).
**Применить к:** `PurchaseCheckbox`.
`"use client"` + `useRouter` + вызов Server Action в async + `router.refresh()` при успехе + pending-guard (`disabled`). Отличие Фазы 4: `useOptimistic`/`useTransition` вместо плоского `useState` (fallback — плоский `useState`, A1).

### Единый `now`, сортировка в JS (SCORE-05 / D-03)

**Источник:** `src/app/(app)/list/page.tsx` (строка 42) + `src/lib/scoring/scoring.ts` (весь).
**Применить к:** `page.tsx`, `sort.ts`.
`total` считается ТОЛЬКО в RSC единым `now`; клиент сравнивает предвычисленные примитивы (никаких `Date`/`Date.now()` в клиенте, §Pitfall 4). Сортировка в JS, НЕ SQL `ORDER BY` по вычисляемому приоритету.

### Интеграционный тест на реальной Postgres (TDD RED-first)

**Источник:** `src/server/repos/items.iso.test.ts` (структура файла) + `tests/helpers/db.ts` (`seedUser`/`seedItem`/`resetDb`/`closeTestDb`).
**Применить к:** каждый новый write-seam (`setItemPurchasedForUser`).
`// @vitest-environment node`, `beforeEach(resetDb)`, `afterAll(closeTestDb)` — file-level, не дублировать между describe.

---

## No Analog Found

| Файл | Роль | Data Flow | Причина |
|------|------|-----------|---------|
| `src/components/items/ListView.tsx` | component (client) | event-driven | Первый `'use client'`-контейнер поверх RSC-данных; в Фазах 1–3 клиентское состояние жило только в leaf-компонентах (`DeleteItemButton`), контейнера сортировки/фильтра не было. Планировщик берёт форму из RESEARCH §Architecture Pattern 2 / диаграммы (строки 126–166), стиль `"use client"`/`useState` — из `DeleteItemButton`. |

---

## Metadata

**Диапазон поиска аналогов:** `src/server/repos/`, `src/app/(app)/list/`, `src/components/items/`, `src/components/ui/`, `src/lib/scoring/`, `tests/helpers/`, `e2e/app/`.
**Файлов прочитано:** 11 (schema.ts, repos/items.ts, list/[id]/edit/actions.ts, list/page.tsx, DeleteItemButton.tsx, ItemCard.tsx, layout.tsx, items.iso.test.ts, tests/helpers/db.ts, scoring.ts, checkbox.tsx, delete-item.spec.ts).
**Дата извлечения паттернов:** 2026-08-02
