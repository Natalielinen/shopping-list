---
phase: 04-list-sort-filter-archive
verified: 2026-08-09T09:41:00Z
status: passed
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Открыть /list на устройстве/эмуляторе шириной 375px (mobile-first бэкстоп)"
    expected: "Закреплённая панель ListControls умещает полноширинный Select сортировки и строку фильтра «Показывать купленные», каждая тач-цель ≥44px; вертикальный стек не ломается и не перекрывает первую карточку; sticky-панель не просвечивает под карточками; длинное название усекается (truncate) и не выталкивает badge/чекбокс; тост не закрывает панель управления"
    why_human: "Визуальный/тактильный бэкстоп на реальном вьюпорте 375px нельзя проверить grep'ом или headless-e2e — требуется глаз человека и оценка размеров тач-зон на устройстве. Явно отложено в UAT на checkpoint плана 04-04 (04-04-SUMMARY «Отложенная ручная проверка (UAT)»), как и визуальные бэкстопы Фазы 3. НЕ провалено — ожидает подтверждения человеком."
---

# Фаза 4: Список — сортировка, фильтр, архив «Куплено» — Отчёт верификации

**Цель фазы:** Пользователь видит свои покупки как mobile-first список, по умолчанию отсортированный по приоритету, может менять сортировку и фильтры и отмечать покупки купленными с уходом в архив.
**Проверено:** 2026-08-09T09:41:00Z
**Статус:** human_needed (единственный незакрытый пункт — визуальный бэкстоп 375px, отложенный в UAT)
**Ре-верификация:** Нет — первичная верификация

## Достижение цели

### Наблюдаемые истины (Success Criteria)

| # | Истина (SC) | Статус | Доказательство |
|---|-------------|--------|----------------|
| 1 | Список по умолчанию отсортирован по убыванию приоритета с детерминированным tiebreaker | ✓ VERIFIED | `sort.ts:45-46` `byPriority` = `b.total - a.total \|\| b.createdAtMs - a.createdAtMs \|\| a.id.localeCompare(b.id)`; `ListView.tsx:35` дефолт `useState<SortKey>("priority")`; юнит-тесты `sort.test.ts` (84 кейса) пройдены; e2e `add-item.spec.ts` подтверждает сортировку по убыванию total |
| 2 | Пользователь может переключить сортировку на «по порядку добавления» и «по алфавиту» | ✓ VERIFIED | `ListControls.tsx:25-29` — ровно 3 опции D-01; `byCreatedAt` (createdAtMs убыв. → id) и `byTitle` (`localeCompare("ru", {sensitivity:"base"})` → createdAtMs → id) в `sort.ts:48-54`; e2e `purchase-archive.spec.ts:100` «переключение сортировки меняет порядок» пройден |
| 3 | Пользователь может отметить покупку купленной; она уходит в архив и исчезает из списка по умолчанию | ✓ VERIFIED | `setItemPurchasedForUser` (repo, скоуп по `userId`), `setItemPurchased` (action, `{ok:false}` при no-op), `PurchaseCheckbox` (useOptimistic + router.refresh); iso-тесты (persist/reversal/IDOR) пройдены на реальной Postgres; e2e `purchase-archive.spec.ts:47` «карточка исчезает из активного списка + undo» пройден |
| 4 | Фильтр «показывать купленные» возвращает архивные покупки в видимый список (секция «Куплено») | ✓ VERIFIED | `ListView.tsx:49,91-112` секция рендерится при `showPurchased && purchasedSorted.length > 0`; архив всегда `sortPurchased` (purchasedAt убыв.); e2e `purchase-archive.spec.ts:100` «фильтр раскрывает секцию Куплено» пройден |
| 5 | Список и элементы управления удобны на телефоне (mobile-first, достаточные зоны нажатия) | ⚠️ HUMAN-NEEDED | Код присутствует и разведён (sticky-панель, тач-цели `h-11`/`min-h-11`/`h-11 w-11`, `truncate`/`min-w-0`), но визуальный бэкстоп на 375px явно отложен в UAT (LIST-08). См. раздел «Требуется человек» |

