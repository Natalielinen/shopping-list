---
phase: 05-dependencies-blocking
verified: 2026-09-19T09:30:00Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Фаза 5: Зависимости и блокировка — отчёт о верификации

**Цель фазы:** Пользователь может сделать одну покупку зависящей от другой; покупка остаётся заблокированной (нельзя отметить купленной), пока не куплена её зависимость, а заблокированные покупки визуально отличаются.
**Верифицировано:** 2026-09-19T09:30:00Z
**Статус:** passed
**Ре-верификация:** Нет — первичная верификация
**Режим фазы:** mvp (цель проверялась как пользовательская история через её success criteria)

## Достижение цели

### Наблюдаемые истины (Success Criteria из ROADMAP)

| # | Истина | Статус | Доказательство |
| --- | --- | --- | --- |
| SC-1 | При добавлении/редактировании покупки пользователь может выбрать другую свою покупку как зависимость (ITEM-06) | ✓ VERIFIED | `AddItemForm.tsx:398` — `FormField name="dependsOn"` Select с опцией «Без зависимости» + `candidates`; `new/page.tsx:23-27` и `edit/page.tsx:36-45` строят кандидатов через `findItemsForUser` (self + купленные + cycle-небезопасные исключены), edit prefill `dependsOn: item.dependsOn ?? "none"`; actions принимают dependsOn с ownership+cycle-проверкой; iso-тест «create с dependsOn → персистится» (20/20 pass); e2e «зависимость блокирует…» (создание B с dependsOn=A) |
| SC-2 | Покупку с невыполненной зависимостью нельзя отметить купленной, пока не куплен товар-зависимость (DEP-01) | ✓ VERIFIED | Серверный guard `list/actions.ts:46-58` (только при next===true, читает через userId-scoped `findItemForUser`, применяет `isBlocked`, возвращает `{ok:false, error: BLOCKED_ERROR}` ДО записи) + disabled-чекбокс `PurchaseCheckbox.tsx:89`. Поведенческий тест `actions.guard.test.ts` — 4/4 pass на реальной PG: отклонение блокированной, авто-разблокировка после покупки зависимости, снятие всегда разрешено, без зависимости проходит |
| SC-3 | Заблокированные покупки визуально отличаются в списке (DEP-02) | ✓ VERIFIED | `ItemCard.tsx:79-87` рендерит строку `Lock` + «Заблокировано: {dependencyTitle}» только при blocked, карточка не приглушается; `PurchaseCheckbox.tsx:91-93` aria-label «Нельзя отметить купленной…»; e2e:74-75 ассертит видимость «Заблокировано: Молоко» + disabled-чекбокс; человеко-проверка визуала (05-04 Task 2) APPROVED пользователем во время исполнения |

**Счёт:** 3/3 истины верифицированы (0 present-but-behavior-unverified)

Все behavior-dependent истины (переход состояния «заблокировано→нельзя купить», авто-разблокировка после покупки зависимости, FK ON DELETE SET NULL) подтверждены прошедшими поведенческими тестами, а не только присутствием символов.

### Требуемые артефакты

| Артефакт | Ожидается | Статус | Детали |
| --- | --- | --- | --- |
| `src/lib/deps/blocked.ts` | Чистое производное isBlocked | ✓ VERIFIED | Чистая функция без import, `dependsOn !== null && (dependencyPurchasedAt ?? null) === null` |
| `src/lib/deps/cycle.ts` | wouldCreateCycle с visited-set | ✓ VERIFIED | self→true, create(null)→false, обход цепочки с `Set` (DoS-safe при corrupt cycle) |
| `src/lib/deps/{blocked,cycle}.test.ts` | Юнит-тесты RED→GREEN | ✓ VERIFIED | 13/13 pass, <2.5s |
| `src/server/db/schema.ts` | self-FK depends_on | ✓ VERIFIED | `text("depends_on").references((): AnyPgColumn => items.id, { onDelete: "set null" })` |
| `drizzle/0003_groovy_grandmaster.sql` | Миграция ADD COLUMN + FK set null | ✓ VERIFIED | `ADD COLUMN "depends_on" text` + `ON DELETE set null`, закоммичена |
| `src/lib/validation/item.ts` | dependsOn в Zod (sentinel→null) | ✓ VERIFIED | `z.preprocess(…"none"/""→null…).optional()` |
| `src/server/repos/items.ts` | Нормализация dependsOn ?? null | ✓ VERIFIED | `dependsOn: data.dependsOn ?? null` в updateItemForUser |
| `src/server/repos/items.iso.test.ts` | FK set null / persist / clear | ✓ VERIFIED | 20/20 pass на реальной PG, включая describe «dependsOn — self-FK и очистка» |
| `new/actions.ts`, `edit/actions.ts` | ownership + cycle guard | ✓ VERIFIED | `field?: "dependsOn"`, `!map.has(id)`→reject, `wouldCreateCycle(map, editedId, id)`→reject |
| `new/page.tsx`, `edit/page.tsx` | построение candidates + prefill | ✓ VERIFIED | findItemsForUser + фильтры self/cycle/purchased; edit prefill |
| `AddItemForm.tsx` | Select зависимости + маршрут ошибки | ✓ VERIFIED | Select h-11 w-full, disabled при 0 кандидатов, `form.setError(res.field)` |
| `list/page.tsx` | derivation blocked/dependencyTitle | ✓ VERIFIED | byId lookup, `isBlocked(...) && purchasedAt === null`, примитивы через RSC→client |
| `sort.ts` | ListItem +blocked/+dependencyTitle | ✓ VERIFIED | Поля добавлены, компараторы не изменены |
| `ItemCard.tsx` | строка Lock | ✓ VERIFIED | Lock size-4 + «Заблокировано:…», без opacity |
| `PurchaseCheckbox.tsx` | disabled + серверный текст | ✓ VERIFIED | `disabled={isPending || blocked}`, `toast.error(res.error || STATUS_ERROR)` |
| `list/actions.ts` | серверный guard | ✓ VERIFIED | BLOCKED_ERROR, guard только при next |
| `actions.guard.test.ts` | тест guard | ✓ VERIFIED | 4/4 pass |
| `e2e/app/dependencies.spec.ts` | сквозной e2e | ✓ VERIFIED | 2 сценария (блокировка+авто-разблокировка, фильтрация cycle-кандидата) |

