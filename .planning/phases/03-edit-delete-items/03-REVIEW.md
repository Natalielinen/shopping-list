---
phase: 03-edit-delete-items
reviewed: 2026-08-02T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - e2e/app/delete-item.spec.ts
  - e2e/app/edit-item.spec.ts
  - src/app/(app)/list/[id]/edit/actions.test.ts
  - src/app/(app)/list/[id]/edit/actions.ts
  - src/app/(app)/list/[id]/edit/loading.tsx
  - src/app/(app)/list/[id]/edit/page.tsx
  - src/app/(app)/list/page.tsx
  - src/components/items/AddItemForm.test.tsx
  - src/components/items/AddItemForm.tsx
  - src/components/items/DeleteItemButton.test.tsx
  - src/components/items/DeleteItemButton.tsx
  - src/components/items/ItemCard.tsx
  - src/components/items/ScoreBreakdown.tsx
  - src/components/ui/alert-dialog.tsx
  - src/server/repos/items.iso.test.ts
  - src/server/repos/items.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: resolved
---

# Фаза 3: Отчёт code review

**Дата:** 2026-08-02
**Глубина:** standard
**Проверено файлов:** 16
**Статус:** resolved (три подтверждённых замечания CR-01/WR-01/WR-02 исправлены строго TDD-first, см. «Разрешение» ниже)

## Резюме

Проверена реализация редактирования (ITEM-07) и жёсткого удаления (ITEM-08) на стеке
Next.js 16 + Drizzle + Better Auth.

Сильные стороны, которые подтвердились чтением кода (замечаний не порождают):

- **Изоляция по userId / IDOR закрыты корректно.** Все репозитории
  (`updateItemForUser`, `deleteItemForUser`, `findItemForUser`) скоупят запрос
  `and(eq(items.id, id), eq(items.userId, userId))`; `userId` берётся только из
  серверной сессии (`requireUser`/`getCurrentUser`), никогда из payload. Тесты в
  `items.iso.test.ts` бьют по реальной Postgres и доказывают, что B не может
  прочитать/изменить/удалить покупку A. Server Actions не принимают `userId` из
  аргумента (mass-assignment невозможен).
- **Перевод рубли→копейки происходит ровно один раз** на write-пути
  (`actions.ts`), схема валидирует рубли без `.transform`, prefill делит на 100 —
  двойного умножения нет.
- **Поведение AlertDialog корректно:** `e.preventDefault()` в `AlertDialogAction`
  удерживает диалог открытым до завершения async; при ошибке диалог остаётся,
  показывает текст; «Отмена» не вызывает `deleteItem`; pending-guard защищает от
  двойного клика. Всё покрыто тестами.

Однако найден блокирующий дефект в write-пути обновления: **нельзя очистить ни одно
необязательное поле при редактировании**, а снятие «в кредит» оставляет в БД
устаревший `monthlyPayment` — противоречивое состояние. Ни один тест этот сценарий
не покрывает.

## Критичные

### CR-01 [РАЗРЕШЕНО]: `updateItemForUser` не может очистить nullable-поля — `undefined` игнорируется Drizzle, снятие «в кредит» оставляет устаревший `monthlyPayment`

**Файл:** `src/server/repos/items.ts:44-55` (корень), `src/app/(app)/list/[id]/edit/actions.ts:40-51` (источник `undefined`)

**Проблема:**
Схема (`src/lib/validation/item.ts`) превращает пустые необязательные поля
(`link`, `description`, `price`, `deadline`, `monthlyPayment`) в `undefined`
(preprocess `"" → undefined`). В `updateItem` эти значения без изменений уходят в
`updateItemForUser`, который вызывает `db.update(items).set(data)`.

Drizzle **исключает ключи со значением `undefined`** из сгенерированного SQL
`UPDATE` (это штатное поведение `.set()`/`.values()` — чтобы обнулить колонку,
нужно передать `null`, а не `undefined`). Последствия при редактировании:

1. Пользователь очищает ранее заданную цену/срок/ссылку/описание и жмёт
   «Сохранить» — колонка в БД **не меняется**, старое значение остаётся. Удалить
   значение через форму невозможно.
