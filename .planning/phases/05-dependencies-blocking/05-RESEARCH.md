# Phase 5: Зависимости и блокировка — Research

**Researched:** 2026-09-12
**Domain:** Drizzle self-referencing FK · cycle-prevention traversal · read-time blocking derivation · RSC→client примитивы · TDD (Vitest + Playwright)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Модель зависимости (ITEM-06)**
- **D-01:** Одна зависимость на покупку — nullable self-referencing FK `dependsOn` (колонка `depends_on`) на `items.id`. В форме add/edit — shadcn `Select` из СВОИХ покупок пользователя, исключая саму себя. Reversibility: one-way — добавление FK-колонки идёт через миграцию.
- **D-06:** FK `depends_on` объявлен с `references(() => items.id, { onDelete: "set null" })`. При удалении товара-зависимости БД сама обнуляет `depends_on` у ссылающихся покупок → зависимая авто-разблокируется, висячих ссылок нет, каскадного удаления НЕ происходит. Жёсткое удаление покупок (Фаза 3) сохраняется. Reversibility: one-way — поведение FK задаётся миграцией.

**Механика блокировки (DEP-01)**
- **D-02:** Блокировка — ПРЯМАЯ (не транзитивная) и вычисляется НА ЧТЕНИИ: покупка заблокирована ⇔ её `dependsOn` не null И у покупки-зависимости `purchasedAt` = null (не куплена). Как только зависимость куплена — покупка авто-разблокируется (производное состояние, ничего не хранится). Без рекурсии/обхода графа для самой блокировки.
- **D-03:** Точка ограничения — Server Action `setItemPurchased` (Фаза 4): серверный guard отклоняет отметку «куплено» для заблокированной покупки (defense-in-depth, `{ ok: false }` с понятным текстом) — даже если UI-чекбокс обойдён. В UI чекбокс «куплено» у заблокированной покупки `disabled`.
- **D-05:** При ВЫБОРЕ зависимости запрещаются циклы: нельзя выбрать саму себя и нельзя выбрать покупку, которая (по цепочке `depends_on`) уже зависит от текущей — иначе A→B, B→A привели бы к взаимному вечному блоку (deadlock). Проверка обходит цепочку `depends_on` от кандидата; при цикле — валидационная ошибка формы/действия. (Сама блокировка прямая — D-02; обход цепочки нужен только для защиты от циклов.)

**Визуальное отличие (DEP-02)**
- **D-04:** Заблокированная покупка в списке: иконка «замок» (lucide `Lock`) + `disabled`-чекбокс «куплено» + подпись/бейдж «Заблокировано: {название зависимости}». Избыточный канал (иконка + текст + недоступный чекбокс). Точное размещение на карточке — в UI-SPEC.

### Claude's Discretion
- Точное место `Select` зависимости в форме add/edit (необязательное поле рядом с link/description); `dependsOn` — optional/nullable в `itemInputSchema` (Zod). **UI-SPEC зафиксировал:** поле встаёт после `Срок` и перед `Сомнения`.
- Содержимое выпадающего списка зависимостей: показывать другие покупки пользователя, отфильтровав самоссылку и cycle-небезопасные; включать ли уже купленные — на усмотрение.
- Реализация обхода цепочки для проверки циклов (server-side, при выборе/сохранении).
- Тултип на `disabled`-чекбоксе — опционально; **UI-SPEC зафиксировал: тултип НЕ добавляется.**
- Вычисление флага «заблокирована» из уже загруженного RSC-набора (lookup зависимости по id в списке — её `purchasedAt`), без дополнительного запроса — согласуется с D-10 Фазы 4.

### Deferred Ideas (OUT OF SCOPE)
- Несколько зависимостей у одной покупки (join-таблица, multi-select) — v2.
- Транзитивная/цепочечная блокировка (A заблокирована, пока не куплена вся цепочка A→B→C) — v1 только прямая зависимость.
- Каскадное удаление зависимых при удалении товара-зависимости — не делаем; вместо этого `depends_on` → null (D-06).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEM-06 | Пользователь может указать зависимость (`depends`) от другой своей покупки | §Architecture Pattern 1 (self-ref FK + миграция), Pattern 2 (обход циклов при выборе), §Code Examples (Zod `dependsOn`, Select-поле, кандидаты пропом) |
| DEP-01 | Покупка с зависимостью заблокирована (нельзя отметить купленной), пока не куплен товар, от которого она зависит | §Architecture Pattern 3 (read-time `blocked` + серверный guard в `setItemPurchased`), §Code Examples (pure `isBlocked`, orchestration в Server Action) |
| DEP-02 | Заблокированные покупки визуально отличаются в списке | §Architecture Pattern 4 (RSC→client `blocked` + `dependencyTitle` примитивами), UI-SPEC §Component Behaviour (строка `Lock` + подпись, `disabled`-чекбокс) |
</phase_requirements>

## Summary

Фаза 5 не вводит новых библиотек и не устанавливает пакетов — весь стек (Drizzle ORM 0.45.2, Zod 4, React Hook Form 7, shadcn `Select`/`Form`, `lucide-react` `Lock`, Vitest 4, Playwright) уже в проекте и обкатан Фазами 1–4. Новизна фазы — четыре конкретных приёма поверх существующих швов: (1) объявить в `items` self-referencing FK `dependsOn` через явно типизированный callback `(): AnyPgColumn => items.id` с `onDelete: "set null"` и сгенерировать SQL-миграцию `drizzle-kit generate`; (2) чистая функция обхода цепочки `depends_on` для запрета циклов при выборе зависимости (self + транзитивный цикл), с visited-set против уже испорченной БД; (3) серверный guard блокировки в `setItemPurchased` (read-time производное `dependsOn != null && dependency.purchasedAt == null`), defense-in-depth к `disabled`-чекбоксу; (4) вычисление `blocked` + `dependencyTitle` в RSC `list/page.tsx` из уже загруженного набора и передача через границу RSC→client только примитивами (перенос §Pitfall 4 Фазы 4).

