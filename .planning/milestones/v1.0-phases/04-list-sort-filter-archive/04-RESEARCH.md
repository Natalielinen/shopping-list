# Phase 4: Список — сортировка, фильтры и архив — Research

**Researched:** 2026-08-02
**Domain:** Next.js 16 (App Router) RSC + client state, Drizzle-миграция (nullable-колонка), Server Action + `useOptimistic`, детерминированная сортировка в JS, `sonner`-toast
**Confidence:** HIGH (стек и паттерны зафиксированы в CLAUDE.md и уже доказаны кодом Фаз 1–3; новизна фазы мала и локальна)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Сортировка (LIST-01/02/03)**
- **D-01:** Три режима сортировки переключаются выпадающим shadcn `Select` в закреплённой панели над списком. Дефолт — по приоритету (убыв.). Порядок опций: приоритет → по добавлению → по алфавиту.
- **D-02:** Детерминированные tiebreakers (LIST-01): по приоритету — `total` убыв., затем `createdAt` убыв., затем `id`; «по добавлению» — `createdAt` убыв. (новые сверху), затем `id`; «по алфавиту» — `title` возр. (А→Я), затем `createdAt` убыв., затем `id`.
- **D-03:** Приоритет считается на чтении единым `now`, сортировка выполняется в JS (перенос из Фазы 2 — SCORE-05 / D-12), НЕ через SQL `ORDER BY` по вычисляемому приоритету.

**Отметка «куплено» и архив (LIST-04/05)**
- **D-04:** Покупка отмечается купленной чекбоксом на карточке — мгновенно, без модалки; показывается тост с действием «Отменить» (undo). Недеструктивно и обратимо (в отличие от удаления в Фазе 3).
- **D-05:** Отметка обратима в любой момент: снятие чекбокса в секции «Куплено» возвращает покупку в активные. `purchased` — обратимый toggle, а не финальное состояние.
- **D-06:** При включённом фильтре «показывать купленные» купленные показываются ОТДЕЛЬНОЙ секцией «Куплено» ниже активных (не вперемешку). По умолчанию (фильтр выключен) купленные скрыты.
- **D-07:** Статус «куплено» хранится nullable-полем на `items` (семантика: `null` = активна, non-null = куплена/в архиве; например `purchasedAt timestamp`). Требует Drizzle-миграции. Reversibility: one-way (добавление колонки через миграцию; смена представления позже потребует миграции данных). Семантика `null = активна` зафиксирована.
- **D-08:** Запись статуса — через новый Server Action (напр. `setItemPurchased(id, purchased)`), scoped по `userId` из `requireUser()` — тот же шов изоляции, что `updateItemForUser`/`deleteItemForUser`. Обязателен IDOR-тест изоляции на реальной Postgres (TDD, RED-first).

**Состояние сортировки/фильтра**
- **D-09:** Выбор сортировки и «показывать купленные» — эфемерное клиентское состояние (`useState`), НЕ в URL/localStorage; сбрасывается к дефолту (приоритет, купленные скрыты) при перезагрузке. `nuqs` НЕ добавляем (осознанное отклонение рекомендации CLAUDE.md для v1).
- **D-10:** Список рендерится RSC (грузит ВСЕ покупки пользователя через `findItemsForUser`, включая купленные), а клиентский компонент держит состояние сортировки/фильтра и сортирует/фильтрует на клиенте (набор на пользователя мал). Reversibility: reversible.

### Claude's Discretion
- Точное имя/тип поля статуса (`purchasedAt` vs `isPurchased` + timestamp) — на усмотрение research/planner; D-07 задаёт семантику `null = активна`. **→ Research рекомендует `purchasedAt timestamp` (nullable) — см. §Standard Stack / §Code Examples.**
- Сортировка внутри секции «Куплено» — по `purchasedAt` убыв. (недавно купленные выше), если поле timestamp.
- Точная раскладка чекбокса на карточке и панели сортировки/фильтра — задаётся в UI-SPEC (approved).
- Алфавитная сортировка: `localeCompare('ru')`, case-insensitive.
- Механика undo (напр. `sonner` toast с кнопкой «Отменить») — стандартный подход; библиотеку тоста добавить, если её ещё нет.

### Deferred Ideas (OUT OF SCOPE)
- Персистентность выбора сортировки/фильтра между сессиями (URL через `nuqs` или localStorage) — осознанно отклонена в v1 (D-09).
- Зависимости покупок (`depends`, блокировка) — Фаза 5 (DEP-01/DEP-02).
- Восстановление жёстко удалённых покупок — вне scope (удаление осталось hard delete из Фазы 3; «архив» здесь — только про купленные).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIST-01 | Список по умолчанию отсортирован по убыванию приоритета (детерминированный tiebreaker) | Чистый компаратор `byPriority` (`total` убыв. → `createdAt` убыв. → `id`), единый `now` в RSC, сортировка в JS. §Architecture Pattern 2, §Code Examples |
| LIST-02 | Сортировка по порядку добавления | Компаратор `byCreatedAt` (`createdAt` убыв. → `id`). §Code Examples |
| LIST-03 | Сортировка по алфавиту | Компаратор `byTitle` (`title.localeCompare(other, 'ru', { sensitivity: 'base' })` → `createdAt` убыв. → `id`). §Pitfall 5 |
| LIST-04 | Отметка покупки купленной; купленные уходят в архив | Nullable `purchasedAt` + Server Action `setItemPurchased` + `useOptimistic` + `router.refresh()`. §Architecture Pattern 1/3, §Code Examples |
| LIST-05 | Фильтр «показывать купленные» открывает архив в отдельной секции «Куплено» | Клиентский `showPurchased` (`useState`), партиционирование по `purchasedAt === null`. §Architecture Pattern 2 |
| LIST-08 | Интерфейс адаптивный, mobile-first | Наследуется из Фаз 1–3 (Tailwind v4 mobile-first), тач-цели ≥44px, sticky-панель. Backstop-проверки визуальные. §Validation Architecture |
</phase_requirements>

## Summary

