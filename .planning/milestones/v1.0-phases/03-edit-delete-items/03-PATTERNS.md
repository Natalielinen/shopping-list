# Phase 3: Редактирование и удаление покупок — Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 7 (4 новых + 3 модифицируемых + 1 shadcn copy-in)
**Analogs found:** 7 / 7 (все имеют прямой аналог в кодовой базе Фазы 2)

Эта фаза — тонкое **расширение** Фазы 2. Ни одного зелёного поля: каждый новый файл зеркалит существующий шов create/read. Планировщик должен копировать паттерны буквально, меняя только глагол операции (insert→update/delete, create→edit) и user-facing копирайт.

---

## File Classification

| Новый/Изменяемый файл | Роль | Data Flow | Ближайший аналог | Match |
|-----------------------|------|-----------|------------------|-------|
| `src/app/(app)/list/[id]/edit/actions.ts` (new) — `updateItem`, `deleteItem` | server action | request-response (write, CRUD U/D) | `src/app/(app)/list/new/actions.ts` (`createItem`) | exact |
| `src/server/repos/items.ts` (modify) — `findItemForUser`, `updateItemForUser`, `deleteItemForUser` | repository / data-access | CRUD (read-one / update / delete) | тот же файл: `createItemForUser` / `findItemsForUser` | exact |
| `src/app/(app)/list/[id]/edit/page.tsx` (new) — RSC-обёртка edit | route (RSC page) | request-response (read-one → prefill) | `src/app/(app)/list/new/page.tsx` + `src/app/(app)/list/page.tsx` | exact / role-match |
| `src/components/items/AddItemForm.tsx` (modify) — режим create/edit | component (client-leaf form) | request-response (form submit) | тот же файл (текущий create-only) | exact |
| `src/components/items/DeleteItemButton.tsx` (new) — client-leaf + AlertDialog | component (client-leaf) | event-driven (click → confirm → action) | `src/components/app/LogoutButton.tsx` | role-match |
| `src/components/items/ItemCard.tsx` (modify) — иконки edit/delete | component (RSC) | request-response (render) | тот же файл (текущая карточка) | exact |
| `src/components/ui/alert-dialog.tsx` (new) — shadcn copy-in | config / ui-primitive | — | `src/components/ui/alert.tsx` и прочие shadcn-примитивы Фазы 2 | role-match |

---

## Pattern Assignments

### `src/app/(app)/list/[id]/edit/actions.ts` — `updateItem` / `deleteItem` (server action, CRUD U/D)

**Analog:** `src/app/(app)/list/new/actions.ts` (`createItem`, строки 1-52) — копировать целиком, зеркалить.

**Ключевые инварианты аналога, которые ОБЯЗАНЫ повториться:**
- `"use server"` в шапке (строка 1).
- `userId` — только из `requireUser()` (строка 24), НИКОГДА из payload (mass-assignment, T-2-01/V4).
- Серверная ре-валидация `itemInputSchema.safeParse(input)` (строки 27-30) даже при клиентском RHF-resolver (never-trust-client, V5).
- Перевод рубли→копейки `Math.round(rubles * 100)` РОВНО здесь, единственный write-путь (строки 36-38, BL-01) — тот же хелпер `toKopecks` нужен и в `updateItem`.
- Возврат `{ ok: true } | { ok: false; error }` (строка 20); НЕ `redirect()` в try/catch (Pitfall 7, строки 15-17) — навигация на клиенте.
- try/catch вокруг записи → форм-левел ошибка (строки 40-51).

**Imports pattern** (копировать, добавив delete-репо):
```typescript
"use server";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { requireUser } from "@/server/auth/current-user";
import { updateItemForUser, deleteItemForUser } from "@/server/repos/items";
```