2. Снятие галочки «в кредит» отправляет `monthlyPayment: undefined` (форма делает
   `setValue("monthlyPayment", undefined)`), но UPDATE эту колонку **не трогает** →
   в БД остаётся `isCredit = false` вместе со **старым** `monthlyPayment`.
   Противоречивое персистентное состояние (комментарий в `AddItemForm.tsx:409-412`
   утверждает, что поле «очищается», но на сервере при update это не так).

В create-пути (`createItemForUser` → `.values()`) баг не проявляется: `undefined`
на INSERT даёт `NULL` (дефолт колонки). Дефект специфичен именно для update —
головной фичи фазы. Тесты (`actions.test.ts`, `items.iso.test.ts`) проверяют только
установку значений, ни один не проверяет их снятие, поэтому баг прошёл незамеченным.

**Исправление:**
Нормализовать `undefined → null` для nullable-колонок именно на write-пути update,
чтобы UPDATE явно обнулял их. Например в `actions.ts`:

```ts
const toKopecks = (rubles: number | undefined): number | null =>
  rubles === undefined ? null : Math.round(rubles * 100);

await updateItemForUser(user.id, id, {
  ...rest,
  link: rest.link ?? null,
  description: rest.description ?? null,
  deadline: rest.deadline ?? null,
  price: toKopecks(price),
  monthlyPayment: toKopecks(monthlyPayment),
});
```

(Тип `ItemInsertData` должен допускать `null` для nullable-колонок — у Drizzle он
их допускает.) Обязательно добавить тест в `items.iso.test.ts`: создать покупку с
`price`/`monthlyPayment`, обновить с пустыми значениями, проверить, что в БД
`null`.

## Предупреждения

### WR-01 [РАЗРЕШЕНО]: Server Actions игнорируют `null` из репозитория — no-op update/delete чужой/несуществующей покупки рапортует об успехе

**Файл:** `src/app/(app)/list/[id]/edit/actions.ts:47-52` (update), `66-73` (delete)

**Проблема:**
`updateItemForUser`/`deleteItemForUser` спроектированы так, чтобы при несовпадении
владельца или отсутствии строки вернуть `null` (WHERE не находит строку). Оба
Server Actions **игнорируют возвращаемое значение** и безусловно возвращают
`{ ok: true }`. В результате попытка обновить/удалить несуществующую или чужую
покупку (например при устаревшем клиенте, гонке с удалением, или прямом вызове
экшена) сообщает клиенту об успехе, и он навигирует на `/list`, хотя ничего не
изменилось. Это не дыра в безопасности (данные не тронуты), но некорректный
контракт: сигнал «no-op», ради которого репозитории возвращают `null`,
отбрасывается.

**Исправление:** Проверять результат и возвращать ошибку/`notFound`-семантику при
`null`:

```ts
const row = await updateItemForUser(user.id, id, { ... });
if (!row) return { ok: false, error: SAVE_ERROR };
return { ok: true };
```

Аналогично для `deleteItem`.

### WR-02 [РАЗРЕШЕНО]: Форма не сбрасывает `monthlyPayment` при submit, если `isCredit` был снят на момент загрузки

**Файл:** `src/components/items/AddItemForm.tsx:130-158`, `398-446`

**Проблема:**
Скрытие `monthlyPayment` завязано только на обработчик `onCheckedChange` чекбокса.
Если форма открывается в edit-режиме с `isCredit=false`, но `monthlyPayment` присутствует
в `initialValues` (достижимо из-за противоречивого состояния по CR-01), поле не
рендерится, обработчик снятия не срабатывает, а RHF по умолчанию
(`shouldUnregister: false`) сохраняет значение в state и **отправляет его на
submit**. Таким образом устаревший `monthlyPayment` будет повторно записан, хотя
покупка не в кредит.

**Исправление:** На submit принудительно очищать `monthlyPayment`, когда
`!isCredit`, не полагаясь только на обработчик чекбокса:

```ts
async function onSubmit(values: ItemInput) {
  const payload = values.isCredit
    ? values
    : { ...values, monthlyPayment: undefined };
  // ... отправлять payload
}
```

