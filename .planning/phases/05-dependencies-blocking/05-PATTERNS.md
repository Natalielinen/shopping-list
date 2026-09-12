# Фаза 5: Зависимости и блокировка — Карта паттернов

**Составлено:** 2026-09-12
**Файлов проанализировано:** 15 (создаваемые + изменяемые)
**Аналогов найдено:** 15 / 15 (все точки опоры существуют в кодовой базе)

Все аналоги — из текущего кода Фаз 1–4, прочитаны построчно. Ссылки на строки и сигнатуры точные. Новых библиотек фаза не вводит.

## Классификация файлов

| Создаётся/изменяется | Роль | Data Flow | Ближайший аналог | Качество совпадения |
|----------------------|------|-----------|------------------|---------------------|
| `src/lib/deps/cycle.ts` (новый) | utility (pure) | transform | `src/lib/list/sort.ts`, `src/lib/scoring/scoring.ts` | точное (чистый модуль) |
| `src/lib/deps/cycle.test.ts` (новый) | test (unit) | transform | `src/lib/scoring/scoring.test.ts` | точное |
| `src/lib/deps/blocked.ts` (новый) | utility (pure) | transform | `src/lib/list/sort.ts` | точное |
| `src/lib/deps/blocked.test.ts` (новый) | test (unit) | transform | `src/lib/scoring/scoring.test.ts` | точное |
| `src/server/db/schema.ts` (изм.) | model | CRUD | существующие `.references()` в `session`/`account`/`items.userId` | точное (self-FK — вариант) |
| `drizzle/0003_*.sql` (новый, сгенерирован) | migration | CRUD | `drizzle/0001_cuddly_rhino.sql`, `0002_*` | точное |
| `src/lib/validation/item.ts` (изм.) | validation | request-response | существующие `z.preprocess` хелперы (`optionalUrl`/`optionalText`) | точное |
| `src/server/repos/items.ts` (изм.) | repository | CRUD | `updateItemForUser`, `findItemForUser` (сам файл) | точное |
| `src/app/(app)/list/actions.ts` (изм.) | server-action | request-response | `setItemPurchased` (сам файл) | точное |
| `src/app/(app)/list/new/actions.ts` (изм.) | server-action | request-response | `createItem` (сам файл) | точное |
| `src/app/(app)/list/[id]/edit/actions.ts` (изм.) | server-action | request-response | `updateItem` (сам файл) | точное |
| `src/app/(app)/list/new/page.tsx` + `[id]/edit/page.tsx` (изм.) | RSC (provider) | request-response | `edit/page.tsx` prefill + `list/page.tsx` `findItemsForUser` | точное |
| `src/app/(app)/list/page.tsx` (изм.) | RSC | request-response | `.map` в самом `list/page.tsx` (строки 49-57) | точное |
| `src/lib/list/sort.ts` (изм.) | utility (type) | transform | интерфейс `ListItem` (сам файл) | точное |
| `src/components/items/AddItemForm.tsx` (изм.) | component (form) | request-response | enum-`Select` (category/urgency/doubts) в самом файле | точное |
| `src/components/items/PurchaseCheckbox.tsx` (изм.) | component (leaf) | event-driven | сам компонент (проп `purchased` → `disabled`) | точное |
| `src/components/items/ItemCard.tsx` + `ListView.tsx` (изм.) | component | request-response | `ItemCard` проп-форвардинг + `lucide` импорт `Pencil` | точное |
| `src/server/repos/items.iso.test.ts` (изм.) | test (integration) | CRUD | сам файл (describe-блоки по швам) | точное |
| `tests/helpers/db.ts` (изм.) | test-helper | CRUD | `seedItem` (сам файл) | точное |

## Назначения паттернов

### `src/lib/deps/cycle.ts` и `blocked.ts` (utility, pure / transform)

