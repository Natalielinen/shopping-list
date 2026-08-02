# Phase 3: Редактирование и удаление покупок - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Авторизованный пользователь может открыть свою существующую покупку, изменить любое поле и сохранить (приоритет пересчитывается автоматически), либо удалить покупку. Редактирование и удаление затрагивают только покупки самого пользователя.

**В охвате:**
- Редактирование покупки: переиспользование формы добавления в edit-режиме с предзаполнением полей; обновление через слой данных со scoping по `userId` (ITEM-07).
- Удаление покупки с явным подтверждением; жёсткое удаление, покупка исчезает из списка (ITEM-08).
- Вход в редактирование/удаление с карточки покупки в списке.
- Пересчёт приоритета после редактирования (автоматический — `total` считается на чтении, SCORE-05 из Фазы 2).
- Изоляция: открыть/сохранить/удалить можно только свою покупку.

**Вне охвата (другие фазы):**
- Отметка «куплено» (completed), уход в архив, фильтр «показывать купленные», переключатели сортировки — Фаза 4 (LIST-01…05, LIST-08).
- Зависимости (`depends`) и каскад/блокировка при удалении покупки, от которой зависят другие — Фаза 5 (ITEM-06, DEP-01, DEP-02). В Фазе 3 `depends` ещё не существует.
- Undo / мягкое удаление / восстановление — рассмотрено, не выбрано.

</domain>

<decisions>
## Implementation Decisions

### Форма редактирования
- **D-01:** Переиспользовать `AddItemForm` (Фаза 2) в едином режиме create/edit — форма принимает опциональные начальные значения (`initialValues`) + признак режима; edit живёт на отдельной странице `/list/[id]/edit` (RSC-обёртка грузит покупку по `id` + `userId`, предзаполняет форму). Приоритет отсутствия дублирования и единой Zod-валидации. — **Reversibility:** reversible.
- **D-02:** `price` / `monthlyPayment` при предзаполнении показываются в **рублях** (÷100 из хранимых копеек), при сохранении конвертируются обратно в копейки (`Math.round(×100)` один раз на сервере — как в create, BL-01). `monthlyPayment` виден условно по `isCredit` (ITEM-04). — **Reversibility:** reversible.
- **D-03:** Новый Server Action `updateItem(id, input)` — `requireUser()`, `itemInputSchema.safeParse(input)`, обновление через новый `updateItemForUser(userId, id, data)` со scoping по `userId` (never-trust-client, зеркалит `createItem`). Возвращает `{ ok }`; навигация на клиенте. — **Reversibility:** reversible.

### Вход «изменить/удалить» с карточки
- **D-04:** На карточке покупки — **явные иконки**: «карандаш» (edit → `/list/[id]/edit`) и «корзина» (delete → подтверждение). lucide + `Button`, тач-цель ≥44px. Без kebab-меню и без превращения всей карточки в ссылку — чтобы не конфликтовать с тапом «показать разбивку» (LIST-07). — **Reversibility:** reversible.

### Удаление
- **D-05:** Подтверждение удаления через shadcn `AlertDialog` (**установить**, официальный реестр) — модальное «Удалить покупку? Действие необратимо» + Отмена / Удалить. Удаление **жёсткое** (hard delete), без undo и архива (архив/«куплено» — Фаза 4). — **Reversibility:** reversible (компонент); для пользователя само удаление необратимо в этой фазе (нет восстановления).
- **D-06:** Server Action `deleteItem(id)` — `requireUser()`, `deleteItemForUser(userId, id)` со scoping по `userId` (чужую покупку удалить нельзя). Возвращает `{ ok }`. — **Reversibility:** reversible (код).

### После сохранения / удаления
- **D-07:** После сохранения edit — **редирект на `/list`** (стиль D-09 Фазы 2), покупка сразу с обновлённым badge и новой позицией в сортировке. После удаления — остаёмся на `/list`, покупка исчезает; `router.refresh()` обновляет RSC-список. — **Reversibility:** reversible.

### Пересчёт приоритета
- **D-08:** Пересчёт `total` после редактирования — **автоматический**: `total` считается на чтении с текущей датой (SCORE-05, Фаза 2), поэтому изменённые поля дают новый приоритет при следующем рендере списка. Отдельной логики пересчёта/инвалидации не требуется. — **Reversibility:** reversible.