### Проверка ключевых связей

| From | To | Via | Статус |
| --- | --- | --- | --- |
| AddItemForm Select "dependsOn" | createItem/updateItem | field?:"dependsOn" → form.setError | ✓ WIRED |
| new/edit page findItemsForUser | AddItemForm | фильтр self+cycle+purchased → candidates проп | ✓ WIRED |
| list/page.tsx byId lookup | ListView→ItemCard→PurchaseCheckbox | blocked/dependencyTitle примитивами | ✓ WIRED |
| setItemPurchased guard | findItemForUser + isBlocked | userId-scoped чтение → BLOCKED_ERROR | ✓ WIRED |
| router.refresh() (Фаза 4) | RSC пересчёт blocked | авто-разблокировка (доказано guard-тестом + e2e) | ✓ WIRED |

### Поведенческие проверки (реальная PG / юнит)

| Поведение | Команда | Результат | Статус |
| --- | --- | --- | --- |
| isBlocked/wouldCreateCycle корректность + visited-set bound | `vitest run src/lib/deps` | 13 passed | ✓ PASS |
| Guard: блокировка/авто-разблокировка/снятие/без-зависимости | `vitest run actions.guard.test.ts` | 4 passed | ✓ PASS |
| FK onDelete set null + persist/clear dependsOn | `vitest run items.iso.test.ts` | 20 passed | ✓ PASS |

### Покрытие требований

| Требование | План(ы) | Описание | Статус | Доказательство |
| --- | --- | --- | --- | --- |
| ITEM-06 | 05-01, 05-02, 05-03 | Указание зависимости от другой своей покупки | ✓ SATISFIED | Select + candidates, self-FK, persist, ownership+cycle; iso+e2e |
| DEP-01 | 05-03, 05-04 | Блокировка отметки «куплено» до покупки зависимости | ✓ SATISFIED | disabled-чекбокс + серверный guard; guard-тест 4/4 |
| DEP-02 | 05-03 | Визуальное отличие заблокированных | ✓ SATISFIED | Lock + подпись; e2e ассерт + человеко-approve |

Все 3 ID из PLAN frontmatter присутствуют в REQUIREMENTS.md и замаплены на Phase 5. Осиротевших требований нет.

### Найденные анти-паттерны

Не обнаружено. Grep по TBD/FIXME/XXX/HACK/PLACEHOLDER/«not implemented»/«coming soon» в 13 файлах фазы — 0 совпадений.

### Требуется человеко-проверка

Нет открытых пунктов. Человеко-проверка визуала (05-04 Task 2: индикатор блокировки, disabled-чекбокс, усечение длинных названий на 375px, авто-разблокировка, ошибка цикла, guard-тост) была APPROVED пользователем во время исполнения. Backstop-истины усечения длинных названий подтверждены тем же approve.

### Итоговое резюме пробелов

Пробелов нет. Все 3 success criteria верифицированы прошедшими поведенческими тестами на реальной PG (13+4+20 тестов) и трассировкой реального кода через все слои: чистое ядро (isBlocked/wouldCreateCycle) → миграция self-FK (ON DELETE SET NULL) → Zod/repo → Server Actions (ownership+cycle guard) → RSC derivation → ItemCard/PurchaseCheckbox (Lock + disabled) → серверный guard defense-in-depth. Авто-разблокировка (переход состояния) доказана guard-тестом и e2e. Визуальные бэкстопы человеко-подтверждены во время исполнения.

---

_Верифицировано: 2026-09-19T09:30:00Z_
_Верификатор: Claude (gsd-verifier)_