Ключевая ловушка безопасности, которой НЕ было в прошлых фазах: `dependsOn` — пользовательский ввод, ссылающийся на другой ряд `items`. FK гарантирует референциальную целостность к таблице `items`, но НЕ владельца — сослаться на чужую покупку БД позволит. Поэтому владение зависимостью (`candidate ∈ findItemsForUser(userId)`) обязано проверяться в слое приложения (Server Action), иначе это IDOR/раскрытие существования чужих id (ASVS V4). Та же загрузка своих покупок обслуживает и построение кандидатов дропдауна, и проверку владения, и обход циклов — один `findItemsForUser` на действие.

**Primary recommendation:** Мигрируй `items` self-ref FK (`onDelete: "set null"`), вынеси две ЧИСТЫЕ функции — `wouldCreateCycle(map, sourceId, candidateId)` и `isBlocked(dependsOn, dependencyPurchasedAt)` — в `src/lib/deps/` (TDD-мишени), оркеструй чтения в Server Actions (`createItem`/`updateItem` — владение+цикл, `setItemPurchased` — guard блокировки), а `blocked`/`dependencyTitle` вычисляй в RSC и прокидывай примитивами. Новых пакетов не ставить.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Хранение зависимости (`depends_on` FK) | Database / Storage | — | Референциальная целостность + `ON DELETE SET NULL` (D-06) — работа БД, не кода |
| Проверка владения зависимостью (candidate ∈ свои покупки) | API / Server Action | Database (read) | FK не проверяет владельца → app-layer обязан (IDOR, ASVS V4) |
| Запрет циклов при выборе | API / Server Action | Pure lib (traversal) | Never-trust-client backstop (D-05); чистый обход — унит-тестируемая логика |
| Derivation `blocked` для отображения | Frontend Server (RSC) | Pure lib | Производное на чтении из уже загруженного набора (D-02), без доп. запроса |
| Guard блокировки при «куплено» | API / Server Action | Pure lib (`isBlocked`) | Defense-in-depth (D-03): даже при обходе `disabled`-UI сервер отклоняет |
| Визуал блокировки (Lock + подпись + disabled) | Browser / Client | — | `ItemCard`/`PurchaseCheckbox` получают `blocked`/`dependencyTitle` примитивами |
| Клиентская фильтрация кандидатов (self/cycle-unsafe) | Frontend Server (RSC props) | Browser | Кандидаты приходят пропом из RSC-обёртки формы; клиент только рендерит |

## Standard Stack