**Счёт:** 4/5 истин verified; SC-5 (LIST-08) — human_needed (отложенный UAT-бэкстоп, не провал).

### Требуемые артефакты

| Артефакт | Ожидается | Статус | Детали |
|----------|-----------|--------|--------|
| `src/lib/list/sort.ts` | 3 режима + партиция + архив-сорт, чистые функции | ✓ VERIFIED | `SortKey`, `partitionByPurchased`, `sortActive`, `sortPurchased`; tiebreaker по `id`; `[...items].sort` (без мутации); импортируется в `ListView` |
| `src/server/repos/items.ts` | `setItemPurchasedForUser` со скоупом по userId | ✓ VERIFIED | `.where(and(eq(items.id,id), eq(items.userId,userId)))`; `true→new Date()`, `false→null`; `?? null` no-op |
| `src/app/(app)/list/actions.ts` | Server Action, userId из сессии, no-op≠успех | ✓ VERIFIED | `requireUser()`, `purchased===true`, `if(!row) return {ok:false}` |
| `src/app/(app)/list/page.tsx` | RSC → примитивы в ListView | ✓ VERIFIED | Единый `now`; `purchasedAtMs = item.purchasedAt?.getTime() ?? null`; отдаёт только числа/null |
| `src/components/items/ListView.tsx` | Эфемерный useState, партиция, секция «Куплено» | ✓ VERIFIED | `useState` sortKey/showPurchased; 3 empty-варианта; секция условна |
| `src/components/items/ListControls.tsx` | Select 3 опций + Checkbox фильтра | ✓ VERIFIED | Контролируемый client-leaf без состояния; sticky-панель |
| `src/components/items/PurchaseCheckbox.tsx` | useOptimistic + undo-тост | ✓ VERIFIED | Оптимистичный флип, `router.refresh()`, sonner-тост с «Отменить» |
| `src/components/items/ItemCard.tsx` | Приглушение купленной карточки | ✓ VERIFIED | `opacity-70` + `line-through text-muted-foreground` (избыточный канал, не только цвет) |
| `src/server/db/schema.ts` | Nullable purchasedAt, исключён из ItemInsertData | ✓ VERIFIED | `timestamp("purchased_at")` без default; `Omit<NewItem,"id"\|"userId"\|"createdAt"\|"purchasedAt">` (WR-01 закрыт) |
| `drizzle/0002_tranquil_slapstick.sql` | Аддитивная nullable-миграция | ✓ VERIFIED | `ALTER TABLE "items" ADD COLUMN "purchased_at" timestamp;` — без NOT NULL/default |

### Верификация ключевых связей

| От | К | Через | Статус |
|----|----|-------|--------|
| `PurchaseCheckbox` | `setItemPurchased` → `setItemPurchasedForUser` | Server Action → repo-шов изоляции | ✓ WIRED |
| `page.tsx` | `ListView` | Граница RSC→client на примитивах | ✓ WIRED |
| `ListView` | `sort.ts` (`sortActive`/`sortPurchased`) | Импорт + вызов | ✓ WIRED |
| `ListControls` | `useState` в `ListView` | Колбэки onSortKeyChange/onShowPurchasedChange | ✓ WIRED |

### Проверка запрещённого (prohibitions / locked decision)

| Инвариант | Статус | Доказательство |
|-----------|--------|----------------|
| Состояние сортировки/фильтра — эфемерное (НЕ nuqs/localStorage/URL) | ✓ VERIFIED | Grep по `src/components/items/`, `src/app/(app)/list/`: `nuqs`/`localStorage`/`useSearchParams` встречаются ТОЛЬКО в комментариях-отрицаниях; `nuqs` НЕ в `package.json`; только `useState` |
| `purchasedAt` исключён из `ItemInsertData` (mass-assignment defense, WR-01) | ✓ VERIFIED | `schema.ts:178-181` — `purchasedAt` в `Omit`; подтверждено 04-REVIEW (исправлено в 89d75ef) |
| No-op возвращает `{ok:false}`, а не ложный успех | ✓ VERIFIED | `actions.ts:38`; iso-тест «B не может изменить статус A → null» |