Фаза добавляет к уже работающему списку (Фазы 2–3) три локальных механики, ни одна из которых не требует нового стека: **(1)** одна nullable-колонка `purchased_at` на таблице `items` через штатную Drizzle-миграцию; **(2)** тонкий клиентский слой поверх существующего RSC-списка, который держит эфемерное состояние сортировки/фильтра (`useState`) и раскладывает уже посчитанные на сервере покупки на две группы; **(3)** новый write-шов `setItemPurchasedForUser` по точному образцу `deleteItemForUser` из Фазы 3, вызываемый Server Action'ом `setItemPurchased`, с оптимистичным флипом и undo-тостом (`sonner`).

Ключевое архитектурное наблюдение: **приоритет по-прежнему считается на сервере единым `now`** (перенос SCORE-05/D-03), а клиент получает уже готовое число `total` и сортирует по нему. Это устраняет главный риск клиентской сортировки — недетерминизм и hydration-mismatch: клиент не читает `Date.now()`, а лишь сравнивает предвычисленные примитивы. Единственная новая зависимость — `sonner` (официальный shadcn-компонент, verdict `OK`, 43.9M загрузок/нед, репозиторий `emilkowalski/sonner`, без postinstall). Обёртку shadcn упрощаем до `theme="light"` — `next-themes` НЕ добавляем (тёмной темы в проекте нет).

Вся сложность фазы — детерминированная, чисто-функциональная и потому идеально ложится на TDD: компараторы сортировки и партиционирование выносятся в чистый модуль и покрываются юнит-тестами Vitest; новый write-шов покрывается IDOR-тестом на реальной Postgres (`.iso.test.ts`); сквозные переходы — Playwright.

**Primary recommendation:** добавить `purchasedAt: timestamp("purchased_at")` (nullable, без default) в `schema.ts` → `npx drizzle-kit generate` → `npx drizzle-kit migrate`; вынести компараторы и партиционирование в чистый `src/lib/list/sort.ts` (TDD RED-first); добавить `setItemPurchasedForUser` в `items.ts` + Server Action `setItemPurchased` (образец `deleteItem`); построить клиентский `ListView` поверх RSC-данных; `PurchaseCheckbox` на `useOptimistic` + `useTransition` + `router.refresh()`; `sonner` `<Toaster theme="light" position="bottom-center" richColors={false} />` в `(app)/layout.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Хранение статуса «куплено» | Database / Storage (`items.purchased_at`) | — | `null`/timestamp — минимальное персистентное состояние; timestamp даёт бесплатный ключ сортировки архива |
| Загрузка всех покупок пользователя | API / Backend (RSC + `findItemsForUser`) | — | Изоляция по `userId` только на серверном шве данных (AUTH-04); RSC = быстрый first paint на мобильном |
| Вычисление приоритета `total` | API / Backend (RSC, единый `now`) | — | SCORE-05/D-03 — считается на чтении на сервере, клиенту уходит готовое число |
| Сортировка/фильтр (выбор режима) | Frontend / Client (`useState`) | — | Эфемерно, per-user набор мал (D-09/D-10); URL/localStorage сознательно исключены |
| Применение сортировки/партиционирования | Frontend / Client (чистые компараторы в JS) | Backend (данные из RSC) | Детерминизм на предвычисленных примитивах; тестируется юнит-тестами без БД |
| Запись статуса «куплено» | API / Backend (Server Action + repo, scoping по `userId`) | Client (оптимистичный флип) | Тот же шов изоляции, что update/delete Фазы 3; IDOR невозможен |
| Мгновенный отклик + undo | Frontend / Client (`useOptimistic`, `sonner`) | Backend (`router.refresh()` ресинк) | Оптимистика — UX-слой; источник истины остаётся серверным |

## Standard Stack

### Core (уже установлено — не добавлять)
| Library | Version (в проекте) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (App Router) | `16.2.12` | RSC-список + Server Actions + `router.refresh()` | Зафиксирован CLAUDE.md; вся data-flow фазы на нём |
| React | `19.2.4` | `useOptimistic`, `useTransition`, client-leaf | `useOptimistic` — штатный React 19 hook для мгновенной отметки |
| Drizzle ORM | `0.45.2` | `.update().set().where(and(eq(id),eq(userId)))` для нового write-шва | SQL-first, тот же паттерn, что update/delete Фазы 3 |
| drizzle-kit | `0.31.10` | `generate`/`migrate` для колонки `purchased_at` | Детерминированный SQL-миграции в `./drizzle`, коммитятся в git |
| PostgreSQL | 16/17 (local: PG 18 `D:\Programs\pg`) | Хранение `purchased_at` | — |
| shadcn/ui `Select` / `Checkbox` | установлены (Фаза 2) | Контрол сортировки + чекбоксы фильтра и «куплено» | Переиспользование, нового примитива не требуется |

### Supporting (ДОБАВИТЬ ровно одно)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` (через `npx shadcn add sonner`) | `2.0.7` (latest) | Undo-тост после отметки «куплено» (D-04) | Единственная новая зависимость фазы. `<Toaster />` монтируется 1 раз в `(app)/layout.tsx`. Обёртку упростить до `theme="light"` |

**Не добавлять:** `next-themes` (обёртка shadcn/sonner тянет его по умолчанию — удалить импорт, задать `theme="light"`); `nuqs` (D-09 — сознательное отклонение); `@tanstack/react-query` (оптимистики `useOptimistic` + `router.refresh()` достаточно для MVP).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `purchasedAt timestamp` (nullable) | `isPurchased boolean` + отдельный `purchasedAt` | Две колонки вместо одной; риск рассинхрона флага и времени. Один nullable timestamp кодирует и статус (`null`?), и порядок архива (`purchasedAt` убыв.) — строго проще. **Рекомендуется timestamp.** |
| `useOptimistic` + `useTransition` | Плоский `useState`-pending (каркас `DeleteItemButton`) | Плоский `useState` уже доказан в Фазе 3 и проще; UI-SPEC прямо требует `useOptimistic`. Рекомендуем `useOptimistic`, но §Pitfall 3 описывает нюанс реконсиляции — плоский fallback приемлем, если реконсиляция окажется капризной |
| Клиентская сортировка/фильтр | SQL `ORDER BY` + повторный запрос на смену сортировки | Приоритет вычисляемый (не хранится, SCORE-05) → SQL по нему невозможен без денормализации; набор per-user мал → клиент дешевле и без round-trip (D-03/D-10) |

