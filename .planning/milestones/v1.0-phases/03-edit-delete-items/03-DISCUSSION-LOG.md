# Phase 3: Редактирование и удаление покупок - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 3-Редактирование и удаление покупок
**Areas discussed:** Форма и маршрут edit, Вход «изменить/удалить», Подтверждение удаления, После save/delete

---

## Форма и маршрут edit

| Option | Description | Selected |
|--------|-------------|----------|
| Переиспользовать AddItemForm | Единая форма create/edit на /list/[id]/edit с предзаполнением (price копейки→рубли, monthlyPayment по isCredit); Server Action updateItem | ✓ |
| Отдельная EditItemForm | Своя форма редактирования; больше кода, риск расхождения | |
| You decide | На усмотрение планировщика | |

**User's choice:** Переиспользовать AddItemForm
**Notes:** Приоритет отсутствия дублирования и единой Zod-валидации; копеечный нюанс price при prefill (÷100) и сохранении (×100 на сервере).

---

## Вход «изменить/удалить» с карточки

| Option | Description | Selected |
|--------|-------------|----------|
| Иконки на карточке | Явные иконки «карандаш»/«корзина», тач-цель ≥44px, lucide + Button | ✓ |
| Kebab-меню (⋮) | Меню на карточке → Изменить/Удалить; нужен shadcn DropdownMenu | |
| Тап по карточке → edit | Вся карточка кликабельна; конфликтует с тапом «показать разбивку» (LIST-07) | |

**User's choice:** Иконки на карточке
**Notes:** Не конфликтуют с аффордансом разбивки (LIST-07); без новых меню-компонентов.

---

## Подтверждение удаления

| Option | Description | Selected |
|--------|-------------|----------|
| AlertDialog | Установить shadcn AlertDialog; модальное «Удалить? Необратимо» + Отмена/Удалить | ✓ |
| Undo-toast | Удалить сразу + toast «Удалено · Отменить»; мягкое удаление, сложнее | |
| Inline на карточке | Тап Удалить → «Точно? Да/Нет» на карточке | |

**User's choice:** AlertDialog
**Notes:** Удаление жёсткое и необратимое в этой фазе (архив/«куплено» — Фаза 4), поэтому явное модальное подтверждение.

---

## После save/delete

| Option | Description | Selected |
|--------|-------------|----------|
| Редирект на /list + refresh | Save → редирект на /list с обновлённым badge; delete → остаёмся, покупка исчезает; router.refresh() | ✓ |
| Остаться + обновить inline | Edit на месте без редиректа; сложнее с RSC + сортировкой | |
| + toast «Сохранено/Удалено» | Любой вариант + toast-фидбэк (нужен toast-компонент) | |

**User's choice:** Редирект на /list + refresh
**Notes:** Единообразно с добавлением (D-09 Фазы 2). Toast опционален — на усмотрение планировщика.

---

## Claude's Discretion

- Точный маршрут edit и структура RSC-обёртки.
- Поведение при открытии несуществующей/чужой покупки (notFound() vs redirect).
- Раскладка иконок edit/delete на карточке (UI-фаза).
- Тексты AlertDialog и опциональный toast.

## Deferred Ideas

- «Куплено»/архив/фильтры/сортировки — Фаза 4.
- Зависимости (depends) и каскад/блокировка при удалении — Фаза 5.
- Undo-toast / мягкое удаление — рассмотрено, отклонено.