Фаза переиспользует установленный стек — **новых зависимостей нет**. Ниже — какие уже-существующие части задействованы.

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `drizzle-orm` | `0.45.2` | self-ref FK `dependsOn` в `pgTable`; тип `AnyPgColumn` для разрыва циклической инференции | Уже ORM проекта; `AnyPgColumn` — штатный экспорт `drizzle-orm/pg-core` [VERIFIED: node_modules/drizzle-orm/pg-core/columns/common.d.ts] |
| `drizzle-kit` | `0.31.10` | `generate` → SQL-миграция self-FK; `migrate` применяет | Первичный инструмент миграций проекта; SQL коммитится в `./drizzle` [VERIFIED: package.json + drizzle.config.ts] |
| `zod` | `4.4.3` | `dependsOn` optional/nullable в `itemInputSchema` | Единый контракт клиент+сервер (валидация формы синхронна; цикл/владение — в Server Action, не в schema) [VERIFIED: package.json] |
| `postgres` (postgres.js) | `3.4.9` | драйвер; `ON DELETE SET NULL` исполняется БД | Драйвер проекта [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` + `@hookform/resolvers` | `7.83.0` / `5.5.5` | новое поле `dependsOn` в `AddItemForm`; вывод ошибки цикла через `form.setError`/`FormMessage` | Форма add/edit [VERIFIED: package.json] |
| `radix-ui` (shadcn `Select`/`Form`) | `1.6.7` | `Select` зависимости; sentinel `"none"` → null (Radix не допускает пустой `value`) | Поле формы + ошибка поля [VERIFIED: package.json] |
| `lucide-react` | `1.27.0` | иконка `Lock` на карточке | `Lock` экспортируется [VERIFIED: `node -e require('lucide-react').Lock` → object] |
| `date-fns` | `4.4.0` | не требуется этой фазой | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Обход цепочки в чистой JS-функции над загруженным набором | Рекурсивный SQL (`WITH RECURSIVE`) для детекта цикла | Оверкилл: набор покупок пользователя мал, уже целиком в памяти RSC; SQL усложняет и дублирует загрузку |
| `dependsOn` как одиночный FK | join-таблица many-to-many | Отложено в Deferred (v2); D-01 фиксирует одну зависимость |
| Guard в Server Action `setItemPurchased` | CHECK-констрейнт/триггер в БД | Блокировка — производное на чтении (D-02), не хранится; констрейнт по «времени покупки зависимости» невыразим декларативно |

**Installation:** Пакеты не устанавливаются. Единственная команда установки схемы — генерация и применение миграции (см. Pattern 1).

## Package Legitimacy Audit

> Фаза НЕ устанавливает внешних пакетов — все используемые библиотеки уже в `package.json` и прошли аудит в Фазах 1–4. Package Legitimacy Gate неприменим.

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(нет новых)* | — | N/A — фаза использует только уже установленные зависимости |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
ВЫБОР ЗАВИСИМОСТИ (ITEM-06 / D-05)
  Browser: AddItemForm — Select "dependsOn" (кандидаты пропом из RSC, sentinel "none"→null)
     │ submit(ItemInput)
     ▼
  Server Action createItem / updateItem
     │  requireUser() → userId (сессия)
     │  itemInputSchema.safeParse (V5)
     │  if dependsOn != null:
     │     own = findItemsForUser(userId)           ── один read обслуживает всё ─┐
     │     map = Map(own: id→{dependsOn,purchasedAt,title})                       │
     │     ownership: candidate ∈ map ? иначе → { ok:false, field:"dependsOn" }   │ (ASVS V4)
     │     cycle: wouldCreateCycle(map, editedId, candidate) ? → field error      │ (D-05, pure)
     ▼
  createItemForUser / updateItemForUser (scoping userId) → INSERT/UPDATE depends_on
     │
     ▼
  Postgres: items.depends_on → items.id  [FK ON DELETE SET NULL]  (D-06)

ОТОБРАЖЕНИЕ + БЛОКИРОВКА (DEP-01/02 / D-02/03/04)
  RSC list/page.tsx
     │ rows = findItemsForUser(userId)              (уже грузит ВСЕ покупки)
     │ byId = Map(rows: id→row)
     │ per row: blocked = isBlocked(row.dependsOn, byId.get(row.dependsOn)?.purchasedAt) && row.purchasedAt==null
     │          dependencyTitle = byId.get(row.dependsOn)?.title ?? null
     │ → ListViewItem { …, blocked:boolean, dependencyTitle:string|null }   (ПРИМИТИВЫ, §Pitfall 4)
     ▼
  Client ListView → ItemCard(blocked, dependencyTitle)
     ├─ Lock + «Заблокировано: {title}»   (рендер ТОЛЬКО при blocked)
     └─ PurchaseCheckbox(blocked) → Checkbox disabled

  Тап «куплено» заблокированной (в обход disabled) →
  Server Action setItemPurchased(id, true)
     │ item = findItemForUser(userId, id)
     │ if true && item.dependsOn: dep = findItemForUser(userId, item.dependsOn)
     │    if dep && dep.purchasedAt == null → { ok:false, error:BLOCKED } (D-03 guard)
     ▼
  setItemPurchasedForUser (без изменений)

  АВТО-РАЗБЛОКИРОВКА: пометка зависимости купленной → router.refresh() (Фаза 4)
  → RSC пересчитывает blocked → строка Lock исчезает, чекбокс активен (ничего не хранится)
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── deps/                    # НОВОЕ — чистая логика фазы 5 (TDD-мишени)
│   │   ├── cycle.ts             # wouldCreateCycle(map, sourceId, candidateId)
│   │   ├── cycle.test.ts        # unit: self, A→B/B→A, транзитив, corrupt-cycle bound
│   │   ├── blocked.ts           # isBlocked(dependsOn, dependencyPurchasedAt) + candidate-фильтр
│   │   └── blocked.test.ts      # unit
│   └── validation/item.ts       # + dependsOn (optional/nullable, sentinel→null)
├── server/
│   ├── db/schema.ts             # + dependsOn self-ref FK (onDelete set null)
│   └── repos/items.ts           # updateItemForUser: + dependsOn ?? null нормализация
├── app/(app)/list/
│   ├── actions.ts               # setItemPurchased: + guard блокировки (D-03)
│   ├── new/actions.ts           # createItem: + владение+цикл при dependsOn
│   ├── new/page.tsx             # RSC: кандидаты пропом в форму
│   ├── [id]/edit/actions.ts     # updateItem: + владение+цикл
│   ├── [id]/edit/page.tsx       # RSC: кандидаты + initialValues.dependsOn
│   └── page.tsx                 # RSC: blocked/dependencyTitle из набора
├── components/items/
│   ├── AddItemForm.tsx          # + Select dependsOn (после «Срок», до «Сомнения»)
│   ├── ItemCard.tsx             # + строка Lock/подпись; проп blocked/dependencyTitle
│   └── PurchaseCheckbox.tsx     # + проп blocked → Checkbox disabled + aria-label
├── lib/list/sort.ts             # ListItem/ListViewItem: + blocked/dependencyTitle
└── drizzle/0003_*.sql           # сгенерированная миграция self-FK
tests/helpers/db.ts              # seedItem: + опциональный dependsOn для сидов
```

### Pattern 1: Self-referencing FK через миграцию (ITEM-06 / D-01 / D-06)
**What:** Nullable колонка `depends_on` в `items` ссылается на `items.id` той же таблицы.
**When to use:** Одна зависимость на покупку; удаление зависимости обнуляет ссылку (не каскад).

Ключевая деталь TypeScript: ссылка на `items.id` внутри определения самой `items` — циклическая, инференция типа не завершится. Разрывается **явной аннотацией возвращаемого типа** callback'а `(): AnyPgColumn => items.id`. `AnyPgColumn` — штатный тип из `drizzle-orm/pg-core` [VERIFIED: pg-core/columns/common.d.ts:113], сигнатура `references(ref, actions?)` с `actions.onDelete: UpdateDeleteAction`, где union включает `'set null'` [VERIFIED: pg-core/foreign-keys.d.ts:4].

```typescript
// src/server/db/schema.ts — добавить импорт типа и колонку в pgTable("items", {...})
// Source: [VERIFIED: node_modules/drizzle-orm/pg-core 0.45.2]
import { type AnyPgColumn, /* pgTable, text, ... */ } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  // ...существующие колонки...
  // ITEM-06 / D-01 / D-06: одна зависимость, self-ref FK. Явный AnyPgColumn
  // разрывает циклическую инференцию (items ссылается сама на себя).
  // onDelete "set null": при удалении зависимости ссылка обнуляется → зависимая
  // авто-разблокируется, висячих ссылок нет, каскадного удаления не происходит.
  dependsOn: text("depends_on").references((): AnyPgColumn => items.id, {
    onDelete: "set null",
  }),
  // ...
});
```

Генерация и применение (как Фазы 1–4 — migration-based, НЕ `push`):
```bash
npx drizzle-kit generate     # создаёт drizzle/0003_*.sql (ADD COLUMN + ADD CONSTRAINT)
npx drizzle-kit migrate      # применяет к локальной БД (DATABASE_URL из .env.local)
```
Ожидаемый SQL (по образцу 0001/0002 — `ALTER TABLE ADD COLUMN`, плюс отдельный constraint):
```sql
ALTER TABLE "items" ADD COLUMN "depends_on" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_depends_on_items_id_fk"
  FOREIGN KEY ("depends_on") REFERENCES "public"."items"("id")
  ON DELETE set null ON UPDATE no action;
```
Тестовая БД подхватывает миграцию **автоматически**: `tests/helpers/db.ts` вызывает `migrate(testDb, { migrationsFolder: "./drizzle" })` один раз за прогон (`ensureMigrated`) [VERIFIED: tests/helpers/db.ts:28-32]. Отдельных действий для test DB не нужно — только сгенерировать 0003 и закоммитить.

### Pattern 2: Запрет циклов чистым обходом цепочки (D-05)
**What:** При выборе кандидата C для покупки I: отклонить, если `C === I` (self) или если C по цепочке `depends_on` уже зависит от I (транзитивный цикл A→B, B→A).
**When to use:** Server-side валидация в `createItem`/`updateItem` (never-trust-client backstop). Клиентская фильтрация кандидатов лишь прячет небезопасные, авторитетна серверная проверка.
**Where it lives:** ЧИСТАЯ функция в `src/lib/deps/cycle.ts` (не в Zod refine — refine синхронный и без доступа к БД; набор цепочки загружается репозиторием в Server Action).

```typescript
// src/lib/deps/cycle.ts
// Source: derived design [ASSUMED — алгоритм, не из внешнего источника]
/**
 * true, если назначение candidateId зависимостью для sourceId создаст цикл.
 * map: id → dependsOn (только СВОИ покупки пользователя, загружены в Server Action).
 * sourceId === null → create-режим: новой покупки ещё нет в графе, ни одна цепочка
 * не может её достичь → цикл невозможен.
 * visited-set ограничивает обход даже при уже испорченной (циклической) БД —
 * каждый узел посещается один раз, глубина ≤ числа покупок пользователя.
 */
export function wouldCreateCycle(
  map: ReadonlyMap<string, string | null>,
  sourceId: string | null,
  candidateId: string
): boolean {
  if (sourceId !== null && candidateId === sourceId) return true; // self (D-05)
  if (sourceId === null) return false;                            // create: цикл невозможен
  const visited = new Set<string>();
  let current: string | null = candidateId;
  while (current !== null) {
    if (current === sourceId) return true;   // цепочка кандидата достигает I → цикл
    if (visited.has(current)) break;         // защита от pre-existing corrupt cycle
    visited.add(current);
    current = map.get(current) ?? null;
  }
  return false;
}
```

### Pattern 3: Read-time блокировка + серверный guard (DEP-01 / D-02 / D-03)
**What:** `blocked` — чистое производное; guard в `setItemPurchased` отклоняет отметку «куплено» заблокированной покупки.
**When to use:** derivation — в RSC (Pattern 4) и в guard'е; guard — только при `purchased === true` (снятие «куплено» всегда разрешено).

```typescript
// src/lib/deps/blocked.ts
// Source: derived from D-02 [ASSUMED]
/** Покупка заблокирована ⇔ есть зависимость И зависимость ещё не куплена. */
export function isBlocked(
  dependsOn: string | null,
  dependencyPurchasedAt: Date | number | null | undefined
): boolean {
  return dependsOn !== null && (dependencyPurchasedAt ?? null) === null;
}
```

Оркестрация guard'а в существующем `setItemPurchased` (шов Фазы 4 — `requireUser` + `setItemPurchasedForUser`, scoping по userId сохраняется) [VERIFIED: src/app/(app)/list/actions.ts]:
```typescript
// src/app/(app)/list/actions.ts — добавить перед вызовом setItemPurchasedForUser
const BLOCKED_ERROR = "Сначала купите товар, от которого зависит эта покупка."; // UI-SPEC §Copywriting
// ...внутри setItemPurchased, после requireUser() и next = purchased === true:
if (next) {
  const item = await findItemForUser(user.id, id);          // scoping userId (IDOR-safe)
  if (item?.dependsOn) {
    const dep = await findItemForUser(user.id, item.dependsOn);
    if (isBlocked(item.dependsOn, dep?.purchasedAt ?? null)) {
      return { ok: false, error: BLOCKED_ERROR };            // D-03 defense-in-depth
    }
  }
}
// далее — существующий setItemPurchasedForUser(user.id, id, next)
```
Примечание: guard делает 1–2 дополнительных read через существующий `findItemForUser` (IDOR-безопасен по userId) [VERIFIED: src/server/repos/items.ts:31-37]. Альтернатива — один self-join запрос-хелпер в репозитории; для MVP двух-чтенийный вариант проще и так же тестируем.

### Pattern 4: RSC→client `blocked`/`dependencyTitle` примитивами (DEP-02 / D-02)
**What:** Вычислить `blocked` и `dependencyTitle` в RSC из уже загруженного набора (lookup по id), передать примитивами. Никаких `Date`/доп. запросов через границу (перенос §Pitfall 4 Фазы 4).
**When to use:** `list/page.tsx` уже грузит ВСЕ покупки (`findItemsForUser`, WHERE по `purchasedAt` нет) [VERIFIED: src/app/(app)/list/page.tsx:29].

```typescript
// src/app/(app)/list/page.tsx — расширить .map, добавив byId-lookup
// Source: [VERIFIED against existing page.tsx]
const byId = new Map(rows.map((r) => [r.id, r]));
const items: ListViewItem[] = rows.map((item) => {
  const dep = item.dependsOn ? byId.get(item.dependsOn) : undefined;
  // blocked только для АКТИВНЫХ покупок (у купленной чекбокс = «Вернуть», lock не нужен)
  const blocked = isBlocked(item.dependsOn, dep?.purchasedAt ?? null) && item.purchasedAt === null;
  return {
    id: item.id, title: item.title,
    total: computeTotal(item, now),
    createdAtMs: item.createdAt.getTime(),
    purchasedAtMs: item.purchasedAt?.getTime() ?? null,
    breakdown: computeBreakdown(item, now),
    blocked,                                        // примитив (boolean)
    dependencyTitle: blocked ? (dep?.title ?? null) : null, // примитив (string|null)
  };
});
```
`ListViewItem` (`src/lib/list/sort.ts`) расширяется полями `blocked: boolean` и `dependencyTitle: string | null`. `blocked` НЕ участвует в сортировке/партиции — компараторы не меняются [VERIFIED: src/lib/list/sort.ts]. `ItemCard` форвардит `blocked`/`dependencyTitle` в `PurchaseCheckbox` (→ `disabled`) и рендерит строку `Lock` только при `blocked`.

### Anti-Patterns to Avoid
- **Проверка цикла/владения в Zod refine схемы `itemInputSchema`:** схема синхронна, общая для клиента, без доступа к БД. Цепочка/владение требуют загрузки чужих рядов — только в Server Action.
- **Доверять `dependsOn` из payload без проверки владения:** FK пропустит ссылку на ЧУЖУЮ покупку (целостность к таблице `items`, не к владельцу). Обязательна проверка `candidate ∈ findItemsForUser(userId)` (ASVS V4, IDOR).
- **Хранить `blocked` в БД:** производное на чтении (D-02); авто-разблокировка ломается, если кэшировать. Ничего не хранить/не инвалидировать.
- **Рекурсия для самой блокировки:** блокировка ПРЯМАЯ (D-02) — один lookup зависимости. Обход цепочки нужен ТОЛЬКО для запрета циклов (D-05).
- **Передавать `Date`/объекты через RSC→client для зависимости:** только примитивы (перенос §Pitfall 4 Фазы 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Обнуление ссылок при удалении зависимости | Ручная чистка `depends_on` в `deleteItemForUser` | FK `onDelete: "set null"` (D-06) | БД делает атомарно; ручная чистка гонки/пропуски |
| Референциальная целостность | Проверка «существует ли id» в коде на запись | FK-констрейнт | БД гарантирует; но владельца FK НЕ проверяет — это отдельный app-check |
| Генерация SQL-миграции | Ручной `ALTER TABLE` | `drizzle-kit generate` | Детерминированный SQL + `_journal.json`; ручной SQL рассинхронит meta |
| Оптимистичный флип «куплено» | Свой стейт-менеджер | существующий `useOptimistic`+`useTransition`+`router.refresh` (Фаза 4) | Уже реализовано и обкатано; авто-разблокировка едет на `router.refresh` |
| Sentinel пустого значения Select | Пустой `value=""` в `SelectItem` | явный `"none"` sentinel → map в `null` | Radix `SelectItem` запрещает пустой `value` (UI-SPEC §Copywriting) |

**Key insight:** Единственная кастомная логика фазы — два маленьких ЧИСТЫХ модуля (`cycle.ts`, `blocked.ts`); всё остальное — конфигурация существующих швов (FK через миграцию, guard в готовом Server Action, примитивы через готовую границу RSC→client).

## Runtime State Inventory

> Фаза добавляет колонку через миграцию (не rename), но затрагивает состояние вне git — фиксируем явно.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Таблица `items` в локальной БД (Postgres 18, `D:\Programs\pg`, БД `shopping_list`) и в `shopping_list_test` получит новую колонку `depends_on` | `drizzle-kit generate` (0003) + `drizzle-kit migrate` для локальной; test DB — авто через `ensureMigrated` |
| Live service config | None — сервисов вне git нет (self-hosted, локальный Postgres) | — |
| OS-registered state | None — нет задач планировщика/демонов, зависящих от схемы | — |
| Secrets/env vars | `DATABASE_URL` / `DATABASE_URL_TEST` в `.env.local` (untracked, заблокирован для файловых инструментов) — имена НЕ меняются | none — только применить миграцию к обеим БД |
| Build artifacts | `drizzle/meta/_journal.json` + `drizzle/meta/0003_snapshot.json` создаются `generate` | закоммитить вместе с 0003_*.sql (детерминизм миграций) |

**Существующие данные:** новая колонка nullable без default → аддитивная миграция, существующие строки получают `depends_on = NULL` (без зависимости), поведение не меняется. Ре-верификация: после `migrate` существующие покупки не блокированы (`dependsOn = null`).

## Common Pitfalls

### Pitfall 1: Циклическая инференция типа при self-ref FK
**What goes wrong:** `references(() => items.id, …)` внутри определения `items` даёт ошибку компиляции «implicitly has type 'any'» / циклическую ссылку.
**Why it happens:** TS не может вывести тип `items`, пока `items` определяется.
**How to avoid:** Явная аннотация возврата callback'а: `(): AnyPgColumn => items.id`. `AnyPgColumn` импортируется из `drizzle-orm/pg-core`.
**Warning signs:** `tsc`/сборка падает на `schema.ts`; редактор подсвечивает `items` как `any`.

### Pitfall 2: Ссылка на чужую покупку через `dependsOn` (IDOR)
**What goes wrong:** Пользователь B шлёт в `createItem`/`updateItem` `dependsOn = <id покупки A>`; FK пропускает (оба ряда в `items`), B узнаёт/использует чужой id.
**Why it happens:** FK проверяет целостность к таблице, НЕ владельца; репозитории scoping'ят по userId только собственную строку, не цель `dependsOn`.
**How to avoid:** В Server Action при `dependsOn != null` проверить `candidate ∈ findItemsForUser(userId)` перед записью. Один load обслуживает и владение, и цикл, и (в RSC-обёртке) кандидаты.
**Warning signs:** IDOR-тест на реальной Postgres: B задаёт `dependsOn` = id покупки A → ожидается `{ ok:false }`, строка B не пишется с чужой ссылкой.

### Pitfall 3: `blocked` показан у купленной покупки в архиве
**What goes wrong:** Покупка куплена, но её зависимость позже вернули в активные → `dependsOn != null && dep.purchasedAt == null` = true → в архиве рисуется «Заблокировано».
**Why it happens:** Derivation не учитывает собственный статус покупки.
**How to avoid:** `blocked = isBlocked(...) && item.purchasedAt === null` — блокировка осмысленна только для активных. Guard `setItemPurchased` всё равно отклонит повторную отметку.
**Warning signs:** Lock-строка в секции «Куплено».

### Pitfall 4: `undefined` не обнуляет `depends_on` на UPDATE
**What goes wrong:** Очистка зависимости в edit («Без зависимости») не персистится — старая ссылка остаётся.
**Why it happens:** Drizzle `.set()` исключает ключи со значением `undefined` из SQL UPDATE (тот же CR-01, что link/price) [VERIFIED: src/server/repos/items.ts:44-52].
**How to avoid:** В `updateItemForUser` добавить `dependsOn: data.dependsOn ?? null` в нормализацию (рядом с link/description/deadline). Sentinel `"none"` в форме уже маппится в `null`, но защита `?? null` нужна для `undefined`.
**Warning signs:** Интеграционный тест: create с `dependsOn`, update с `dependsOn: undefined`/`null` → `depends_on` в БД должен стать NULL.

### Pitfall 5: Клиентский фильтр кандидатов принят за защиту
**What goes wrong:** Cycle-небезопасные кандидаты спрятаны в дропдауне, но серверная проверка не сделана — подделанный submit создаёт цикл (deadlock A↔B).
**Why it happens:** Доверие клиенту (never-trust-client).
**How to avoid:** `wouldCreateCycle` — авторитетно в Server Action; клиентская фильтрация лишь для UX.
**Warning signs:** Нет unit-теста цикла / нет ветки `{ ok:false, field:"dependsOn" }` в действии.

### Pitfall 6: Ошибка цикла не привязана к полю формы
**What goes wrong:** Циклическая ошибка показывается форм-левел `Alert` вместо `FormMessage` под `dependsOn` (UI-SPEC требует ошибку поля).
**Why it happens:** Текущие `createItem`/`updateItem` возвращают `{ ok:false, error }` без указания поля [VERIFIED: new/actions.ts, edit/actions.ts].
**How to avoid:** Расширить результат: `{ ok:false, error, field?: "dependsOn" }`; в форме — `if (res.field) form.setError(res.field, { message: res.error })` иначе прежний `setFormError`.
**Warning signs:** Ошибка цикла не под селектом зависимости.

## Code Examples

### Zod: `dependsOn` optional/nullable + sentinel → null
```typescript
// src/lib/validation/item.ts — добавить в itemInputSchema
// Source: [VERIFIED against existing schema patterns], sentinel per UI-SPEC §Copywriting
// "none"/"" → null; иначе строка-id. Владение и цикл проверяются в Server Action.
dependsOn: z.preprocess(
  (v) => (v === "" || v === "none" || v == null ? null : v),
  z.string().nullable()
).optional(),
```

### Select зависимости в форме (после «Срок», до «Сомнения»)
```typescript
// src/components/items/AddItemForm.tsx — новый FormField; кандидаты приходят пропом
// Source: [VERIFIED — по образцу существующих enum-Select в AddItemForm]
// props: candidates: { id: string; title: string }[]  (из RSC-обёртки new/edit page)
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
          <SelectValue placeholder={
            candidates.length === 0 ? "Нет других покупок" : "Выберите покупку (необязательно)"
          } />
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

### RSC-обёртка: построение кандидатов (self + cycle-небезопасные исключены)
```typescript
// src/app/(app)/list/[id]/edit/page.tsx (и new/page.tsx без editedId)
// Source: [VERIFIED against existing edit/page.tsx + findItemsForUser]
const rows = await findItemsForUser(user.id);
const map = new Map(rows.map((r) => [r.id, r.dependsOn]));
const candidates = rows
  .filter((r) => r.id !== id)                                  // не self
  .filter((r) => !wouldCreateCycle(map, id, r.id))             // не cycle-unsafe (D-05)
  // купленные исключаются из НОВОГО выбора (купленная зависимость не блокирует);
  // в edit текущая выбранная остаётся показанной (prefill-консистентность)
  .filter((r) => r.purchasedAt === null || r.id === item.dependsOn)
  .map((r) => ({ id: r.id, title: r.title }));
```

### Server Action: владение + цикл (createItem/updateItem)
```typescript
// В createItem/updateItem после safeParse, до записи. editedId: id в updateItem, null в createItem.
// Source: [VERIFIED against existing actions + Pattern 2]
const CYCLE_ERROR = "Нельзя выбрать эту покупку — получится цикл зависимостей."; // UI-SPEC
if (parsed.data.dependsOn != null) {
  const own = await findItemsForUser(user.id);
  const map = new Map(own.map((r) => [r.id, r.dependsOn]));
  if (!map.has(parsed.data.dependsOn)) {                        // владение (IDOR, V4)
    return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
  }
  if (wouldCreateCycle(map, editedId, parsed.data.dependsOn)) { // D-05
    return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ручная чистка ссылок при удалении (задел из CONTEXT Фазы 3) | FK `onDelete: "set null"` (D-06) | Phase 5 | БД обнуляет `depends_on` автоматически; `deleteItemForUser` не трогаем |
| `drizzle-kit push` (dev-режим) | `generate` + `migrate` (SQL в git) | Фаза 1 (перенос) | Детерминированные миграции; self-FK едет тем же путём |

**Deprecated/outdated:** Ничего специфичного фазе. Стек актуален (Next 16.2, React 19.2, Drizzle 0.45, Zod 4, Vitest 4 — всё установлено).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Алгоритм `wouldCreateCycle` (обход `depends_on` от кандидата к source с visited-set) корректно ловит self + транзитивные циклы и ограничен при corrupt-cycle | Pattern 2 | Низкий — покрывается unit-тестами (RED→GREEN); логика проста и детерминирована |
| A2 | `blocked = isBlocked(...) && item.purchasedAt === null` (не рисовать lock у купленной) — верное поведение для архива | Pattern 4 / Pitfall 3 | Низкий — согласуется с D-02/D-04; подтвердить в UAT визуально |
| A3 | Ошибку цикла показывать через `form.setError("dependsOn")` требует расширения результата действия полем `field` | Pitfall 6 / Code Examples | Низкий — деталь реализации; альтернатива форм-левел Alert хуже по UX (UI-SPEC требует ошибку поля) |
| A4 | `drizzle-kit generate` эмитит ADD COLUMN + отдельный ADD CONSTRAINT для self-FK (как показанный SQL) | Pattern 1 | Низкий — сверить фактический вывод 0003 при генерации; тип/сигнатура FK verified против установленного пакета |
| A5 | Исключать купленные покупки из НОВЫХ кандидатов, но сохранять текущую выбранную в edit | Code Examples (кандидаты) | Низкий — дискреция CONTEXT/UI-SPEC; чисто UX, не влияет на корректность |

## Open Questions

1. **Формат ошибки цикла: поле vs форм-левел**
   - What we know: UI-SPEC требует ошибку под селектом (`FormMessage`); действия сейчас возвращают только `{ ok, error }`.
   - What's unclear: расширять ли тип результата полем `field` или ввести отдельный код ошибки.
   - Recommendation: добавить опциональное `field?: "dependsOn"` в `CreateItemResult`/`UpdateItemResult`, в форме — `form.setError`. Минимальное изменение, соответствует UI-SPEC.

2. **Guard блокировки: 2 read'а vs self-join хелпер**
   - What we know: `findItemForUser` уже IDOR-безопасен; guard делает до 2 чтений.
   - What's unclear: нужен ли отдельный `isItemBlockedForUser` (один SQL с self-join) ради производительности.
   - Recommendation: для MVP — 2 read'а через существующий шов (проще, тестируемо); оптимизацию отложить.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (локально + test) | миграция self-FK, интеграционные/e2e тесты | ✓ | 18 (`D:\Programs\pg`) | — |
| `drizzle-kit` | generate/migrate 0003 | ✓ | 0.31.10 | — |
| Vitest | unit + интеграционные (node env) тесты | ✓ | 4.1.10 | — |
| Playwright | e2e флоу блокировки | ✓ | 1.62.0 | — |
| `lucide-react` `Lock` | иконка блокировки | ✓ | 1.27.0 (`Lock` экспортируется) | — |
| Новые npm-пакеты | — | N/A | — | не требуются |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

Примечание: `psql` не в PATH; миграции применяются через `drizzle-kit migrate` (Node), поэтому это не блокер. `DATABASE_URL`/`DATABASE_URL_TEST` живут в `.env.local` (untracked, недоступен файловым инструментам агента) — генерацию/применение миграции запускает пользователь/исполнитель, у которого env доступен.

## Validation Architecture

> `workflow.nyquist_validation: true` → секция включена.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit + интеграционные, `// @vitest-environment node` для БД) + Playwright 1.62.0 (e2e) |
| Config file | `vitest.config.ts` (alias `@/*`, server-only-stub, setup `tests/helpers/vitest-db-setup.ts`), `playwright.config.ts` (порт 3100, `global-setup`) |
| Quick run command | `npx vitest run src/lib/deps` (новые чистые модули) |
| Full suite command | `npm test` (Vitest) + `npm run test:e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-01 | `wouldCreateCycle`: self, A→B/B→A, транзитив, corrupt-cycle bound, create→false | unit | `npx vitest run src/lib/deps/cycle.test.ts` | ❌ Wave 0 |
| DEP-01 | `isBlocked`: dependsOn null→false, dep не куплена→true, dep куплена→false | unit | `npx vitest run src/lib/deps/blocked.test.ts` | ❌ Wave 0 |
| ITEM-06 | Zod `dependsOn`: null/undefined/строка приняты; sentinel `"none"`/`""`→null | unit | `npx vitest run src/lib/validation/item.test.ts` | ✅ (расширить) |
| ITEM-06 / D-06 | FK `onDelete set null`: delete зависимости → `depends_on` ссылающейся = NULL | integration (real PG) | `npx vitest run src/server/repos/items.iso.test.ts` | ✅ (расширить) |
| ITEM-06 / V4 | IDOR: B задаёт `dependsOn` = id покупки A → отклонено (владение) | integration/action | `npx vitest run` (новый action-тест или repo-хелпер) | ❌ Wave 0 |
| ITEM-06 | create/update персистит `dependsOn`; update `undefined`/`null`→NULL (CR-01) | integration (real PG) | `npx vitest run src/server/repos/items.iso.test.ts` | ✅ (расширить) |
| DEP-01 / D-03 | Guard: отметить «куплено» заблокированную → `{ ok:false }`; снятие всегда ok | integration/action | новый тест `setItemPurchased`/`isBlocked` orchestration | ❌ Wave 0 |
| DEP-01/02 | e2e: create A, B depends A → B lock+disabled → купить A → B авто-разблок | e2e | `npm run test:e2e -- e2e/app/dependencies.spec.ts` | ❌ Wave 0 |
| DEP-01 / D-05 | e2e: выбор cycle-небезопасной → ошибка поля, submit заблокирован | e2e | `npm run test:e2e -- e2e/app/dependencies.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/deps` (быстрые чистые тесты, < 5 c)
- **Per wave merge:** `npm test` (полный Vitest, вкл. интеграционные на реальной PG)
- **Phase gate:** `npm test` + `npm run test:e2e` зелёные до `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/deps/cycle.test.ts` — DEP-01 (запрет циклов, D-05)
- [ ] `src/lib/deps/blocked.test.ts` — DEP-01 (derivation блокировки)
- [ ] `src/lib/deps/cycle.ts`, `src/lib/deps/blocked.ts` — реализация (RED→GREEN)
- [ ] Расширить `src/server/repos/items.iso.test.ts` — FK set-null, persist `dependsOn`, IDOR чужой `dependsOn`, clear→NULL
- [ ] Расширить `tests/helpers/db.ts` `seedItem` — опциональное поле `dependsOn` для сидов графа
- [ ] Новый action-уровневый тест guard'а `setItemPurchased` (или репо-хелпер `isItemBlockedForUser`)
- [ ] `e2e/app/dependencies.spec.ts` — флоу блокировки→покупка зависимости→авто-разблокировка + ошибка цикла
- [ ] Расширить `src/lib/validation/item.test.ts` — кейсы `dependsOn` + sentinel

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` → секция обязательна.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Не затрагивается (Better Auth, Фаза 1) |
| V3 Session Management | no | Без изменений |
| V4 Access Control | **yes** | `dependsOn` обязан ссылаться на СВОЮ покупку — проверка `candidate ∈ findItemsForUser(userId)` в Server Action; write-швы уже scoping'ят по userId; guard блокировки читает через `findItemForUser` (userId-scoped) |
| V5 Input Validation | **yes** | `itemInputSchema.safeParse` на сервере (never-trust-client); `dependsOn` — строка/null; sentinel маппинг; `purchased` → строгий boolean (перенос T-4-05) |
| V6 Cryptography | no | Не затрагивается |

### Known Threat Patterns for Next.js Server Actions + Postgres
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ссылка `dependsOn` на чужую покупку (кросс-юзер) | Information Disclosure / Elevation | Проверка владения кандидата в Server Action (не только FK); IDOR-тест на реальной PG |
| Обход `disabled`-чекбокса подделанным запросом «куплено» | Tampering | Серверный guard `setItemPurchased` (D-03), `{ ok:false }` при блокировке |
| Deadlock через взаимные зависимости (A↔B) | Denial of Service (функциональный) | `wouldCreateCycle` server-side (D-05); visited-set ограничивает и corrupt-cycle |
| Mass-assignment владельца через payload | Tampering / Elevation | userId ТОЛЬКО из сессии (`requireUser`), не из аргумента (перенос T-2-01/T-4-04) |
| SQL-инъекция через `dependsOn` | Tampering | Параметризованные Drizzle-запросы (`.values()`/`.set()`/`eq`) — перенос T-2-10 |

## Sources

### Primary (HIGH confidence)
- Установленный пакет `drizzle-orm@0.45.2` — `pg-core/columns/common.d.ts` (`AnyPgColumn`, `references(ref, actions)`, `ReferenceConfig`), `pg-core/foreign-keys.d.ts` (`UpdateDeleteAction` incl. `'set null'`) — VERIFIED через grep/node
- Кодовая база проекта — `schema.ts`, `repos/items.ts`, `list/actions.ts`, `new/actions.ts`, `[id]/edit/actions.ts`, `validation/item.ts`, `list/page.tsx`, `[id]/edit/page.tsx`, `lib/list/sort.ts`, `AddItemForm.tsx`, `ItemCard.tsx`, `PurchaseCheckbox.tsx`, `ListView.tsx`, `items.iso.test.ts`, `tests/helpers/db.ts`, `drizzle/000{1,2}_*.sql`, `drizzle/meta/_journal.json`, `playwright.config.ts`, `vitest.config.ts`, `e2e/purchase-archive.spec.ts` — VERIFIED (прочитаны)
- `lucide-react@1.27.0` — экспорт `Lock` — VERIFIED (`node -e`)
- CONTEXT.md (D-01…D-06) + UI-SPEC (approved 6/6) — locked decisions

### Secondary (MEDIUM confidence)
- CLAUDE.md стек-таблица (Drizzle self-ref задел, миграции в git)

### Tertiary (LOW confidence)
- Алгоритм `wouldCreateCycle` и derivation `isBlocked` — авторская реализация (не из внешнего источника), покрывается unit-тестами [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — все версии verified против `package.json`/установленных пакетов; новых нет
- Architecture: HIGH — self-FK idiom и сигнатура FK verified против установленного drizzle-orm; guard/RSC-паттерны verified против существующего кода Фазы 4
- Pitfalls: HIGH — все ссылаются на прочитанный код (CR-01, границу примитивов, IDOR-швы) или на verified type defs
- Cycle/blocked алгоритмы: MEDIUM — корректны по построению, но authored; закрываются TDD

**Research date:** 2026-09-12
**Valid until:** 2026-10-12 (стабильный стек; ре-верифицировать при апгрейде drizzle-orm/drizzle-kit)