**Installation:**
```bash
npx shadcn@latest add sonner
# добавит зависимость `sonner` (2.0.7) в package.json и создаст src/components/ui/sonner.tsx
# ЗАТЕМ: отредактировать sonner.tsx — убрать import next-themes/useTheme, задать theme="light"
```

**Version verification:** `sonner@2.0.7` подтверждён `npm view sonner version` (latest = 2.0.7) и seam'ом package-legitimacy (verdict `OK`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `sonner` | npm | published 2025-08-02 (v2.0.7) | 43.9M/нед | github.com/emilkowalski/sonner | **OK** | Approved — официальный shadcn-компонент, postinstall = null |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`sonner` обнаружен из UI-SPEC (approved-контракт, официальный shadcn-компонент) И подтверждён seam'ом `package-legitimacy check` (`OK`) + `npm view`. Тег: `[VERIFIED: npm registry]`.

## Architecture Patterns

### System Architecture Diagram

```
                         (app)/list/page.tsx  [RSC]
                                   │
        getCurrentUser() ──► userId (ТОЛЬКО из серверной сессии, AUTH-04)
                                   │
        findItemsForUser(userId) ─► ВСЕ строки items (активные + купленные, D-10)
                                   │
        const now = new Date()  (ЕДИНЫЙ на прогон, SCORE-05/D-03)
                                   │
        map → { id, title, total, breakdown, createdAtMs, purchasedAtMs }
             (total = computeTotal(item, now); Date → epoch ms, §Pitfall 4)
                                   │
                                   ▼
                        <ListView items={...} />  ['use client']
                                   │
        useState: sortKey='priority' | showPurchased=false  (эфемерно, D-09)
                                   │
        partitionByPurchased(items) ─► { active[], purchased[] }   (purchasedAtMs === null?)
                                   │
        sortItems(active, sortKey)                 sortItems(purchased, 'purchasedAt' desc)
                                   │                                   │
                                   ▼                                   ▼
        ┌──────────────────────────────┐        (только если showPurchased && purchased.length)
        │ Активный список: <ItemCard>  │        ┌──────────────────────────────────────┐
        │  + <PurchaseCheckbox/> (leaf)│        │ Секция «Куплено» (border-t, mt-8):    │
        └───────────┬──────────────────┘        │  <ItemCard> dimmed + line-through      │
                    │                            └───────────────────┬───────────────────┘
                    │ тап чекбокса                                    │ снять чекбокс
                    ▼                                                 ▼
        setItemPurchased(id, true) ◄───────────────────► setItemPurchased(id, false)
              [Server Action 'use server']
                    │  requireUser() → userId
                    ▼
        setItemPurchasedForUser(userId, id, purchased)  [repo, server-only]
              UPDATE items SET purchased_at = (purchased ? now() : NULL)
              WHERE id = ? AND user_id = ?   (IDOR-scoping, D-08)
                    │ returning() → row | null (null = чужая/нет строки → {ok:false})
                    ▼
        {ok:true} → useOptimistic флип уже показан → router.refresh() ресинк RSC
                  → sonner toast «Покупка отмечена купленной» + [Отменить]
```

Диаграмма показывает поток данных; сопоставление способностей файлам — в §Component Responsibilities ниже.

### Component Responsibilities
| Файл | Роль | Изменение в Фазе 4 |
|------|------|--------------------|
| `src/server/db/schema.ts` | Схема `items` | + колонка `purchasedAt: timestamp("purchased_at")` (nullable) |
| `src/server/repos/items.ts` | Шов изоляции | + `setItemPurchasedForUser(userId, id, purchased)` |
| `src/app/(app)/list/actions.ts` (нов.) | Server Action | + `setItemPurchased(id, purchased)` (образец `deleteItem`) |
| `src/app/(app)/list/page.tsx` | RSC-загрузка | грузит ВСЕ покупки, считает `total` единым `now`, отдаёт примитивы в `ListView` |
| `src/components/items/ListView.tsx` (нов.) | Клиентский слой | `useState` sortKey/showPurchased, партиции, рендер двух групп + `ListControls` |
| `src/components/items/ListControls.tsx` (нов.) | Панель | `Select` сортировки + `Checkbox` фильтра (sticky) |
| `src/components/items/PurchaseCheckbox.tsx` (нов.) | client-leaf | `useOptimistic` + `useTransition` + `setItemPurchased` + `sonner` |
| `src/components/items/ItemCard.tsx` | Карточка | + слот чекбокса «куплено» слева от title; + приглушённое лечение купленной |
| `src/lib/list/sort.ts` (нов.) | Чистая логика | компараторы + `partitionByPurchased` + `sortItems` (TDD-ядро) |
| `src/app/(app)/layout.tsx` | Оболочка | + `<Toaster theme="light" position="bottom-center" richColors={false} />` |
| `src/components/ui/sonner.tsx` (нов., от shadcn) | Обёртка | упростить до `theme="light"`, убрать `next-themes` |

### Recommended Project Structure
```
src/
├── lib/list/sort.ts                      # чистые компараторы + partition (НОВОЕ, TDD-ядро)
├── lib/list/sort.test.ts                 # юнит-тесты компараторов/tiebreak/localeCompare (НОВОЕ)
├── server/repos/items.ts                 # + setItemPurchasedForUser
├── server/repos/items.iso.test.ts        # + IDOR/persist-тесты нового шва (реальная PG)
├── app/(app)/list/
│   ├── page.tsx                          # RSC: все покупки + total(now) → ListView
│   └── actions.ts                        # + setItemPurchased (НОВОЕ; или рядом)
├── components/items/
│   ├── ListView.tsx                      # клиентский слой сортировки/фильтра (НОВОЕ)
│   ├── ListControls.tsx                  # sticky-панель Select+Checkbox (НОВОЕ)
│   ├── PurchaseCheckbox.tsx              # client-leaf: useOptimistic + sonner (НОВОЕ)
│   └── ItemCard.tsx                       # + чекбокс + dimmed-лечение
├── components/ui/sonner.tsx              # обёртка Toaster (НОВОЕ, theme="light")
└── app/(app)/layout.tsx                  # + <Toaster/>
e2e/app/purchase-archive.spec.ts          # Playwright: mark→archive→undo→filter→sort (НОВОЕ)
```