**Core pattern для `updateItem(id, input)`** (зеркало `createItem`, строки 22-52):
```typescript
const SAVE_ERROR = "Не удалось сохранить изменения. Попробуйте ещё раз."; // UI-SPEC: отличается от create-копии

export type UpdateItemResult = { ok: true } | { ok: false; error: string };

export async function updateItem(id: string, input: ItemInput): Promise<UpdateItemResult> {
  const user = await requireUser();

  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: SAVE_ERROR };
  }

  const { price, monthlyPayment, ...rest } = parsed.data;
  const toKopecks = (rubles: number | undefined): number | undefined =>
    rubles === undefined ? undefined : Math.round(rubles * 100);

  try {
    await updateItemForUser(user.id, id, {
      ...rest,
      price: toKopecks(price),
      monthlyPayment: toKopecks(monthlyPayment),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}
```

**Core pattern для `deleteItem(id)`** (D-06 — без payload-валидации, только scoping):
```typescript
const DELETE_ERROR = "Не удалось удалить покупку. Попробуйте ещё раз."; // UI-SPEC

export type DeleteItemResult = { ok: true } | { ok: false; error: string };

export async function deleteItem(id: string): Promise<DeleteItemResult> {
  const user = await requireUser();
  try {
    await deleteItemForUser(user.id, id);
    return { ok: true };
  } catch {
    return { ok: false, error: DELETE_ERROR };
  }
}
```

> Примечание планировщику: расположение файла — Claude's Discretion (D-09). Рекомендация — рядом с маршрутом `src/app/(app)/list/[id]/edit/actions.ts`, либо переиспользовать общий `src/app/(app)/list/new/actions.ts`. Ключевое — паттерн, не путь.

---

### `src/server/repos/items.ts` — `findItemForUser` / `updateItemForUser` / `deleteItemForUser` (repository, CRUD)

**Analog:** тот же файл, `findItemsForUser` (строки 11-13) + `createItemForUser` (строки 19-25). Расширяем **тем же файлом**.

**Инвариант шва изоляции (строки 8-10, 15-18):** `userId` — обязательный первый параметр, попадает в каждый WHERE; забыть изоляцию в вызывающем коде нельзя (Anti-Pattern 3 / AUTH-04). Все три новых запроса скоупятся `and(eq(items.id, id), eq(items.userId, userId))`.

**Текущий импорт** (строки 1-6) — добавить `and` к `eq`:
```typescript
import { and, eq } from "drizzle-orm";
```

**find-one pattern** (зеркало `findItemsForUser`, но одна строка + scoping по id):
```typescript
export async function findItemForUser(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)));
  return row ?? null; // null → RSC-обёртка вызовет notFound() (D-09)
}
```

**update pattern** (тип данных — тот же `ItemInsertData`, что у `createItemForUser`):
```typescript
export async function updateItemForUser(
  userId: string,
  id: string,
  data: ItemInsertData
) {
  const [row] = await db
    .update(items)
    .set(data)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}
```

**delete pattern** (hard delete, D-05):
```typescript
export async function deleteItemForUser(userId: string, id: string) {
  const [row] = await db
    .delete(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}
```

> `ItemInsertData` (`src/server/db/schema.ts:171`) = `Omit<NewItem, "id" | "userId" | "createdAt">` — переиспользуется как тип `data` для update без изменений.

---

### `src/app/(app)/list/[id]/edit/page.tsx` — RSC-обёртка edit (route, read-one → prefill)

**Analog:** `src/app/(app)/list/new/page.tsx` (структура обёртки, строки 10-21) + `src/app/(app)/list/page.tsx` (паттерн `getCurrentUser` + read через репо, строки 18-23).

**Паттерн защиты + загрузки** (композиция двух аналогов):
```typescript
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemForUser } from "@/server/repos/items";
import { AddItemForm } from "@/components/items/AddItemForm";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // как new/page.tsx:13 и list/page.tsx:21

  const item = await findItemForUser(user.id, id);
  if (!item) notFound(); // чужая/несуществующая → 404 (D-09 / UI-SPEC)

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Редактировать покупку</h1>
      <AddItemForm mode="edit" itemId={item.id} initialValues={/* см. ниже */} />
    </div>
  );
}
```