## Инфо

### IN-01: Дублирование строковых констант ошибок

**Файл:** `src/app/(app)/list/[id]/edit/actions.ts:19,62`; `src/components/items/DeleteItemButton.tsx:24`; `src/components/items/AddItemForm.tsx:114`

**Проблема:** Тексты `"Не удалось сохранить изменения…"` и `"Не удалось удалить
покупку…"` продублированы между Server Action и клиентскими компонентами. При
правке копирайта легко рассинхронизировать.

**Исправление:** Вынести тексты в общий модуль констант (например
`src/lib/copy/errors.ts`) и импортировать в обоих местах.

### IN-02: Отсутствует верхняя граница длины у `title`/`description`/`link`

**Файл:** `src/lib/validation/item.ts:64,60-61,44-47`

**Проблема:** `title` имеет только `.min(1)`, `description` и `link` не ограничены
сверху. Колонки `text` в Postgres не ограничены, поэтому можно записать сколь
угодно длинную строку — мягкий пробел во входной валидации (качество/устойчивость).

**Исправление:** Добавить разумные `.max(...)` (например title 200, description
2000) с текстами ошибок из UI-SPEC.

---

## Разрешение

**Дата:** 2026-08-02. Три подтверждённых замечания исправлены строго TDD-first
(сначала падающий RED-тест, затем GREEN-фикс, отдельными коммитами). Замечания
уровня «Инфо» (IN-01/IN-02) осознанно оставлены как есть — вне объёма правки.

### CR-01 — очистка nullable-полей на update

- **RED:** `src/server/repos/items.iso.test.ts` — реальная Postgres: создать
  покупку с `link/description/deadline/price/monthlyPayment`, обновить пустыми
  значениями (`undefined`), проверить, что колонки стали `null`; отдельно —
  снятие «в кредит» обнуляет `monthly_payment`; guard: легитимный `price:0`
  сохраняется.
- **GREEN:** `src/server/repos/items.ts` — `updateItemForUser` нормализует
  `undefined → null` для nullable-колонок прямо в `.set({...})` через `?? null`.
  Это единый write-шов обновления, поэтому фикс работает для всех вызывающих.
  `?? null` безопасен для денег (`0` не nullish → сохраняется). Create-путь
  (`.values()`) не тронут.

### WR-01 — no-op update/delete больше не рапортует об успехе

- **RED:** `src/app/(app)/list/[id]/edit/actions.test.ts` — мок репозитория
  возвращает `null`; `updateItem`/`deleteItem` обязаны вернуть `{ ok: false }` с
  существующими текстами `SAVE_ERROR`/`DELETE_ERROR`.
- **GREEN:** `src/app/(app)/list/[id]/edit/actions.ts` — оба экшена проверяют
  результат репозитория и при `null` (WHERE не нашёл строку: не найдено или не
  принадлежит пользователю сессии) возвращают `{ ok: false }`. Скоупинг по
  `userId` не ослаблен.

### WR-02 — устаревший `monthlyPayment` не уходит на submit без кредита

- **RED:** `src/components/items/AddItemForm.test.tsx` — edit-форма с
  противоречивым `initialValues` (`isCredit:false` + `monthlyPayment:"50"`):
  submit не должен слать `monthlyPayment`.
- **GREEN:** `src/components/items/AddItemForm.tsx` — `onSubmit` формирует
  payload, отбрасывающий `monthlyPayment`, когда `isCredit` ложно, независимо от
  хендлера чекбокса. Устраняет проблему `shouldUnregister:false` для create и
  edit путей.

### Верификация (всё зелёное)

- `npx vitest run` — 13 файлов, 160 тестов passed.
- `npx playwright test` — 10 e2e passed (включая edit/delete specs).
- `npx tsc --noEmit` — без ошибок.
- eslint по изменённым файлам — 0 errors (1 pre-existing warning на `form.watch`).

---

_Проверено: 2026-08-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Глубина: standard_
_Разрешение: 2026-08-02 (TDD-first, отдельные коммиты test(03)/fix(03))_