### Pattern 1: Nullable-колонка статуса через Drizzle-миграцию
**What:** одна nullable `timestamp`-колонка кодирует и статус (`null` = активна), и порядок архива.
**When to use:** обратимый двоичный статус, у которого «когда» полезно для сортировки.
**Example:**
```typescript
// src/server/db/schema.ts — внутри pgTable("items", {...}) после createdAt
// Статус «куплено» (D-07): null = активна, non-null timestamp = куплена/в архиве.
// Nullable без default → существующие строки получают NULL = остаются активными.
// Не участвует в подсчёте очков (ScoredFields её не содержит → scoring не трогаем).
purchasedAt: timestamp("purchased_at"),
```
```bash
npx drizzle-kit generate   # → drizzle/0002_*.sql: ALTER TABLE "items" ADD COLUMN "purchased_at" timestamp;
npx drizzle-kit migrate    # применяет к DATABASE_URL (.env.local подхватывается drizzle.config.ts)
```
Тестовая БД мигрируется автоматически: `tests/helpers/db.ts::ensureMigrated()` прогоняет `./drizzle` перед первым тестом; `resetDb()` уже `TRUNCATE ... items ...` — новая колонка ничего не ломает.

### Pattern 2: Клиентский слой сортировки/фильтра поверх RSC-данных
**What:** RSC считает `total` единым `now` и отдаёт примитивы; `'use client'`-компонент держит `useState` и партиционирует/сортирует чистыми функциями.
**When to use:** маленький per-user набор, вычисляемый серверный ключ, эфемерное UI-состояние (D-09/D-10).
**Example:** см. §Code Examples («ListView» и «sort.ts»).

### Pattern 3: Write-шов + Server Action + оптимистика (образец Фазы 3)
**What:** repo-функция со scoping по `userId` → Server Action (`requireUser`, без redirect, `{ok}`-результат) → client-leaf с `useOptimistic`/`useTransition` → `router.refresh()`.
**When to use:** каждая новая запись в данные (изоляция AUTH-04).
**Example:** см. §Code Examples.

### Anti-Patterns to Avoid
- **`new Date()` в клиентском рендере/сортировке** — вернёт недетерминизм и hydration-mismatch. `total` считается ТОЛЬКО в RSC (§Pitfall 4).
- **SQL `ORDER BY` по вычисляемому приоритету** — приоритет не хранится (SCORE-05); запрещено D-03.
- **Скоуп по `userId` из payload** — `userId` только из `requireUser()`; `id`/`purchased` из аргументов не определяют владельца (mass-assignment, V4).
- **Второй write-путь помимо repo-шва** — все записи через `setItemPurchasedForUser`, иначе изоляцию легко забыть.
- **`next-themes` ради sonner** — тёмной темы нет; фиксируем `theme="light"`.
- **`AlertDialog`/подтверждение на «куплено»** — действие недеструктивно (D-04/D-05); защита — обратимость + undo-тост, не модалка.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast с кнопкой undo | Свой портал/таймер/стек тостов | `sonner` (`toast(msg, { action })`) | Стекинг, авто-dismiss, доступность, свайп — уже решено; 43.9M загрузок/нед |
| Мгновенный отклик до ответа сервера | Ручной «pending mirror» из нескольких `useState` | `useOptimistic` + `useTransition` | Штатный React 19 механизм с авто-откатом при ошибке транзакции |
| ALTER TABLE вручную | Сырой SQL мимо drizzle | `drizzle-kit generate`/`migrate` | Детерминированный, версионированный SQL; синхрон с `_journal.json`; тест-БД мигрируется тем же путём |
| Русская алфавитная сортировка | Своё сравнение по `charCodeAt`/маппинг кириллицы | `String.prototype.localeCompare(other, 'ru', { sensitivity: 'base' })` | Node 22 = full ICU; корректный порядок Ё/регистр без ручных таблиц (§Pitfall 5) |
| Изоляция по пользователю | Проверка владельца в UI/Server Action до repo | `and(eq(items.id, id), eq(items.userId, userId))` в repo | Единый шов — забыть нельзя; доказано IDOR-тестами Фаз 1–3 |

**Key insight:** вся «новизна» фазы либо уже решена библиотекой (sonner, drizzle-kit, useOptimistic, localeCompare), либо копирует доказанный внутренний паттерн (repo-scoping Фазы 3). Ручного кода почти нет — самое ценное собственное — чистые компараторы, которые и есть предмет TDD.

## Runtime State Inventory

> Фаза добавляет одну аддитивную nullable-колонку (не rename/refactor). Инвентарь ограничен влиянием миграции на существующее состояние.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Существующие строки `items` в prod-БД (`shopping_list`) и тест-БД (`shopping_list_test`) | Нет миграции данных: nullable-колонка без default → все существующие строки получают `NULL` = «активна». Семантика D-07 выполняется автоматически |
| Live service config | Нет — приложение читает БД через код, внешних сервисов с закешированным именем колонки нет | None |
| OS-registered state | None — verified: миграции применяются вручную (`drizzle-kit migrate`), Task Scheduler/pm2 не задействованы | None |
| Secrets/env vars | `DATABASE_URL` / `DATABASE_URL_TEST` в `.env.local` (untracked, заблокированы для файловых инструментов) — имена не меняются | None |
| Build artifacts | Тип `Item = typeof items.$inferSelect` авто-расширится полем `purchasedAt: Date \| null` после правки схемы; `seedItem` в `tests/helpers/db.ts` НЕ задаёт `purchasedAt` → строки активны | Расширить `seedItem` опциональным `purchasedAt`, чтобы тесты могли засеять купленную покупку (Wave 0) |