**Prefill (D-02, критично):** `price`/`monthlyPayment` хранятся в копейках (`integer`), форма работает в рублях → делить на 100 при передаче в `initialValues`; `deadline` — `Date` → в строку `YYYY-MM-DD` для `<input type="date">`. Пример маппинга:
```typescript
initialValues={{
  title: item.title,
  category: item.category,
  urgency: item.urgency,
  need: item.need,
  benefit: item.benefit,
  doubts: item.doubts,
  isCredit: item.isCredit,
  link: item.link ?? "",
  description: item.description ?? "",
  price: item.price == null ? "" : String(item.price / 100),
  monthlyPayment: item.monthlyPayment == null ? "" : String(item.monthlyPayment / 100),
  deadline: item.deadline ? item.deadline.toISOString().slice(0, 10) : "",
}}
```

> Layout-обёртка (`mx-auto max-w-md … px-4 py-6`) и заголовок Display 24/600 (`text-2xl font-semibold`) идентичны `new/page.tsx:16-17`; меняется только текст на «Редактировать покупку» (UI-SPEC Copywriting).

---

### `src/components/items/AddItemForm.tsx` — режим create/edit (component, form submit)

**Analog:** тот же файл (текущий create-only, строки 1-446). Расширяется props'ами, не переписывается.

**Текущее submit-ядро** (строки 113-135) — паттерн, который надо разветвить по `mode`:
```typescript
async function onSubmit(values: ItemInput) {
  setFormError(null);
  let res: CreateItemResult;
  try {
    res = await createItem(values);
  } catch {
    setFormError("Не удалось сохранить покупку. Попробуйте ещё раз.");
    return;
  }
  if (!res.ok) { setFormError(res.error); return; }
  router.refresh();   // ВАЖНО: refresh ДО push (строки 129-134) — иначе push отменяется
  router.push("/list");
}
```

**Дельты для edit-режима** (D-01, UI-SPEC §Дельты):
- Новые опциональные props: `mode?: "create" | "edit"` (default `"create"`), `itemId?: string`, `initialValues?: Partial<ItemFormInput>`.
- `useForm({ defaultValues: { title: "", doubts: "sure", isCredit: false, ...initialValues } })` — расширить строку 104 спредом initialValues.
- В `onSubmit`: при `mode === "edit"` вызывать `updateItem(itemId, values)` вместо `createItem`; текст форм-левел ошибки — `"Не удалось сохранить изменения. Попробуйте ещё раз."` (UI-SPEC).
- Успех edit: тот же `router.refresh()` + `router.push("/list")` (D-07) — без изменений.
- Submit-лейбл (строка 432): `mode === "edit" ? "Сохранить" : "Добавить покупку"`.
- Заголовок страницы НЕ здесь (он в RSC-обёртке) — форма его не рендерит.
- Всё остальное (поля, Select-мапы, условный `monthlyPayment` по `isCredit` строки 402-423, pending-защита `isSubmitting`, `Отмена` → `/list`, `Loader2`) — **без изменений** (единая форма, D-01).

> `monthlyPayment`-видимость (строки 111, 402) работает через `form.watch("isCredit")` — при prefill `isCredit: true` поле сразу видно, ничего доделывать не нужно.

---

### `src/components/items/DeleteItemButton.tsx` — client-leaf + AlertDialog (component, event-driven)

**Analog:** `src/components/app/LogoutButton.tsx` (строки 1-43) — client-leaf с `useRouter` + `useState(isPending)` + async-обработчик + try/catch. AlertDialog-обвязка — из нового shadcn-примитива.

**Паттерн client-leaf из LogoutButton** (строки 15-31) — тот же каркас state/handler:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