### Прогон автоматических наборов

| Набор | Команда | Результат | Статус |
|-------|---------|-----------|--------|
| Unit/integration (вкл. реальный Postgres) | `npx vitest run` | 15 файлов, 189 тестов — все пройдены | ✓ PASS |
| E2E | `npx playwright test` | 12 тестов — все пройдены (вкл. 2 purchase-archive: отметка/архив/undo, фильтр/undo-из-архива/переключение сортировки) | ✓ PASS |

### Покрытие требований

| Требование | Описание | Статус | Доказательство |
|------------|----------|--------|----------------|
| LIST-01 | Дефолтная сортировка по убыванию приоритета + tiebreaker | ✓ SATISFIED | `byPriority`, sort.test.ts, e2e |
| LIST-02 | Сортировка по порядку добавления | ✓ SATISFIED | `byCreatedAt`, e2e переключение |
| LIST-03 | Сортировка по алфавиту | ✓ SATISFIED | `byTitle` (`localeCompare('ru')`) |
| LIST-04 | Отметка купленной → архив | ✓ SATISFIED | action + repo + iso/e2e |
| LIST-05 | Фильтр «показывать купленные» | ✓ SATISFIED | `ListView` секция «Куплено» + e2e |
| LIST-08 | Mobile-first, адаптивность | ⚠️ NEEDS HUMAN | Код реализован; визуальный бэкстоп 375px отложен в UAT |

### Найденные анти-паттерны

Блокеров нет. По 04-REVIEW остаются 2 INFO (косметика): дублирование строки `STATUS_ERROR` (сервер/клиент) и undo-тост на размонтированном компоненте (функционально работает, подтверждено e2e). Debt-маркеров (TODO/FIXME/XXX) в файлах фазы не обнаружено.

### Требуется человек

#### 1. Mobile-first бэкстоп на 375px (SC-5 / LIST-08)

**Тест:** Открыть `/list` на вьюпорте 375px (реальный телефон или эмулятор) со списком из нескольких покупок, включая одну с очень длинным названием.
**Ожидается:** Панель `ListControls` (Select сортировки + строка фильтра «Показывать купленные») умещается вертикальным стеком, каждая тач-цель ≥44px; sticky-панель закреплена и не просвечивает под карточками; длинное название усекается и не выталкивает badge/чекбокс; ведущий чекбокс «куплено», кнопки edit/delete и триггер разбивки — независимые тач-зоны ≥44px; undo-тост не перекрывает панель управления.
**Почему человек:** Размеры тач-зон и отсутствие визуальных наложений на конкретном мобильном вьюпорте не проверяются grep'ом или headless-e2e. Пункт явно отложен в UAT на checkpoint плана 04-04 (тот же паттерн, что визуальные бэкстопы Фазы 3), помечен как «не провален, ожидает подтверждения человеком».

### Сводка по пробелам

Функциональных пробелов нет. Все четыре поведенческих критерия (SC-1..SC-4) реализованы в коде, разведены сквозь слои (RSC-примитивы → клиентский ListView → client-leaf с оптимистикой → Server Action → repo-шов изоляции → Postgres) и подтверждены проходящими автоматическими наборами (vitest 189/189, playwright 12/12), включая якорные IDOR/persist/reversal-тесты на реальной Postgres. Оба риск-класса из брифа закрыты: IDOR-изоляция статуса «куплено» доказана тестом, no-op не рапортует ложный успех, mass-assignment `purchasedAt` защищён на уровне типа (WR-01). Единственный незакрытый пункт — визуальный mobile-first бэкстоп на 375px (SC-5 / LIST-08), намеренно отложенный в UAT; поэтому итоговый статус — `human_needed`, чтобы `/gsd-verify-work 4` провёл человека по этой проверке (тот же паттерн, что Фаза 3).

---

_Проверено: 2026-08-09T09:41:00Z_
_Верификатор: Claude (gsd-verifier)_
