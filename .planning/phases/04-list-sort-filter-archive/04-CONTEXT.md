# Phase 4: Список — сортировка, фильтры и архив - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Фаза делает список покупок управляемым: пользователь видит mobile-first список, по умолчанию отсортированный по приоритету, может переключать сортировку (по добавлению, по алфавиту), отмечать покупки купленными (уходят в архив и скрываются) и включать фильтр «показывать купленные». Требования: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-08.

Badge приоритета и разбивка очков (LIST-06/07) уже сделаны в Фазе 2 и в scope не входят. Зависимости покупок (depends, блокировка) — Фаза 5. Восстановление жёстко удалённых покупок (hard delete из Фазы 3) — вне scope.

</domain>

<decisions>
## Implementation Decisions

### Сортировка (LIST-01/02/03)
- **D-01:** Три режима сортировки переключаются выпадающим shadcn `Select` в закреплённой панели над списком. Дефолт — по приоритету (убыв.). Порядок опций: приоритет → по добавлению → по алфавиту.
- **D-02:** Детерминированные tiebreakers (LIST-01): по приоритету — `total` убыв., затем `createdAt` убыв., затем `id`; «по добавлению» — `createdAt` убыв. (новые сверху), затем `id`; «по алфавиту» — `title` возр. (А→Я), затем `createdAt` убыв., затем `id`.
- **D-03:** Приоритет считается на чтении единым `now`, сортировка выполняется в JS (перенос из Фазы 2 — SCORE-05 / D-12), НЕ через SQL `ORDER BY` по вычисляемому приоритету.

### Отметка «куплено» и архив (LIST-04/05)
- **D-04:** Покупка отмечается купленной чекбоксом на карточке — мгновенно, без модалки; показывается тост с действием «Отменить» (undo). Покупка — недеструктивное, обратимое действие (в отличие от удаления в Фазе 3).
- **D-05:** Отметка обратима в любой момент: снятие чекбокса в секции «Куплено» возвращает покупку в активные. `purchased` — обратимый toggle, а не финальное состояние.
- **D-06:** При включённом фильтре «показывать купленные» купленные показываются ОТДЕЛЬНОЙ секцией «Куплено» с заголовком ниже активных (не вперемешку). По умолчанию (фильтр выключен) купленные скрыты из списка.
- **D-07:** Статус «куплено» хранится nullable-полем на `items` (семантика: `null` = активна, non-null = куплена/в архиве; например `purchasedAt timestamp`). Требует Drizzle-миграции. — **Reversibility:** one-way — добавление колонки идёт через миграцию; смена представления позже потребует миграции данных. Точное имя/тип поля уточняет research/planner, семантика `null = активна` зафиксирована.
- **D-08:** Запись статуса — через новый Server Action (напр. `setItemPurchased(id, purchased)`), scoped по `userId` из `requireUser()` — тот же шов изоляции, что `updateItemForUser`/`deleteItemForUser` в Фазе 3. Обязателен IDOR-тест изоляции на реальной Postgres (TDD, RED-first).

### Состояние сортировки/фильтра
- **D-09:** Выбор сортировки и «показывать купленные» — эфемерное клиентское состояние (`useState`), НЕ хранится в URL или localStorage; сбрасывается к дефолту (приоритет, купленные скрыты) при перезагрузке. `nuqs` НЕ добавляем (осознанное отклонение рекомендации CLAUDE.md для v1).
- **D-10:** Список рендерится RSC (грузит все покупки пользователя через `findItemsForUser`, включая купленные), а клиентский компонент держит состояние сортировки/фильтра и сортирует/фильтрует на клиенте (набор покупок на пользователя мал). — **Reversibility:** reversible.