import { deleteItem, type DeleteItemResult } from "@/app/(app)/list/[id]/edit/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function DeleteItemButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsPending(true);
    setError(null);
    let res: DeleteItemResult;
    try {
      res = await deleteItem(id);
    } catch {
      setError("Не удалось удалить покупку. Попробуйте ещё раз.");
      setIsPending(false);
      return;
    }
    if (!res.ok) { setError(res.error); setIsPending(false); return; }
    setOpen(false);
    router.refresh(); // обновляет RSC-список, покупка исчезает (D-07)
  }
  // ... разметка ниже
}
```

**Разметка AlertDialog** (UI-SPEC §Copywriting + §Component Behaviour):
```tsx
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogTrigger asChild>
    <Button
      type="button" variant="ghost" size="icon"
      aria-label="Удалить покупку"
      className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive"
    >
      <Trash2 className="size-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="text-xl font-semibold">Удалить покупку?</AlertDialogTitle>
      <AlertDialogDescription className="text-base">
        Действие необратимо — восстановить покупку будет нельзя.
      </AlertDialogDescription>
    </AlertDialogHeader>
    {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
      <AlertDialogAction
        onClick={(e) => { e.preventDefault(); handleDelete(); }}
        disabled={isPending}
        className="bg-destructive text-white hover:bg-destructive/90"
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        Удалить
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Важные детали из UI-SPEC:**
- `Отмена` — начальный фокус (безопасный выбор), `variant="outline"` даёт сам `AlertDialogCancel`.
- `Удалить` — filled destructive (красный фон, белый текст) — единственное filled-destructive место фазы.
- `onClick` на `AlertDialogAction` требует `e.preventDefault()`, иначе Radix закроет диалог до завершения async (при ошибке диалог должен остаться открыт — UI-SPEC S3 error).
- delete-иконка на карточке нейтральна в покое (`text-muted-foreground`), красная на hover/focus.

---

### `src/components/items/ItemCard.tsx` — иконки edit/delete (component, RSC)

**Analog:** тот же файл (строки 1-36). Карточка остаётся RSC; интерактив уходит в client-leaf `DeleteItemButton` и `Link` (edit).

**Текущая структура** (строки 24-34) — добавить ряд действий внутри `CardContent`:
```tsx
<Card>
  <CardContent className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-xl font-semibold">{title}</span>
      <PriorityBadge total={total} />
    </div>
    {/* ScoreBreakdown / Collapsible — триггер делит ряд с иконками (UI-SPEC) */}
    <div className="flex items-center gap-1">
      <ScoreBreakdown breakdown={breakdown} total={total} /> {/* trigger: flex-1 min-w-0 h-11 */}
      <Button asChild variant="ghost" size="icon"
        aria-label="Редактировать покупку"
        className="h-11 w-11 shrink-0 text-muted-foreground">
        <Link href={`/list/${id}/edit`}><Pencil className="size-4" /></Link>
      </Button>
      <DeleteItemButton id={id} />
    </div>
  </CardContent>
</Card>
```

**Обязательное изменение сигнатуры:** карточка сейчас принимает только `{ title, total, breakdown }` (строки 14-22) — добавить `id: string`. Родитель `src/app/(app)/list/page.tsx:59` уже имеет `item.id` (`key={item.id}`), нужно прокинуть `id={item.id}` в `<ItemCard>`.

**Раскладка (UI-SPEC §Component Behaviour, критично для цели фазы):**
- Иконки — соседи триггера разбивки в одном flex-ряду (`gap-1`), но **отдельные `Button`**, НЕ вложены в триггер → тап по иконке не переключает `Collapsible` (решение коллизии LIST-07).
- Иконки НЕ в ряду заголовка → не вытесняют badge, не сокращают `truncate` у title.
- Порядок: разбивка → edit → **delete последней** (деструктивное — крайнее, ниже риск случайного тапа).
- glyph `size-4`, тач-цель `h-11 w-11` (44px).

> Проверить фактическую разметку `ScoreBreakdown`/`Collapsible` — триггер должен получить `flex-1 min-w-0 h-11`, чтобы делить ряд с `shrink-0` иконками (аналог не читался в этом проходе; планировщик читает `src/components/items/ScoreBreakdown.tsx` при реализации). Альтернатива (reversible): выделенный футер-ряд под `CollapsibleContent`.

---

### `src/components/ui/alert-dialog.tsx` — shadcn copy-in (ui-primitive)

**Analog:** прочие shadcn-примитивы Фазы 2 (`src/components/ui/alert.tsx`, `button.tsx`, `select.tsx` — установлены тем же CLI).

**Как добавить (D-05, UI-SPEC §Registry Safety):**
```bash
npx shadcn@latest add alert-dialog
```
- Официальный реестр shadcn (`components.json` → `registries: {}`), vetting-gate неприменим.
- `Dialog` в проекте НЕ используется — берётся именно `AlertDialog` (семантика `role="alertdialog"`, фокус-ловушка, встроенная доступность Radix).
- Файл `components.json` уже инициализирован в Фазе 2 (`shadcn_initialized: true`) — CLI кладёт компонент в `src/components/ui/alert-dialog.tsx` автоматически, ручных правок примитива не требуется.

---

## Shared Patterns

### Изоляция по userId (AUTH-04 / шов из Фазы 1)
**Источник:** `src/server/auth/current-user.ts` (`requireUser`, строки 17-21) + `src/server/repos/items.ts` (WHERE по userId).
**Применить к:** всем трём server actions (`updateItem`/`deleteItem`) и всем трём репо-функциям.
```typescript
const user = await requireUser();          // userId ТОЛЬКО из сессии, никогда из payload
// ... .where(and(eq(items.id, id), eq(items.userId, user.id)))
```
Чужую/несуществующую покупку нельзя открыть, сохранить или удалить (SC-3, D-09).

### Server Action → { ok } + клиентская навигация (Pitfall 7)
**Источник:** `src/app/(app)/list/new/actions.ts` (строки 15-20, 40-51).
**Применить к:** `updateItem`, `deleteItem`.
Action НЕ вызывает `redirect()` внутри try/catch (NEXT_REDIRECT был бы пойман); возвращает `{ ok: true } | { ok: false; error }`, навигацию делает клиент (`router.refresh()` до `router.push()` — порядок важен, AddItemForm строки 129-134).

### Деньги: рубли↔копейки (BL-01)
**Источник:** `src/app/(app)/list/new/actions.ts` (`toKopecks`, строки 36-38) + `src/lib/validation/item.ts` (`optionalRubles`, строки 29-40).
**Применить к:** `updateItem` (рубли→копейки при записи, ×100 один раз на сервере) и prefill edit-обёртки (копейки→рубли, ÷100 при передаче в форму). Схема валидирует рубли; двойной transform (RHF+сервер) запрещён — перевод строго в write-пути.

### Пересчёт приоритета — «бесплатный» (SCORE-05, D-08)
**Источник:** `src/app/(app)/list/page.tsx` (строки 42-53) — `total` считается на чтении из текущей даты.
**Применить к:** ничего дополнительного. После edit `router.refresh()` перерендерит `/list`, `computeTotal(item, now)` даст новый приоритет и позицию сортировки автоматически — отдельной логики инвалидации не требуется.

### Валидация — единая схема (never-trust-client, V5)
**Источник:** `src/lib/validation/item.ts` (`itemInputSchema`, строки 63-78).
**Применить к:** `updateItem` (`safeParse` на сервере) и `AddItemForm` в edit-режиме (тот же `zodResolver`). Валидация edit == валидация create, схема переиспользуется целиком.

---

## No Analog Found

Файлов без аналога нет — фаза полностью покрыта паттернами Фазы 2.

---

## Metadata

**Analog search scope:** `src/app/(app)/list/**`, `src/server/repos/`, `src/server/auth/`, `src/server/db/`, `src/components/items/`, `src/components/app/`, `src/lib/validation/`.
**Files scanned:** 10 (actions, items-repo, new/page, list/page, AddItemForm, ItemCard, LogoutButton, current-user, schema, item-validation).
**Pattern extraction date:** 2026-08-02.
</content>
</invoke>
