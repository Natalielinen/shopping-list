---
phase: 04-list-sort-filter-archive
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - drizzle/0002_tranquil_slapstick.sql
  - e2e/app/purchase-archive.spec.ts
  - src/app/(app)/layout.tsx
  - src/app/(app)/list/actions.ts
  - src/app/(app)/list/page.tsx
  - src/components/items/ItemCard.tsx
  - src/components/items/ListControls.test.tsx
  - src/components/items/ListControls.tsx
  - src/components/items/ListView.tsx
  - src/components/items/PurchaseCheckbox.tsx
  - src/components/ui/sonner.tsx
  - src/lib/list/sort.test.ts
  - src/lib/list/sort.ts
  - src/server/db/schema.ts
  - src/server/repos/items.iso.test.ts
  - src/server/repos/items.ts
  - tests/helpers/db.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
resolution: "WR-01 (mass-assignment defense-in-depth) исправлено в 89d75ef — purchasedAt добавлен в Omit ItemInsertData. Осталось 2 INFO (косметика): дублирование STATUS_ERROR, undo-тост на размонтированном компоненте (функционально работает)."
---

# Фаза 4: Отчёт code review

**Проверено:** 2026-08-09
**Глубина:** standard
**Файлов проверено:** 18
**Статус:** issues_found

## Summary

Проверен срез Фазы 4 (сортировка / фильтр / архив «куплено»): аддитивная миграция
колонки `purchased_at`, write-шов `setItemPurchasedForUser` со скоупингом по
`userId`, Server Action `setItemPurchased`, оптимистичный `PurchaseCheckbox`,
клиентские `ListView` / `ListControls` с эфемерным `useState` и чистые компараторы
`sort.ts`.

Оба риск-класса, на которые указывал бриф, закрыты корректно:

- **IDOR / изоляция:** `setItemPurchasedForUser` скоупит UPDATE через
  `and(eq(items.id, id), eq(items.userId, userId))`; чужая/несуществующая строка
  даёт пустой `.returning()` → `null` (no-op). `setItemPurchased` берёт `userId`
  ТОЛЬКО из `requireUser()`, а `purchased` приводит к строгому boolean
  (`purchased === true`) — payload не может подменить владельца. Изоляция покрыта
  реальным Postgres-тестом (`items.iso.test.ts`, describe `setItemPurchasedForUser`).
- **Ложный успех при no-op (класс WR-01 из Фазы 3):** `setItemPurchased` при
  `row === null` возвращает `{ ok: false, error }`, а не рапортует успех
  (`actions.ts:38`). То же поведение зеркалит `updateItem`/`deleteItem`.

Оптимистичный UI выстроен по документированному паттерну (`setOptimistic` →
`await` action → `router.refresh()` внутри одной `startTransition`), откат при
ошибке происходит естественно (базовое значение — проп `purchased`), а `sort.ts`
чист, детерминирован (tiebreaker по `id`, архив всегда по `purchasedAt` убыв.) и не
мутирует вход. Миграция аддитивна и nullable без default. Блокеров не найдено.

Ниже — одно предупреждение по устойчивости типов и две заметки по качеству.

## Warnings

### WR-01: `ItemInsertData` больше не исключает серверно-управляемый `purchasedAt`

**Файл:** `src/server/db/schema.ts:177`
**Issue:** Тип данных для write-швов определён как
`Omit<NewItem, "id" | "userId" | "createdAt">`. После добавления колонки в Фазе 4
`purchasedAt` тоже стал серверно-управляемым полем (пишется ИСКЛЮЧИТЕЛЬНО через
`setItemPurchasedForUser`), однако он НЕ исключён из `ItemInsertData` и потому
формально входит в data-параметр `createItemForUser`/`updateItemForUser`. Комментарий
в самом файле (строки 174–177) перечисляет серверно-управляемый набор как
`id/userId/createdAt` — `purchasedAt` из этого инварианта выпал.

На текущий момент это НЕ эксплуатируется: оба вызова репозитория идут через
`itemInputSchema.safeParse` (`new/actions.ts`, `[id]/edit/actions.ts`), а
`z.object({...})` по умолчанию срезает неизвестные ключи, поэтому присланный извне
`purchasedAt` до `.values()`/`.set()` не доезжает. Это защита-в-глубину и
консистентность инварианта: любой будущий вызов write-шва в обход Zod-гейта
(seed-хелпер, admin-путь, снятие `.strict()`/переход на `.passthrough()`) откроет
mass-assignment статуса «куплено» на create/update.

**Fix:** выровнять тип с фактическим набором серверно-управляемых полей —
```ts
export type ItemInsertData = Omit<
  NewItem,
  "id" | "userId" | "createdAt" | "purchasedAt"
>;
```
Обновить и комментарий, перечислив `purchasedAt` среди серверно-управляемых полей.

## Info

### IN-01: Константа `STATUS_ERROR` продублирована в двух модулях

**Файл:** `src/app/(app)/list/actions.ts:20`, `src/components/items/PurchaseCheckbox.tsx:10`
**Issue:** Один и тот же текст «Не удалось обновить статус. Попробуйте ещё раз.»
объявлен независимо на сервере (возвращается в `error`) и на клиенте (передаётся в
`toast.error`). При этом клиент уже получает `res.error` от action, но игнорирует
его в пользу локальной копии. Расхождение текстов при правке одного места пройдёт
незаметно.
**Fix:** показывать пришедший `res.error` (`toast.error(res.error)`) либо вынести
строку в общий модуль сообщений и импортировать в обоих местах.

### IN-02: Undo из тоста после размонтирования последней активной карточки

**Файл:** `src/components/items/PurchaseCheckbox.tsx:52-55`
**Issue:** При фильтре ВЫКЛ отметка последней активной покупки убирает карточку из
списка → `PurchaseCheckbox` размонтируется. Кнопка «Отменить» в тосте (смонтирован
в `layout.tsx`) вызывает `toggle(false)`, то есть `startTransition`/`setOptimistic`
уже размонтированного компонента. Функционально путь работает (server action +
`router.refresh()` глобального роутера всё равно выполняются, что подтверждает e2e
`purchase-archive.spec.ts`), а React 18/19 не предупреждает об обновлении стейта
после размонтирования, поэтому дефекта поведения нет. Заметка на будущее: логика
undo намеренно опирается на побочные эффекты вне жизненного цикла компонента.
**Fix:** не требуется для v1; при желании повысить устойчивость — вынести действие
undo в родитель (`ListView`), который не размонтируется вместе с карточкой.

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