**Аналог:** `src/lib/list/sort.ts` (чистый модуль без побочных эффектов) + `src/lib/scoring/scoring.ts`.

**Паттерн модуля** — из `src/lib/list/sort.ts:1-24`: файл начинается с блок-комментария об инвариантах (только примитивы на входе, функции чисты, `[...items]` вместо мутации), затем экспорт типов и функций с JSDoc на русском:

```typescript
// Чистая детерминированная логика ... .
//
// Инварианты (...):
//   - Только примитивы на входе ...
//   - Все функции чисты и не мутируют вход ([...items].sort).

export type SortKey = "priority" | "createdAt" | "title";
export function partitionByPurchased(items: ListItem[]): { ... } { ... }
```

Новые `cycle.ts`/`blocked.ts` следуют этому же стилю. Готовые сигнатуры уже заданы в RESEARCH §Pattern 2 / §Pattern 3:
- `wouldCreateCycle(map: ReadonlyMap<string, string | null>, sourceId: string | null, candidateId: string): boolean`
- `isBlocked(dependsOn: string | null, dependencyPurchasedAt: Date | number | null | undefined): boolean`

**Импорты:** без внешних зависимостей (как `sort.ts` — импортов вообще нет).

### `src/lib/deps/cycle.test.ts` и `blocked.test.ts` (test, unit)

**Аналог:** `src/lib/scoring/scoring.test.ts:1-40`.

**Паттерн теста** (строки 1, 23-39): импорт из `vitest`, фиксированные детерминированные входы, `describe` с ID требования в заголовке, `it.each` для табличных кейсов:

```typescript
import { describe, expect, it } from "vitest";
import { deadlinePoints } from "@/lib/scoring/scoring";

describe("deadlinePoints (D-04, SCORE-02)", () => {
  it("без дедлайна возвращает 0", () => {
    expect(deadlinePoints(null, NOW)).toBe(0);
  });
  it.each([
    ["сегодня (0 дней)", 0, 28],
    ["+28 дней", 28, 0],
  ])("дедлайн %s → %i очков", (_label, offset, expected) => {
    expect(deadlinePoints(dayOffset(offset as number), NOW)).toBe(expected);
  });
});
```

Для `cycle.test.ts` — кейсы из §Wave 0: self, A→B/B→A, транзитив, corrupt-cycle bound, create→false. Для `blocked.test.ts`: `dependsOn` null→false, зависимость не куплена→true, куплена→false. Быстрый прогон: `npx vitest run src/lib/deps`.

### `src/server/db/schema.ts` (model, CRUD)

**Аналог:** существующие `.references()` в том же файле — `session.userId` (строки 53-55), `account.userId` (66-68), `items.userId` (131-133):

```typescript
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
```

**Добавляемый паттерн** (self-ref FK, RESEARCH §Pattern 1): та же форма `.references()`, но с явной аннотацией возврата `(): AnyPgColumn` (разрывает циклическую инференцию, Pitfall 1) и `onDelete: "set null"` (D-06). Импорт `AnyPgColumn` добавляется в существующий блок `from "drizzle-orm/pg-core"` (строки 2-10):

```typescript
import { type AnyPgColumn, boolean, date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// внутри pgTable("items", {...}), рядом с link/description/deadline (строки 147-150):
dependsOn: text("depends_on").references((): AnyPgColumn => items.id, {
  onDelete: "set null",
}),
```

Колонка nullable (без `.notNull()`) — аддитивная миграция, существующие строки получают NULL. Тип `Item` (строка 171) автоматически подхватит новое поле; `ItemInsertData` (178-181) исключает только `id/userId/createdAt/purchasedAt`, значит `dependsOn` войдёт в insert/update data автоматически.

### `drizzle/0003_*.sql` (migration)

**Аналог:** `drizzle/0001_cuddly_rhino.sql`, `drizzle/0002_tranquil_slapstick.sql` (следующий номер — 0003).