**Канонический вопрос:** после правки схемы и `migrate` единственное «закешированное» — сгенерированный тип `Item` (обновится сам) и тестовый `seedItem` (нужно расширить для покрытия купленных строк). Prod/test-данные мигрируются без потери (все → активные).

## Common Pitfalls

### Pitfall 1: Смешение сортировки активных и купленных
**What goes wrong:** попытка отсортировать общий массив одним компаратором, затем «выдернуть» купленные — купленные оказываются перемешаны или отсортированы не тем ключом.
**Why it happens:** D-06 требует ОТДЕЛЬНУЮ секцию; UI-SPEC уточняет, что «Куплено» внутри себя всегда сортируется `purchasedAt` убыв., даже когда активный список сортируется иначе.
**How to avoid:** сперва `partitionByPurchased(items)` → `{active, purchased}`, ЗАТЕМ `sortItems(active, sortKey)` и отдельно `sortItems(purchased, 'purchasedAtDesc')`. Не сортировать до партиционирования.
**Warning signs:** купленная покупка «всплывает» по алфавиту/приоритету; порядок архива меняется при переключении Select.

> **Разночтение в контракте (для планировщика):** §Сортировка UI-SPEC говорит «смена сортировки затрагивает ОБЕ группы», но тут же — «секция Куплено внутри себя сортируется по `purchasedAt` убыв.». Более специфичное утверждение авторитетнее: **архив всегда сортируется `purchasedAt` убыв.** (+ tiebreak `id`), Select управляет только активным списком. Рекомендуется зафиксировать это в плане как разрешение неоднозначности.

### Pitfall 2: Пустые состояния при «все куплено»
**What goes wrong:** при отметке последней активной покупки список либо «схлопывается» в пустоту без подсказки, либо показывает наследуемый `Список пуст` (неверно — покупки есть, просто все куплены).
**Why it happens:** три разных empty-варианта (UI-SPEC §Empty-состояния): (a) 0 покупок вообще → `Список пуст` + панель НЕ рендерится; (b) все куплены + фильтр ВЫКЛ → `Активных покупок нет` + подсказка включить фильтр; (c) все куплены + фильтр ВКЛ → короткий `Активных покупок нет.` + секция «Куплено» ниже.
**How to avoid:** ветвление по `items.length === 0` (весь RSC) против `active.length === 0` (после партиции) × `showPurchased`. Панель рендерится только при `items.length > 0`.
**Warning signs:** `Список пуст` появляется при непустой БД; пустой заголовок «Куплено» без карточек.

### Pitfall 3: `useOptimistic` + `router.refresh()` — реконсиляция
**What goes wrong:** оптимистичный флип «отскакивает» обратно после `router.refresh()`, или оптимистика не применяется вовсе.
**Why it happens:** `useOptimistic` показывает оптимистичное значение только внутри активного transition и откатывается к БАЗОВОМУ пропу по завершении. Если базовый проп (из RSC) ещё не отражает новый статус, значение «мигает» назад. Вне `startTransition` оптимистичное обновление кинет предупреждение/не применится.
**How to avoid:** вызывать action И `router.refresh()` внутри `startTransition` (`useTransition`); базовым значением `useOptimistic` брать `purchasedAt !== null` из пропа. К моменту завершения транзакции `router.refresh()` уже подтянет свежие RSC-данные → оптимистичное и реальное совпадают, отскока нет. Pending-guard (`isPending`) от двойного тапа. Приемлемый fallback (проще, доказан Фазой 3): плоский `useState`-оптимизм как в `DeleteItemButton` + `router.refresh()`.
**Warning signs:** галочка мигает; React-warning «optimistic state update outside a transition».

### Pitfall 4: Сериализация `Date` через границу RSC→client
**What goes wrong:** передача `createdAt`/`purchasedAt` как `Date` в клиентский компонент работает, но провоцирует тонкие расхождения и лишние аллокации; сортировка по `Date` требует `.getTime()`.
**Why it happens:** через RSC-границу `Date` сериализуется, но клиентский компаратор всё равно должен свести к числу; смешение `Date` и числа в компараторе — источник багов.
**How to avoid:** в RSC приводить к примитивам: `createdAtMs: item.createdAt.getTime()`, `purchasedAtMs: item.purchasedAt?.getTime() ?? null`. Клиент сравнивает числа/строки — детерминированно, без `Date` в рендере. `total` — тоже уже число из RSC.
**Warning signs:** hydration-warning; `NaN` в сравнении; сортировка «прыгает».

### Pitfall 5: Русская алфавитная сортировка без явной локали
**What goes wrong:** `a.title.localeCompare(b.title)` без локали использует локаль рантайма (на сервере может быть `C`/`en`), Ё и регистр сортируются неверно; результат не совпадает клиент/сервер.
**Why it happens:** дефолтная локаль `localeCompare` зависит от окружения.
**How to avoid:** `a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })` — `sensitivity: 'base'` даёт case- и accent-insensitive порядок (D-09). Node 22 LTS = full ICU, коллация `ru` доступна. Tiebreak `createdAtMs` убыв. → `id` для стабильности при равных именах.
**Warning signs:** «Ёлка» не там; «молоко» и «Молоко» в разном порядке на сервере и клиенте.

### Pitfall 6: `router.refresh()` порядок с оптимистикой / без redirect в Server Action
**What goes wrong:** копирование ошибки Фаз 2–3 — `redirect()` внутри Server Action ловится try/catch (`NEXT_REDIRECT`).
**Why it happens:** известный Pitfall 7 проекта.
**How to avoid:** `setItemPurchased` НЕ вызывает `redirect()`; возвращает `{ok}`; навигацию/ресинк (`router.refresh()`) делает клиент. Остаёмся на `/list`.
**Warning signs:** необъяснимая ошибка после успешной записи; статус в БД сменился, но UI показал ошибку.

