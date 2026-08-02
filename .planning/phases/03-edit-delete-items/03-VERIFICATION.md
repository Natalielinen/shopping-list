---
phase: 03-edit-delete-items
verified: 2026-08-02T07:10:00Z
status: passed
score: 9/9 автоматически проверяемых must-have подтверждены
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "На экране 375px открыть /list с покупкой, у которой очень длинное название (60+ символов). Проверить, что badge приоритета и иконки «карандаш»/«корзина» остаются полностью видимы, тач-зоны ≥44px, усекается только название (truncate)."
    expected: "Название усекается многоточием, badge и обе иконки не выталкиваются за край и не наезжают друг на друга; тап по иконкам попадает уверенно."
    why_human: "Backstop-критерий Plan 01 (verification: backstop) — визуальная раскладка на реальном узком вьюпорте, grep видит только классы h-11 w-11/min-w-0/truncate, но не фактический рендер."

  - test: "Перейти с /list на /list/[id]/edit по иконке «карандаш» на медленном соединении (throttling). Проверить, что показывается route-level loading-состояние (loading.tsx) без пустого кадра до готовности предзаполненной формы."
    expected: "Виден промежуточный loading-скелет/состояние, нет мелькания пустого экрана."
    why_human: "Backstop-критерий Plan 01 (verification: backstop). loading.tsx присутствует в коде, но отсутствие «пустого кадра» — воспринимаемое поведение перехода."

  - test: "На /list навести/сфокусировать иконку «корзина». Проверить, что в покое она нейтральна (text-muted-foreground), а на hover/focus становится text-destructive. Отдельно: тап по иконкам edit/delete НЕ раскрывает разбивку очков (Collapsible)."
    expected: "Цвет иконки корзины меняется на деструктивный на hover/focus; тап по любой из двух иконок действий не переключает разбивку приоритета."
    why_human: "Human-judgment (D5 обоих SUMMARY) — цвет на hover/focus и отсутствие срабатывания Collapsible при тапе проверяются глазами/устройством."
---

# Фаза 3: Редактирование и удаление покупок — отчёт верификации

**Цель фазы:** Пользователь может изменять и удалять свои покупки, и приоритет пересчитывается после каждого редактирования.
**Проверено:** 2026-08-02
**Статус:** HUMAN-NEEDED (цель достигнута; открыты только визуальные backstop-проверки)
**Re-verification:** Нет — первичная верификация

## Достижение цели

### Наблюдаемые истины (Success Criteria + must-haves планов)