### Изоляция и охват
- **D-09:** `update` / `delete` всегда scoping по `userId` (AUTH-04, шов из Фазы 1): чужую покупку нельзя открыть на edit, сохранить или удалить (SC-3). Открытие несуществующей/чужой покупки → 404 / redirect (точное поведение — Claude's Discretion).

### Claude's Discretion
- Точный маршрут edit (`/list/[id]/edit` или иной) и структура RSC-обёртки страницы — планировщик (при соблюдении D-01…D-03, D-07).
- Поведение при открытии несуществующей/чужой покупки: `notFound()` (404) vs `redirect("/list")` — планировщик/UI-фаза.
- Раскладка иконок edit/delete на карточке (позиция/порядок/размер) относительно badge и аффорданса разбивки — UI-фаза.
- Тексты `AlertDialog` (заголовок/описание/кнопки) — единый русский тон; UI-фаза/планировщик.
- Нужен ли toast-фидбэк «Сохранено / Удалено» — пользователь не настоял; на усмотрение планировщика (не обязателен для цели фазы; потребует toast-компонент).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования и охват фазы
- `.planning/ROADMAP.md` §"Phase 3: Редактирование и удаление покупок" — цель, критерии успеха, зависимости.
- `.planning/REQUIREMENTS.md` §"Item Management (CRUD)" — требования ITEM-07, ITEM-08.

### Наследие Фазы 2 (ПЕРЕИСПОЛЬЗУЕТСЯ — обязательно к прочтению)
- `src/components/items/AddItemForm.tsx` — форма добавления; расширяется под edit-режим (initialValues + mode).
- `src/lib/validation/item.ts` — `itemInputSchema` (единый источник валидации; `price` в рублях, ×100 на сервере). Переиспользуется целиком.
- `src/server/repos/items.ts` — `createItemForUser` / `findItemsForUser`; сюда добавляются `findItemForUser` / `updateItemForUser` / `deleteItemForUser` со scoping по `userId` (паттерн `and(eq(id), eq(userId))`).
- `src/app/(app)/list/new/actions.ts` — паттерн Server Action (`requireUser` + `safeParse` + `{ ok }`); `createItem` — прямой аналог для `updateItem` / `deleteItem`.
- `src/app/(app)/list/page.tsx` — RSC-список; карточки получают иконки edit/delete.
- `src/components/items/ItemCard.tsx` — карточка покупки, куда добавляются иконки действий.
- `src/lib/scoring/scoring.ts` — `computeTotal(item, now)` на чтении (пересчёт после edit «бесплатный», SCORE-05).
- `.planning/phases/02-add-item-scoring/02-UI-SPEC.md` — дизайн-контракт (палитра/типографика/копирайт), расширяется под edit/delete/AlertDialog.
- `.planning/phases/02-add-item-scoring/02-CONTEXT.md` — решения Фазы 2 (D-06 форма на странице, D-09 редирект, деньги в копейках).

### Стек
- `.claude/CLAUDE.md` — Server Actions + Zod v4 + Drizzle + shadcn/ui (добавить `AlertDialog`) + Tailwind v4, layered TDD (Vitest/RTL/Playwright).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddItemForm.tsx` — расширить опциональными `initialValues` + `mode` (create/edit); предзаполнение `price`/`monthlyPayment` в рублях (÷100).
- `items.ts` (repo) — добавить `findItemForUser(userId, id)`, `updateItemForUser(userId, id, data)`, `deleteItemForUser(userId, id)` — все со scoping по `userId`.
- `list/new/actions.ts` — паттерн Server Action ({ ok } + `requireUser` + `safeParse`); `updateItem` / `deleteItem` строятся по нему.
- `ItemCard.tsx` — добавить иконки edit/delete (lucide `Pencil` / `Trash2`).
- `itemInputSchema` — переиспользуется целиком (валидация edit == валидация create).

### Established Patterns
- `userId` только из `requireUser()`, никогда из payload; каждый запрос scoping по `userId` (AUTH-04).
- Server Action возвращает `{ ok }`, навигация на клиенте (`router.push`/`refresh`), НЕ `redirect()` внутри try/catch (Pitfall 7).
- Деньги: рубли в форме/схеме, integer-копейки в БД, перевод ×100 один раз на сервере (BL-01).
- `total` вычисляется на чтении (SCORE-05) → пересчёт приоритета после редактирования автоматический.
- shadcn: `AlertDialog` — новый copy-in компонент из официального реестра (registry safety не требуется; `Dialog` в Фазе 2 не устанавливался).

### Integration Points
- `/list/[id]/edit` (RSC-обёртка) → `findItemForUser(userId, id)` → предзаполнение `AddItemForm` → `updateItem` → редирект `/list`.
- Иконка delete на `ItemCard` → `AlertDialog` подтверждение → `deleteItem` → `router.refresh()` списка.

</code_context>

<specifics>
## Specific Ideas

- Удаление в этой фазе жёсткое и необратимое — сознательный выбор (архив/«куплено» отложены в Фазу 4); поэтому явное модальное подтверждение (`AlertDialog`), а не тихое удаление.
- Пересчёт приоритета не требует отдельного кода — «бесплатное» следствие вычисления на чтении из Фазы 2.
- Единая форма add/edit — приоритет отсутствия дублирования и единой валидации над развязкой edit-специфики.
- Явные иконки на карточке (не kebab, не клик по всей карточке) — не конфликтуют с тапом «показать разбивку» (LIST-07).

</specifics>

<deferred>
## Deferred Ideas

- Отметка «куплено» (completed) и уход в архив, фильтр «показывать купленные», переключатели сортировки — Фаза 4 (LIST-01…05, LIST-08).
- Зависимости (`depends`) и поведение удаления покупки, от которой зависят другие (каскад/блокировка) — Фаза 5 (ITEM-06, DEP-01/02).
- Undo-toast / мягкое удаление с восстановлением — рассмотрено, отклонено (сложность + пересечение с архивом Фазы 4).
- Toast-фидбэк «Сохранено/Удалено» — опционален, на усмотрение планировщика (не входит в обязательный охват фазы).

</deferred>

---

*Phase: 3-Редактирование и удаление покупок*
*Context gathered: 2026-08-01*