### Pitfall 7: Коллизия тап-зон на карточке
**What goes wrong:** тап по чекбоксу «куплено» случайно раскрывает `Collapsible` разбивки или задевает badge.
**Why it happens:** чекбокс добавляется в тот же контейнер, что title/badge.
**How to avoid:** чекбокс — ведущий контрол ряда заголовка (`h-11 w-11 shrink-0`), title `min-w-0 truncate`, badge `shrink-0`; разбивка/edit/delete — отдельный ряд ниже (уже так). Три независимых тач-цели ≥44px (UI-SPEC §Чекбокс).
**Warning signs:** разбивка раскрывается при отметке; badge выталкивается длинным title.

## Code Examples

> Иллюстрируют форму; идентификаторы/сигнатуры финализирует планировщик.

### Чистая логика сортировки (TDD-ядро) — `src/lib/list/sort.ts`
```typescript
// Чистые, детерминированные функции — без БД, без Date.now(). Предмет юнит-TDD.
export type SortKey = "priority" | "createdAt" | "title";

// Минимальная форма, которую RSC отдаёт клиенту (примитивы, §Pitfall 4).
export interface ListItem {
  id: string;
  title: string;
  total: number;          // computeTotal(item, now), посчитан в RSC
  createdAtMs: number;    // item.createdAt.getTime()
  purchasedAtMs: number | null; // null = активна (D-07)
}

export function partitionByPurchased(items: ListItem[]): {
  active: ListItem[];
  purchased: ListItem[];
} {
  const active: ListItem[] = [];
  const purchased: ListItem[] = [];
  for (const it of items) (it.purchasedAtMs === null ? active : purchased).push(it);
  return { active, purchased };
}

// Компараторы с детерминированными tiebreakers (D-02).
const byPriority = (a: ListItem, b: ListItem) =>
  b.total - a.total || b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id);

const byCreatedAt = (a: ListItem, b: ListItem) =>
  b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id);

const byTitle = (a: ListItem, b: ListItem) =>
  a.title.localeCompare(b.title, "ru", { sensitivity: "base" }) ||
  b.createdAtMs - a.createdAtMs ||
  a.id.localeCompare(b.id);

// Архив всегда по purchasedAt убыв. (§Pitfall 1), tiebreak id.
const byPurchasedAtDesc = (a: ListItem, b: ListItem) =>
  (b.purchasedAtMs ?? 0) - (a.purchasedAtMs ?? 0) || a.id.localeCompare(b.id);

const COMPARATORS: Record<SortKey, (a: ListItem, b: ListItem) => number> = {
  priority: byPriority,
  createdAt: byCreatedAt,
  title: byTitle,
};

export function sortActive(items: ListItem[], key: SortKey): ListItem[] {
  return [...items].sort(COMPARATORS[key]); // не мутируем вход
}
export function sortPurchased(items: ListItem[]): ListItem[] {
  return [...items].sort(byPurchasedAtDesc);
}
```

### Repo write-шов — `src/server/repos/items.ts` (образец `deleteItemForUser`)
```typescript
// Write-шов статуса «куплено» (LIST-04 / D-08). Тот же шов изоляции: userId из
// сессии скоупит UPDATE вместе с id. purchased=true → purchase_at = now();
// false → NULL (обратимо, D-05). Чужая/несуществующая покупка → WHERE пуст →
// .returning() пуст → null (no-op, IDOR невозможен).
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

### Server Action — `src/app/(app)/list/actions.ts` (образец `deleteItem`)
```typescript
"use server";
import { requireUser } from "@/server/auth/current-user";
import { setItemPurchasedForUser } from "@/server/repos/items";

const STATUS_ERROR = "Не удалось обновить статус. Попробуйте ещё раз.";
export type SetPurchasedResult = { ok: true } | { ok: false; error: string };

export async function setItemPurchased(
  id: string,
  purchased: boolean
): Promise<SetPurchasedResult> {
  const user = await requireUser();            // userId ТОЛЬКО из сессии (D-08)
  try {
    const row = await setItemPurchasedForUser(user.id, id, purchased);
    if (!row) return { ok: false, error: STATUS_ERROR }; // no-op = не рапортуем успех
    return { ok: true };
  } catch {
    return { ok: false, error: STATUS_ERROR };
  }
}
```

### Client-leaf — `src/components/items/PurchaseCheckbox.tsx`
```typescript
"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { setItemPurchased } from "@/app/(app)/list/actions";