| #  | Истина                                                                                   | Статус      | Доказательство |
| -- | ---------------------------------------------------------------------------------------- | ----------- | -------------- |
| 1  | SC-1: открыть свою покупку, изменить любое поле, сохранить, увидеть пересчитанный приоритет | ✓ VERIFIED  | e2e `edit-item.spec.ts`: total 15 → 24 после смены Срочности; prefill формы + `updateItem` + пересчёт на чтении |
| 2  | SC-2: удалить свою покупку — она исчезает из списка                                        | ✓ VERIFIED  | e2e `delete-item.spec.ts`: подтверждение убирает карточку, «Отмена» оставляет; hard delete `deleteItemForUser` |
| 3  | SC-3: редактирование/удаление затрагивают только свои покупки (изоляция по userId)         | ✓ VERIFIED  | `items.iso.test.ts` на реальной Postgres: B → null на update/read/delete покупки A; A → успех |
| 4  | Редактирование умеет и ЗАДАВАТЬ, и ОЧИЩАТЬ необязательные поля (CR-01, undefined→null)     | ✓ VERIFIED  | `items.ts:60-67` нормализация `?? null`; тесты `items.iso.test.ts:165-241` (очистка link/desc/deadline/price, снятие кредита → monthlyPayment=null, price:0 сохраняется) |
| 5  | Приоритет считается на чтении (не хранится), отражает отредактированные значения           | ✓ VERIFIED  | `list/page.tsx:42-53` `computeTotal(item, now)`; `scoring.ts` не пишет total в БД (SCORE-05) |
| 6  | Update и delete скоупятся по session userId на каждом шве (IDOR)                           | ✓ VERIFIED  | `actions.ts`: `requireUser()` (userId не из payload); repo WHERE `and(eq(items.id,id), eq(items.userId,userId))` для find/update/delete |
| 7  | Delete — жёсткое удаление, убирающее строку из списка                                      | ✓ VERIFIED  | `items.ts:78-84` `db.delete(items)...returning()`; iso-тест: `findItemsForUser(A)` пуст после удаления |
| 8  | Удаление только через AlertDialog; ошибка оставляет диалог открытым, покупка не исчезает   | ✓ VERIFIED  | `DeleteItemButton.tsx`: `e.preventDefault()` на AlertDialogAction, error → диалог открыт; RTL `DeleteItemButton.test.tsx` (confirm/cancel/error/pending) |
| 9  | no-op update/delete чужой/несуществующей покупки не рапортует об успехе (WR-01)            | ✓ VERIFIED  | `actions.ts:55,79`: `if (!row) return { ok:false }`; тесты `actions.test.ts` (мок repo → null → ok:false) |
| 10 | При длинном title иконки/badge видимы на тач-зонах ≥44px, усекается только title           | ⏳ HUMAN     | backstop; в коде `h-11 w-11 shrink-0` + `min-w-0 truncate`, но визуальная раскладка требует устройства |
| 11 | Переход на /list/[id]/edit показывает route-level loading без пустого кадра                | ⏳ HUMAN     | backstop; `loading.tsx` присутствует, «нет пустого кадра» — воспринимаемое поведение |
| 12 | delete-иконка нейтральна → text-destructive на hover/focus; тап не переключает Collapsible | ⏳ HUMAN     | human-judgment (D5); цвет hover/focus и отсутствие срабатывания Collapsible проверяются глазами |

**Оценка:** 9/9 автоматически проверяемых must-have подтверждены. 3 визуальных backstop-пункта вынесены на ручную проверку.

### Проверка артефактов

| Артефакт | Ожидается | Статус | Детали |
| -------- | --------- | ------ | ------ |
| `src/server/repos/items.ts` | findItemForUser/updateItemForUser/deleteItemForUser, scoped | ✓ VERIFIED | Все три с WHERE `and(eq(id), eq(userId))`; CR-01 нормализация undefined→null в update |
| `src/app/(app)/list/[id]/edit/actions.ts` | updateItem/deleteItem, requireUser, { ok } | ✓ VERIFIED | requireUser + safeParse (update) + WR-01 проверка null; redirect не вызывается |
| `src/app/(app)/list/[id]/edit/page.tsx` | RSC prefill + notFound() | ✓ VERIFIED | getCurrentUser→login, findItemForUser→notFound, prefill ÷100 |
| `src/app/(app)/list/[id]/edit/loading.tsx` | route-level loading | ✓ VERIFIED | Файл присутствует (916 байт) |
| `src/components/items/AddItemForm.tsx` | edit-режим, updateItem, «Сохранить» | ✓ VERIFIED | mode/itemId/initialValues; WR-02 очистка monthlyPayment при !isCredit на submit |
| `src/components/items/ItemCard.tsx` | prop id, Pencil + DeleteItemButton | ✓ VERIFIED | Pencil Link → /list/[id]/edit; DeleteItemButton крайним |
| `src/components/items/DeleteItemButton.tsx` | AlertDialog confirm, hard delete | ✓ VERIFIED | e.preventDefault, error оставляет диалог, успех → router.refresh |
| `src/components/ui/alert-dialog.tsx` | shadcn copy-in | ✓ VERIFIED | Присутствует (unified radix-ui) |
| `src/app/(app)/list/page.tsx` | id={item.id}, пересчёт на чтении | ✓ VERIFIED | computeTotal(item, now) на чтении, прокидка id |

### Проверка ключевых связей

