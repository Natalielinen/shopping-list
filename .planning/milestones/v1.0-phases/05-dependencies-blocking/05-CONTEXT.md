# Phase 5: Зависимости и блокировка - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Финальная фаза milestone v1.0. Пользователь делает одну свою покупку зависящей от другой; зависимая покупка заблокирована (нельзя отметить купленной), пока не куплена её зависимость; заблокированные покупки визуально отличаются в списке. Требования: ITEM-06 (указать зависимость), DEP-01 (блокировка до покупки зависимости), DEP-02 (визуальное отличие заблокированных).

За рамками: несколько зависимостей у одной покупки, транзитивная (цепочечная) блокировка, каскадное удаление зависимых — всё это отложено (см. Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Модель зависимости (ITEM-06)
- **D-01:** Одна зависимость на покупку — nullable self-referencing FK `dependsOn` (колонка `depends_on`) на `items.id`. В форме add/edit — shadcn `Select` из СВОИХ покупок пользователя, исключая саму себя. — **Reversibility:** one-way — добавление FK-колонки идёт через миграцию.
- **D-06:** FK `depends_on` объявлен с `references(() => items.id, { onDelete: "set null" })`. При удалении товара-зависимости БД сама обнуляет `depends_on` у ссылающихся покупок → зависимая авто-разблокируется, висячих ссылок нет, каскадного удаления НЕ происходит. Жёсткое удаление покупок (Фаза 3) сохраняется. — **Reversibility:** one-way — поведение FK задаётся миграцией.

### Механика блокировки (DEP-01)
- **D-02:** Блокировка — ПРЯМАЯ (не транзитивная) и вычисляется НА ЧТЕНИИ: покупка заблокирована ⇔ её `dependsOn` не null И у покупки-зависимости `purchasedAt` = null (не куплена). Как только зависимость куплена — покупка авто-разблокируется (производное состояние, ничего не хранится). Без рекурсии/обхода графа для самой блокировки.
- **D-03:** Точка ограничения — Server Action `setItemPurchased` (Фаза 4): серверный guard отклоняет отметку «куплено» для заблокированной покупки (defense-in-depth, `{ ok: false }` с понятным текстом) — даже если UI-чекбокс обойдён. В UI чекбокс «куплено» у заблокированной покупки `disabled`.
- **D-05:** При ВЫБОРЕ зависимости запрещаются циклы: нельзя выбрать саму себя и нельзя выбрать покупку, которая (по цепочке `depends_on`) уже зависит от текущей — иначе A→B, B→A привели бы к взаимному вечному блоку (deadlock). Проверка обходит цепочку `depends_on` от кандидата; при цикле — валидационная ошибка формы/действия. (Сама блокировка прямая — D-02; обход цепочки нужен только для защиты от циклов.)

### Визуальное отличие (DEP-02)
- **D-04:** Заблокированная покупка в списке: иконка «замок» (lucide `Lock`) + `disabled`-чекбокс «куплено» + подпись/бейдж «Заблокировано: {название зависимости}». Избыточный канал (иконка + текст + недоступный чекбокс), сразу понятно почему и от чего. Точное размещение на карточке — в UI-SPEC.

### Claude's Discretion
- Точное место `Select` зависимости в форме add/edit (необязательное поле рядом с link/description); `dependsOn` — optional/nullable в `itemInputSchema` (Zod).
- Содержимое выпадающего списка зависимостей: показывать другие покупки пользователя, отфильтровав самоссылку и cycle-небезопасные; включать ли уже купленные — купленная зависимость = сразу выполнена (покупка не блокируется), поэтому допустимо, но малополезно — на усмотрение.
- Реализация обхода цепочки для проверки циклов (server-side, при выборе/сохранении).
- Тултип на `disabled`-чекбоксе — опционально; иконка «замок» + подпись уже объясняют причину.
- Вычисление флага «заблокирована» из уже загруженного RSC-набора (lookup зависимости по id в списке — её `purchasedAt`), без дополнительного запроса — согласуется с D-10 Фазы 4 (RSC грузит все покупки, производные состояния — на клиенте/чтении).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования и цель
- `.planning/ROADMAP.md` §"Phase 5: Зависимости и блокировка" — goal, success criteria, requirement IDs (ITEM-06, DEP-01, DEP-02)
- `.planning/REQUIREMENTS.md` — трассировка ITEM-06 / DEP-01 / DEP-02

### Стек и переносимые решения
- `.claude/CLAUDE.md` — стек; в §PostgreSQL/Drizzle прямо предусмотрен self-reference `depends` FK (users → items, self-ref)
- `.planning/phases/04-list-sort-filter-archive/04-CONTEXT.md` + `04-04-SUMMARY.md` — `purchasedAt` семантика (null=активна), `setItemPurchased`/`setItemPurchasedForUser` шов, `ListView`/`ItemCard`/`PurchaseCheckbox` (точки блокировки и визуала)
- `.planning/phases/03-edit-delete-items/03-CONTEXT.md` — `deleteItemForUser` (теперь FK onDelete:set null вместо ручной чистки); единая форма add/edit, userId-scoping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/db/schema.ts` — таблица `items`; добавляется nullable self-FK `depends_on` (onDelete set null) + миграция Drizzle.
- `src/server/repos/items.ts` — `setItemPurchasedForUser` (шов Фазы 4): добавить guard блокировки; write-швы create/update принимают `dependsOn`; валидация цикла.
- `src/app/(app)/list/actions.ts` — `setItemPurchased` (guard блокировки); `createItem`/`updateItem` (приём `dependsOn`).
- `src/lib/validation/item.ts` — `itemInputSchema`: добавить optional `dependsOn` (+ серверная валидация цикла).
- `src/components/items/AddItemForm.tsx` — shadcn `Select` зависимости (список своих покупок), по образцу enum-Select.
- `src/components/items/PurchaseCheckbox.tsx` — `disabled` при блокировке.
- `src/components/items/ItemCard.tsx` / `ListView.tsx` — иконка «замок» + подпись «Заблокировано: {название}»; флаг «заблокирована» из загруженного набора.

### Established Patterns
- userId-scoping на каждом шве данных; зависимость — только СВОЯ покупка (проверка владельца при выборе).
- Производные состояния на чтении (как приоритет и статус архива), ничего лишнего в БД.
- TDD + IDOR-тест на реальной Postgres для новых/изменённых write-швов; e2e для флоу блокировки.

### Integration Points
- `items` schema (миграция self-FK).
- `setItemPurchased` (guard) — новая серверная граница блокировки.
- Форма add/edit (Select зависимости) + Zod (цикл-валидация).
- Список/карточка (визуал блокировки, DEP-02).

</code_context>

<specifics>
## Specific Ideas

- Подпись у заблокированной: «Заблокировано: {название покупки-зависимости}» — показывает, от чего именно зависит.
- Авто-разблокировка: отметка зависимости купленной сразу разблокирует зависимую (производно на чтении, `router.refresh()` после покупки уже есть в Фазе 4).

</specifics>

<deferred>
## Deferred Ideas

- Несколько зависимостей у одной покупки (join-таблица, multi-select) — v2.
- Транзитивная/цепочечная блокировка (A заблокирована, пока не куплена вся цепочка A→B→C) — v1 только прямая зависимость.
- Каскадное удаление зависимых при удалении товара-зависимости — не делаем; вместо этого `depends_on` → null (D-06).

</deferred>

---

*Phase: 5-dependencies-blocking*
*Context gathered: 2026-08-09*