export function PurchaseCheckbox({ id, purchased }: { id: string; purchased: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(purchased);

  function toggle(next: boolean) {
    startTransition(async () => {
      setOptimistic(next);                       // мгновенный флип (§Pitfall 3)
      const res = await setItemPurchased(id, next);
      if (!res.ok) { toast.error("Не удалось обновить статус. Попробуйте ещё раз."); return; }
      router.refresh();                          // ресинк RSC-групп
      if (next) {
        toast("Покупка отмечена купленной", {
          action: { label: "Отменить", onClick: () => toggle(false) },
        });
      } else {
        toast("Покупка возвращена в активные");
      }
    });
  }

  return (
    <Checkbox
      checked={optimistic}
      disabled={isPending}                        // guard от двойного тапа
      onCheckedChange={(v) => toggle(v === true)}
      aria-label={optimistic ? "Вернуть в активные" : "Отметить купленной"}
      className="h-11 w-11 shrink-0"
    />
  );
}
```

### Toaster — `src/app/(app)/layout.tsx` (+ упрощённая обёртка)
```typescript
// В layout, один раз: (обёртка sonner.tsx — с theme="light", без next-themes)
import { Toaster } from "@/components/ui/sonner";
// ...внутри JSX, рядом с <main>:
<Toaster position="bottom-center" richColors={false} />
```
```typescript
// src/components/ui/sonner.tsx — упрощённая обёртка (UI-SPEC §Про sonner):
"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";
export function Toaster(props: ToasterProps) {
  return <Sonner theme="light" className="toaster group" {...props} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ручной pending-mirror через `useState` | `useOptimistic` + `useTransition` | React 19 | Меньше кода, авто-откат при ошибке транзакции; UI-SPEC требует именно это |
| `react-hot-toast` / `react-toastify` | `sonner` (официальный shadcn-компонент) | shadcn-стандарт 2024+ | Свайп/стек/доступность из коробки; интеграция через `npx shadcn add sonner` |
| Middleware в Next | «proxy» (Next 16 переименовал middleware) | Next 16 | Не задействуется в этой фазе; auth-guard уже на серверном layout |

**Deprecated/outdated:** `next-themes` для этой фазы избыточен (нет тёмной темы) — обёртку sonner фиксируем на `theme="light"`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useOptimistic` корректно реконсилируется после `router.refresh()` при передаче свежего `purchased`-пропа из RSC внутри той же транзакции | Pitfall 3 / Code Examples | Низкий: если отскок наблюдается — переключиться на плоский `useState`-оптимизм (каркас `DeleteItemButton`), доказанный в Фазе 3 |
| A2 | Node 22 LTS рантайма содержит full ICU → коллация `localeCompare(_, 'ru')` доступна и одинакова на сервере и клиенте | Pitfall 5 | Низкий: Node ≥13 по умолчанию full-icu; при small-icu порядок деградирует до code-point. Проверяемо юнит-тестом сортировки на конкретных строках |
| A3 | `npx drizzle-kit generate` для добавленной nullable-колонки без default создаст простой `ADD COLUMN ... timestamp;` без переписывания таблицы (безопасно для существующих строк) | Pattern 1 | Низкий: подтверждается предыдущей миграцией `0001` (те же аддитивные `ADD COLUMN`); проверяется чтением сгенерированного SQL перед `migrate` |
| A4 | Передача `total`/`createdAtMs`/`purchasedAtMs` как примитивов из RSC в клиентский `ListView` не вызывает hydration-mismatch | Pitfall 4 / Pattern 2 | Низкий: примитивы сериализуются тривиально; устраняет риск лучше, чем передача `Date` |

**Все A1–A4 — LOW-risk и проверяемы автоматизированными тестами фазы (юнит/интеграция/e2e).**

## Open Questions

1. **Тост при возврате в активные — с undo или без?**
   - Что знаем: UI-SPEC допускает симметричный тост `Покупка возвращена в активные`, действие «Отменить» помечено «опционально».
   - Что неясно: нужна ли кнопка undo на обратном действии.
   - Рекомендация: показывать тост без кнопки undo на возврате (обратное действие само по себе — undo прямого); действие «Отменить» на возврате не добавлять — меньше визуального шума. Планировщик может зафиксировать иначе.

2. **Где физически лежит `setItemPurchased` — `list/actions.ts` или отдельный файл?**
   - Что знаем: Фаза 3 держит `updateItem`/`deleteItem` в `list/[id]/edit/actions.ts`.
   - Что неясно: класть новый action туда же или в `list/actions.ts`.
   - Рекомендация: новый `src/app/(app)/list/actions.ts` рядом с `page.tsx` (action не привязан к `[id]/edit`-маршруту) — чище семантически.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (local) | Миграция + `.iso.test.ts` | ✓ | PG 18 (`D:\Programs\pg`), БД `shopping_list` + `shopping_list_test` | — |
| Node.js | Рантайм, ICU для `localeCompare('ru')` | ✓ | 22 LTS (baseline Next 16) | — |
| drizzle-kit | `generate`/`migrate` | ✓ | 0.31.10 (devDep) | — |
| `sonner` | Undo-тост | ✗ (добавляется) | 2.0.7 | Нет фолбэка — устанавливается через `npx shadcn add sonner` |
| Playwright | e2e-срезы | ✓ | 1.62.0 | — |

**Missing dependencies with no fallback:** нет (после `npx shadcn add sonner`).
**Missing dependencies with fallback:** нет.

**Замечание по локальному окружению (MEMORY):** `psql` не на PATH; env-файлы (`.env.local`) заблокированы для файловых инструментов Claude — миграции/тесты выполняются исполнителем через npm-скрипты/CLI, не ручной правкой env. Executors запускаются последовательно (без git worktree) — worktrees ломают тесты (нет `node_modules`/untracked CLAUDE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` (+ RTL `16.3.2`, user-event `14.6.1`); Playwright `1.62.0` для e2e |
| Config file | `vitest.config.ts` (в корне); `.iso.test.ts` помечены `// @vitest-environment node`; e2e — `playwright.config` + `DATABASE_URL_TEST` |
| Quick run command | `npm test` (`vitest run`) — юнит + интеграция |
| Full suite command | `npm test && npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIST-01 | Дефолт-сортировка по приоритету + tiebreak `total`→`createdAt`→`id` | unit | `vitest run src/lib/list/sort.test.ts` | ❌ Wave 0 |
| LIST-02 | Сортировка «по добавлению» (`createdAt` убыв. → `id`) | unit | `vitest run src/lib/list/sort.test.ts` | ❌ Wave 0 |
| LIST-03 | Алфавит `localeCompare('ru', base)` + tiebreak; проверка Ё/регистра | unit | `vitest run src/lib/list/sort.test.ts` | ❌ Wave 0 |
| LIST-04 | `setItemPurchasedForUser`: IDOR (B не купит покупку A → null, строка цела); владелец A ставит/снимает; persist `purchased_at` timestamp / NULL | integration (реальная PG) | `vitest run src/server/repos/items.iso.test.ts` | ⚠️ расширить существующий |
| LIST-04 | Партиция `partitionByPurchased` (null=активна, non-null=архив) | unit | `vitest run src/lib/list/sort.test.ts` | ❌ Wave 0 |
| LIST-04 | Чекбокс: оптимистичный флип, pending-guard, error-откат, undo-тост | component (RTL) + e2e | `vitest run` / `test:e2e` | ❌ Wave 0 |
| LIST-05 | Фильтр «показывать купленные» открывает секцию «Куплено» отдельным блоком; ВЫКЛ — скрыты | e2e (Playwright) | `npm run test:e2e -- purchase-archive` | ❌ Wave 0 |
| LIST-05 | Сортировка архива `purchasedAt` убыв. независимо от Select | unit | `vitest run src/lib/list/sort.test.ts` | ❌ Wave 0 |
| LIST-08 | Mobile-first: тач-цели ≥44px, sticky-панель, dimmed+strikethrough | human/visual backstop | — (визуальный контроль на 375px) | n/a |

**Полный сквозной e2e (`e2e/app/purchase-archive.spec.ts`):** регистрация → добавить 2–3 покупки → отметить купленной → исчезает из активных (фильтр ВЫКЛ) + тост → «Отменить» возвращает → включить «Показывать купленные» → появляется секция «Куплено» с приглушённой карточкой → снять чекбокс в архиве → покупка вернулась в активные → переключить Select (приоритет/дата/алфавит) → порядок карточек меняется. Пользователь готовится через `POST /api/auth/sign-up/email` (образец `delete-item.spec.ts`).

### Sampling Rate
- **Per task commit:** `npm test` (юнит + интеграция; быстрый цикл TDD RED→GREEN).
- **Per wave merge:** `npm test && npm run test:e2e`.
- **Phase gate:** полный набор зелёный перед `/gsd-verify-work`.

**Автоматизируемо vs человек:**
- Автоматизируемо: детерминированные компараторы/tiebreak/localeCompare (unit), IDOR + persist нового шва (integration, реальная PG), сквозные переходы mark→archive→undo→filter→sort (e2e).
- Человек/визуальный backstop (UI-SPEC): тач-цели ≥44px на 375px, приглушённое лечение (`opacity-70` + `line-through`), sticky-панель не перекрывает первую карточку, тост `bottom-center` не закрывает панель, длинный title усекается.

### Wave 0 Gaps
- [ ] `src/lib/list/sort.ts` + `src/lib/list/sort.test.ts` — компараторы/партиция/localeCompare (TDD-ядро, RED-first) — покрывает LIST-01/02/03/05
- [ ] Расширить `src/server/repos/items.iso.test.ts` — describe для `setItemPurchasedForUser` (IDOR + persist + reversal) — покрывает LIST-04
- [ ] Расширить `tests/helpers/db.ts::seedItem` — опциональный `purchasedAt`, чтобы засеять купленную покупку для тестов
- [ ] `e2e/app/purchase-archive.spec.ts` — сквозной срез LIST-04/05/08
- [ ] (опц.) RTL-тест `PurchaseCheckbox` — оптимистика/pending/error-откат
- [ ] Установка `sonner`: `npx shadcn add sonner` (+ упрощение обёртки)

## Security Domain

> `security_enforcement: true`, ASVS L1. Фаза добавляет один write-шов — фокус на изоляции (V4) и валидации входа (V5).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (наследуется) | Better Auth-сессия; новых экранов auth нет |
| V3 Session Management | no (наследуется) | `requireUser()` читает серверную сессию |
| V4 Access Control | **yes** | `setItemPurchasedForUser` скоупит UPDATE `and(eq(id), eq(userId))`; `userId` ТОЛЬКО из `requireUser()`, никогда из аргументов (IDOR/mass-assignment). Обязателен IDOR-тест на реальной PG (D-08) |
| V5 Input Validation | **yes (узко)** | Вход `setItemPurchased(id: string, purchased: boolean)` — примитивы; `id` не определяет владельца (скоуп по `userId`). Тяжёлой Zod-валидации не требует (нет payload формы), но `purchased` приводить к строгому boolean |
| V6 Cryptography | no | Крипто не задействовано |

### Known Threat Patterns for Next.js Server Action + Postgres
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR: пользователь B меняет статус покупки A | Elevation of Privilege | `and(eq(items.id, id), eq(items.userId, userId))` в repo → no-op (null); IDOR-тест на реальной PG (RED-first) |
| Mass-assignment владельца через аргумент | Tampering | `userId` только из `requireUser()`; `id`/`purchased` не влияют на владельца |
| SQL-инъекция через `id` | Tampering | Параметризованный Drizzle `.where(eq(...))` — без строковой склейки |
| Раскрытие чужих данных в RSC | Information Disclosure | `findItemsForUser(userId)` — единственный шов чтения, `userId` из сессии |

## Sources

### Primary (HIGH confidence)
- Кодовая база проекта (Фазы 1–3): `schema.ts`, `repos/items.ts`, `items.iso.test.ts`, `DeleteItemButton.tsx`, `list/page.tsx`, `ScoreBreakdown.tsx`, `actions.ts`, `tests/helpers/db.ts`, `drizzle/0001_*.sql`, `drizzle.config.ts` — доказанные паттерны scoping/оптимистики/миграций
- `04-CONTEXT.md` (D-01…D-10), `04-UI-SPEC.md` (approved) — locked-решения и UI-контракт
- `.claude/CLAUDE.md` — стек, версии, «What NOT to Use»
- `gsd-tools query package-legitimacy check --ecosystem npm sonner` → verdict `OK` (43.9M/нед, репо `emilkowalski/sonner`, postinstall null) + `npm view sonner version` = 2.0.7 — `[VERIFIED: npm registry]`

### Secondary (MEDIUM confidence)
- React 19 `useOptimistic`/`useTransition` семантика (реконсиляция после transition) — `[ASSUMED]` из training knowledge, помечено A1
- Node 22 full-ICU / `localeCompare('ru')` — `[ASSUMED]`, помечено A2, проверяемо юнит-тестом

### Tertiary (LOW confidence)
- нет

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — стек locked, единственная новая зависимость верифицирована через registry + legitimacy seam
- Architecture: HIGH — переиспользование доказанных паттернов Фаз 2–3 (repo-scoping, RSC+`now`, оптимистика без redirect)
- Pitfalls: HIGH — большинство выведено из уже совершённых и задокументированных проектных Pitfall (7, 8, WR-01) + локальных нюансов фазы
- Validation: HIGH — трассировка каждого LIST-* на конкретную команду; Wave 0 gaps явные

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (стабильный стек; пересмотреть при апгрейде Next/React/Drizzle/sonner)