| From | To | Via | Статус |
| ---- | -- | --- | ------ |
| list/page.tsx | ItemCard | id={item.id} | ✓ WIRED |
| ItemCard | /list/[id]/edit | Pencil Link href | ✓ WIRED |
| edit/page.tsx | findItemForUser | scoped read → prefill | ✓ WIRED |
| AddItemForm(edit) | updateItem | onSubmit ветвление | ✓ WIRED |
| updateItem | updateItemForUser | scoped WHERE userId | ✓ WIRED |
| ItemCard | DeleteItemButton | id prop | ✓ WIRED |
| DeleteItemButton | deleteItem → deleteItemForUser | scoped WHERE userId → router.refresh | ✓ WIRED |

### Прогон тестов (выполнено верификатором)

| Набор | Команда | Результат | Статус |
| ----- | ------- | --------- | ------ |
| Unit/integration/RTL | `npx vitest run` | 13 файлов, 160 тестов passed | ✓ PASS |
| E2E | `npx playwright test` | 10 тестов passed (вкл. edit-item, delete-item) | ✓ PASS |

Изоляция update/read/delete доказана на реальной тестовой Postgres (`items.iso.test.ts`, `@vitest-environment node`).

### Покрытие требований

| Требование | План | Описание | Статус | Доказательство |
| ---------- | ---- | -------- | ------ | -------------- |
| ITEM-07 | 03-01 | Пользователь может редактировать свою покупку | ✓ SATISFIED | edit-слайс end-to-end + iso-тесты + e2e; REQUIREMENTS.md: Complete |
| ITEM-08 | 03-02 | Пользователь может удалить свою покупку | ✓ SATISFIED | delete-слайс end-to-end + iso-тест + e2e; REQUIREMENTS.md: Complete |

Оба ID из frontmatter планов (ITEM-07, ITEM-08) учтены и покрыты. Orphaned-требований для Фазы 3 в REQUIREMENTS.md нет.

### Устранение замечаний code review (03-REVIEW.md)

| Замечание | Статус | Подтверждение в коде |
| --------- | ------ | -------------------- |
| CR-01 (нельзя очистить nullable-поля на update) | ✓ ИСПРАВЛЕНО | `items.ts:60-67` undefined→null; тесты `items.iso.test.ts:165-241` |
| WR-01 (no-op рапортует об успехе) | ✓ ИСПРАВЛЕНО | `actions.ts:55,79` `if(!row) return {ok:false}` |
| WR-02 (устаревший monthlyPayment на submit) | ✓ ИСПРАВЛЕНО | `AddItemForm.tsx:138-140` payload отбрасывает monthlyPayment при !isCredit |
| IN-01/IN-02 (info) | осознанно оставлены | вне объёма фазы |

### Анти-паттерны

Отладочных маркеров (TODO/FIXME/XXX/TBD/HACK/PLACEHOLDER) в модифицированных файлах не найдено. Совпадения по `placeholder` — легитимные HTML-атрибуты полей ввода. Стабов/заглушек нет.

### Итоговое резюме

Цель фазы достигнута и доказана поведенчески:

- **SC-1** — редактирование любого поля с пересчётом приоритета на чтении (e2e 15→24).
- **SC-2** — удаление убирает покупку из списка (e2e confirm/cancel, hard delete).
- **SC-3** — изоляция по userId на чтение/запись/удаление (интеграционные тесты на реальной Postgres).

Дополнительно закреплены все три исправления code review (CR-01 set/clear необязательных полей, WR-01 честный no-op, WR-02 очистка платежа). Весь автоматизированный набор зелёный (160 unit + 10 e2e).

Открытыми остаются три визуальных backstop/human-judgment пункта (тач-зоны и truncate при длинном title на 375px, loading-переход без пустого кадра, цвет hover/focus корзины и отсутствие срабатывания Collapsible при тапе). Они не блокируют цель, но требуют ручной проверки на устройстве — отсюда статус HUMAN-NEEDED.

---

_Проверено: 2026-08-02_
_Verifier: Claude (gsd-verifier)_