Генерируется, НЕ пишется вручную (§Don't Hand-Roll): `npx drizzle-kit generate` → `npx drizzle-kit migrate`. Ожидаемый SQL — `ALTER TABLE "items" ADD COLUMN "depends_on" text` + отдельный `ADD CONSTRAINT ... ON DELETE set null`. Коммитятся вместе `0003_*.sql` + `drizzle/meta/0003_snapshot.json` + обновлённый `_journal.json`. Test DB подхватывает автоматически через `ensureMigrated` (`tests/helpers/db.ts:28-32`).

### `src/lib/validation/item.ts` (validation, request-response)

**Аналог:** хелперы `optionalUrl`/`optionalText`/`optionalDate` (строки 44-61) — паттерн `z.preprocess((v) => ... , schema.optional())`.

**Добавляемое поле** в `itemInputSchema` (строки 63-76), по образцу RESEARCH §Code Examples — sentinel `"none"`/`""`→null:

```typescript
dependsOn: z.preprocess(
  (v) => (v === "" || v === "none" || v == null ? null : v),
  z.string().nullable()
).optional(),
```

Владение и цикл здесь НЕ проверяются (схема синхронна, общая клиент+сервер, без доступа к БД — Anti-Pattern). Тип `ItemInput` (строка 78) через `z.infer` подхватит поле. Расширить `item.test.ts` кейсами sentinel→null.

### `src/server/repos/items.ts` (repository, CRUD)

**Аналог CR-01 нормализации:** `updateItemForUser` (строки 53-71) уже нормализует `undefined → null` для nullable-колонок.

**Изменение (Pitfall 4):** добавить `dependsOn: data.dependsOn ?? null` в объект `.set()` рядом с link/description/deadline (строки 61-66):

```typescript
.set({
  ...data,
  link: data.link ?? null,
  description: data.description ?? null,
  deadline: data.deadline ?? null,
  price: data.price ?? null,
  monthlyPayment: data.monthlyPayment ?? null,
  dependsOn: data.dependsOn ?? null,   // ← ДОБАВИТЬ (иначе очистка не персистится)
})
```

`createItemForUser` (строки 19-25) НЕ трогаем — `.values()` на INSERT из `undefined` даёт NULL автоматически. `findItemForUser` (строки 31-37) — уже IDOR-безопасный шов, переиспользуется guard'ом `setItemPurchased` без изменений.

### `src/app/(app)/list/actions.ts` (server-action — guard блокировки, D-03)

**Аналог:** сам `setItemPurchased` (строки 24-43) — паттерн `requireUser()` → строгий boolean → try/catch → `{ ok }`.

**Изменение (RESEARCH §Pattern 3):** после `const next = purchased === true` (строка 32) и перед `setItemPurchasedForUser`, добавить guard через существующий `findItemForUser` + чистый `isBlocked`:

```typescript
import { findItemForUser, setItemPurchasedForUser } from "@/server/repos/items";
import { isBlocked } from "@/lib/deps/blocked";

const BLOCKED_ERROR = "Сначала купите товар, от которого зависит эта покупка."; // UI-SPEC

// внутри try (или до него), только при next === true:
if (next) {
  const item = await findItemForUser(user.id, id);
  if (item?.dependsOn) {
    const dep = await findItemForUser(user.id, item.dependsOn);
    if (isBlocked(item.dependsOn, dep?.purchasedAt ?? null)) {
      return { ok: false, error: BLOCKED_ERROR };
    }
  }
}
```

Тип `SetPurchasedResult` (строка 22) уже `{ ok:false; error:string }` — расширять НЕ нужно. Снятие «куплено» (`next===false`) всегда проходит без guard.

### `src/app/(app)/list/new/actions.ts` + `[id]/edit/actions.ts` (server-action — владение + цикл, D-05)

**Аналог:** `createItem` (new/actions.ts:22-52) и `updateItem` (edit/actions.ts:23-60) — идентичны по структуре (`requireUser` → `safeParse` → рубли→копейки → write). `updateItem` — зеркало `createItem`.

**Изменение (RESEARCH §Code Examples):** после `safeParse` (строки new:27-30 / edit:31-34), до записи, добавить проверку владения + цикла через `findItemsForUser` (один read) + `wouldCreateCycle`:

```typescript
import { findItemsForUser, createItemForUser } from "@/server/repos/items";
import { wouldCreateCycle } from "@/lib/deps/cycle";

const CYCLE_ERROR = "Нельзя выбрать эту покупку — получится цикл зависимостей."; // UI-SPEC

// editedId = null в createItem; = id в updateItem
if (parsed.data.dependsOn != null) {
  const own = await findItemsForUser(user.id);
  const map = new Map(own.map((r) => [r.id, r.dependsOn]));
  if (!map.has(parsed.data.dependsOn)) {                    // владение (IDOR, V4)
    return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
  }
  if (wouldCreateCycle(map, editedId, parsed.data.dependsOn)) {  // D-05
    return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
  }
}
```

**Расширение типа результата (Pitfall 6):** `CreateItemResult`/`UpdateItemResult` (new:20 / edit:21) сейчас `{ ok:true } | { ok:false; error:string }`. Добавить опциональное `field?: "dependsOn"`, чтобы форма показала ошибку под селектом.

### `src/app/(app)/list/new/page.tsx` + `[id]/edit/page.tsx` (RSC — кандидаты пропом)

**Аналог:** `edit/page.tsx` (строки 27, 33-53) — уже читает `findItemForUser` и передаёт `initialValues` в `AddItemForm`; `list/page.tsx:29` — паттерн `findItemsForUser(user.id)`.

**Изменение (RESEARCH §Code Examples):** RSC грузит `findItemsForUser`, строит `candidates` (исключая self и cycle-небезопасных через `wouldCreateCycle`), передаёт пропом в форму. В `edit/page.tsx` также добавить `dependsOn: item.dependsOn ?? "none"` в `initialValues` (строки 36-52):

```typescript
const rows = await findItemsForUser(user.id);
const map = new Map(rows.map((r) => [r.id, r.dependsOn]));
const candidates = rows
  .filter((r) => r.id !== id)                          // не self (только edit)
  .filter((r) => !wouldCreateCycle(map, id, r.id))     // не cycle-unsafe
  .filter((r) => r.purchasedAt === null || r.id === item.dependsOn)
  .map((r) => ({ id: r.id, title: r.title }));
```

В `new/page.tsx` (строки 10-21) сейчас нет чтения БД — добавить `findItemsForUser`, `editedId = null` (нет self-фильтра).

### `src/app/(app)/list/page.tsx` (RSC — derivation blocked/dependencyTitle)

**Аналог:** `.map` в самом файле (строки 49-57) — уже приводит каждую строку к примитивам (`total`, `createdAtMs`, `purchasedAtMs`), никаких `Date` через границу (§Pitfall 4).

**Изменение (RESEARCH §Pattern 4):** построить `byId`-Map из `rows`, добавить в объект `.map` два примитива:

```typescript
import { isBlocked } from "@/lib/deps/blocked";

const byId = new Map(rows.map((r) => [r.id, r]));
const items: ListViewItem[] = rows.map((item) => {
  const dep = item.dependsOn ? byId.get(item.dependsOn) : undefined;
  const blocked = isBlocked(item.dependsOn, dep?.purchasedAt ?? null) && item.purchasedAt === null;
  return {
    id: item.id,
    title: item.title,
    total: computeTotal(item, now),
    createdAtMs: item.createdAt.getTime(),
    purchasedAtMs: item.purchasedAt?.getTime() ?? null,
    breakdown: computeBreakdown(item, now),
    blocked,                                                 // boolean
    dependencyTitle: blocked ? (dep?.title ?? null) : null,  // string | null
  };
});
```

Обратить внимание на Pitfall 3: `&& item.purchasedAt === null` — не рисовать lock у купленной.

### `src/lib/list/sort.ts` (utility — расширение типа)

**Аналог:** интерфейс `ListItem` (строки 15-24) — набор примитивов.

**Изменение:** добавить `blocked: boolean` и `dependencyTitle: string | null` в `ListItem`. Компараторы (`byPriority`/`byCreatedAt`/`byTitle`, строки 45-59) НЕ меняются — `blocked` не участвует в сортировке/партиции. `ListViewItem` (`ListView.tsx:29-31`) наследует поля через `ListItem`.

### `src/components/items/AddItemForm.tsx` (component — Select зависимости)

**Аналог:** enum-`Select` FormField'ы (category — строки 201-224, doubts — 382-405). Все идентичны: `<FormField>` → `<Select defaultValue onValueChange>` → `<SelectTrigger className="h-11 w-full text-base">` → `<SelectContent>` с `<SelectItem>`.

**Изменение (RESEARCH §Code Examples):** новый проп `candidates: { id: string; title: string }[]` в сигнатуре компонента (строки 102-110). Новый `FormField name="dependsOn"` встаёт **после «Срок» (deadline, строки 363-380), до «Сомнения» (doubts, 382-405)** (зафиксировано UI-SPEC). Sentinel `"none"` для «Без зависимости» (Radix запрещает пустой value):

```typescript
<FormField control={form.control} name="dependsOn" render={({ field }) => (
  <FormItem>
    <FormLabel>Зависит от покупки</FormLabel>
    <Select
      defaultValue={(field.value as string | null) ?? "none"}
      onValueChange={field.onChange}
      disabled={candidates.length === 0}
    >
      <FormControl>
        <SelectTrigger className="h-11 w-full text-base">
          <SelectValue placeholder={candidates.length === 0 ? "Нет других покупок" : "Выберите покупку (необязательно)"} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="none" className="text-base">Без зависимости</SelectItem>
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-base">{c.title}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
)} />
```

**Ошибка цикла под полем (Pitfall 6):** в `onSubmit` (строки 157-160), где сейчас `if (!res.ok) { setFormError(res.error); }` — добавить ветку `if (res.field) form.setError(res.field, { message: res.error }); else setFormError(res.error);`.

### `src/components/items/PurchaseCheckbox.tsx` (component — disabled при блокировке)

**Аналог:** сам компонент — проп `purchased: boolean` (строки 31-37) уже прокидывается в `Checkbox`; `disabled={isPending}` (строка 77) — паттерн disabled уже применён.

**Изменение:** добавить проп `blocked: boolean`; `disabled={isPending || blocked}` (строка 77). `aria-label` при blocked — «Заблокировано» (тултип НЕ добавляется — UI-SPEC).

### `src/components/items/ItemCard.tsx` + `ListView.tsx` (component — Lock + подпись)

**Аналог:** импорт иконки `import { Pencil } from "lucide-react"` (ItemCard.tsx:2); проп-форвардинг `purchased` в `PurchaseCheckbox` (строка 53).

**Изменение ItemCard:** добавить в сигнатуру (строки 28-40) пропы `blocked: boolean` и `dependencyTitle: string | null`. Форвардить `blocked` в `<PurchaseCheckbox ... blocked={blocked} />`. Рендерить строку с `<Lock className="size-4" />` + «Заблокировано: {dependencyTitle}» ТОЛЬКО при `blocked` (импорт `Lock` добавить в существующий `from "lucide-react"`). Точное размещение — по UI-SPEC.

**Изменение ListView:** пробросить `blocked`/`dependencyTitle` из `item` в оба `<ItemCard>` (строки 64-71 активные, 101-108 архив). В архивной секции `blocked` всегда false (Pitfall 3), но проп передаётся единообразно.

### `src/server/repos/items.iso.test.ts` + `tests/helpers/db.ts` (integration test)

**Аналог iso.test.ts:** структура describe-по-шву (строки 29-42) — `// @vitest-environment node`, `beforeEach(resetDb)`, `afterAll(closeTestDb)`, реальная Postgres.

**Изменения (§Wave 0):**
- Расширить `seedItem` (`db.ts:58-88`) опциональным полем `dependsOn?: string | null` в `fields` и в `.values()` (по образцу `purchasedAt`, строки 70-85).
- Добавить describe-блоки в `iso.test.ts`: FK `onDelete set null` (delete зависимости → `depends_on` = NULL), persist `dependsOn`, IDOR (B ссылается на id покупки A → отклонено), clear→NULL (update с `undefined`/`null`).

## Общие паттерны (cross-cutting)

### Изоляция по userId (Security V4 / AUTH-04)
**Источник:** `src/server/repos/items.ts` — каждый шов принимает `userId` отдельным параметром и кладёт его в `WHERE`/`.values()`; `findItemForUser` (строки 31-37) IDOR-безопасен через `and(eq(id), eq(userId))`.
**Применить к:** всем новым чтениям зависимости. `dependsOn`-кандидат обязан быть проверен на владение (`map.has(candidate)` через `findItemsForUser`) в Server Action — FK владельца НЕ проверяет (Pitfall 2). `userId` ТОЛЬКО из `requireUser()`, никогда из payload.

### Never-trust-client валидация (Security V5)
**Источник:** `createItem`/`updateItem`/`setItemPurchased` — `itemInputSchema.safeParse` на сервере + `purchased === true` строгий boolean.
**Применить к:** `dependsOn` (safeParse) + цикл/владение (в Server Action, не в Zod) + guard блокировки (`setItemPurchased`) как defense-in-depth к `disabled`-UI.

### Результат-объект `{ ok } | { ok:false; error }` + клиентская навигация
**Источник:** `SetPurchasedResult`/`CreateItemResult`/`UpdateItemResult`; actions НЕ редиректят (Pitfall 7), клиент делает `router.refresh()`/`push()`.
**Применить к:** guard блокировки (`{ ok:false, error }`); ошибка цикла — расширенный `{ ok:false, error, field?: "dependsOn" }`. Авто-разблокировка едет на существующем `router.refresh()` в `PurchaseCheckbox`.

### Граница RSC→client только примитивами (§Pitfall 4)
**Источник:** `list/page.tsx:49-57` + `sort.ts` `ListItem` — числа/null/строки, никаких `Date`.
**Применить к:** `blocked: boolean` и `dependencyTitle: string | null` — оба примитивы; `Date` зависимости не пересекает границу.

### CR-01: `undefined` не обнуляет колонку на UPDATE
**Источник:** `updateItemForUser` (`items.ts:53-71`) — `?? null` для каждого nullable-поля.
**Применить к:** `dependsOn: data.dependsOn ?? null` (Pitfall 4). Create-путь не трогать.

## Аналог не найден

Нет. Все 15 точек изменения имеют прямой аналог в кодовой базе Фаз 1–4. Единственная действительно новая логика — два чистых модуля `src/lib/deps/cycle.ts` и `blocked.ts`, но и они опираются на устоявшийся паттерн чистого модуля (`sort.ts`) + тестовый паттерн (`scoring.test.ts`).

## Метаданные

**Область поиска аналогов:** `src/lib/`, `src/server/`, `src/components/items/`, `src/app/(app)/list/`, `drizzle/`, `tests/helpers/`
**Файлов прочитано:** 16 (schema, repos/items, validation/item, 3× actions, 3× page.tsx, AddItemForm, PurchaseCheckbox, ItemCard, ListView, sort, scoring.test, iso.test, db.ts)
**Дата извлечения:** 2026-09-12
</content>
</invoke>