### Claude's Discretion
- Точное имя/тип поля статуса (`purchasedAt` vs `isPurchased` + timestamp) — на усмотрение research/planner; D-07 задаёт семантику `null = активна`.
- Сортировка внутри секции «Куплено» — по `purchasedAt` убыв. (недавно купленные выше), если поле timestamp.
- Точная раскладка чекбокса на карточке и панели сортировки/фильтра — задаётся в UI-SPEC (`/gsd-ui-phase 4`); здесь зафиксировано только поведение.
- Алфавитная сортировка: `localeCompare('ru')`, case-insensitive.
- Механика undo (напр. `sonner` toast с кнопкой «Отменить») — стандартный подход; библиотеку тоста добавить, если её ещё нет.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования и цель фазы
- `.planning/ROADMAP.md` §"Phase 4: Список — сортировка, фильтры и архив" — goal, success criteria, requirement IDs (LIST-01..05, LIST-08)
- `.planning/REQUIREMENTS.md` — трассировка LIST-01..08 (LIST-06/07 уже Complete в Фазе 2)

### Стек и переносимые решения
- `.claude/CLAUDE.md` §"Data flow decision" / §"Supporting Libraries" — Server Actions + `useOptimistic`, shadcn/ui `Select`/`Checkbox`, рекомендация `nuqs` (здесь отклонена — см. D-09)
- `.planning/phases/02-add-item-scoring/02-CONTEXT.md` — список и приоритет-на-чтении, сортировка в JS (переносится в D-03)
- `.planning/phases/03-edit-delete-items/03-CONTEXT.md` — шаблон userId-scoped write-шва, переиспользуемый для `setItemPurchased` (D-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(app)/list/page.tsx` — текущий RSC-список: уже сортирует по `total` убыв. с tiebreak `createdAt`. Расширяется до переключаемой сортировки + секции «Куплено» (клиентский компонент поверх RSC-данных).
- `src/components/items/ItemCard.tsx` — карточка с готовым слотом `actions` (Pencil/Trash2 из Фазы 3); добавляется чекбокс «куплено».
- `src/lib/scoring/scoring.ts` — `computeTotal`/`computeBreakdown` (приоритет на чтении единым `now`).
- `src/server/repos/items.ts` — шов изоляции по `userId` (`findItemsForUser` + `update/deleteItemForUser`); добавляется `setItemPurchasedForUser` по тому же образцу.
- `src/components/ui/*` — shadcn `Select`/`Checkbox` уже в проекте с Фазы 2.

### Established Patterns
- userId-scoping на каждом шве данных (repo с обязательным `userId` в WHERE) — распространить на статус «куплено».
- Приоритет на чтении единым `now`, сортировка в JS (не SQL по вычисляемому приоритету).
- TDD + IDOR-тест на реальной Postgres (`src/server/repos/items.iso.test.ts`) для каждого нового write-шва.

### Integration Points
- `src/server/db/schema.ts` — миграция для nullable-поля статуса «куплено» (Drizzle generate/migrate).
- `src/app/(app)/list/page.tsx` — RSC отдаёт все покупки → клиентский компонент сортировки/фильтра.
- `src/components/items/ItemCard.tsx` — чекбокс «куплено»; секция «Куплено».
- Тост для undo — библиотека тоста (`sonner`) в проекте пока отсутствует, нужно добавить.

</code_context>

<specifics>
## Specific Ideas

- Панель управления (Select сортировки + чекбокс «показывать купленные») — закреплена над списком.
- Секция «Куплено» — отдельный блок с заголовком ниже активных, появляется только при включённом фильтре.
- Дефолт при загрузке страницы: сортировка по приоритету, купленные скрыты.

</specifics>

<deferred>
## Deferred Ideas

- Персистентность выбора сортировки/фильтра между сессиями (URL через `nuqs` или localStorage) — осознанно отклонена в v1 (D-09); кандидат, если понадобится shareable/запоминаемое состояние.
- Зависимости покупок (`depends`, блокировка) — Фаза 5 (DEP-01).
- Восстановление жёстко удалённых покупок — вне scope (удаление осталось hard delete из Фазы 3; «архив» здесь — только про купленные).

</deferred>

---

*Phase: 4-list-sort-filter-archive*
*Context gathered: 2026-08-02*
