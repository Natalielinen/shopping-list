---
phase: 3
slug: edit-delete-items
status: approved
shadcn_initialized: true
preset: "shadcn/ui — style radix-nova, base color neutral, CSS variables (OKLCH), Tailwind v4"
created: 2026-08-02
reviewed_at: 2026-08-02
---

# Phase 3 — UI Design Contract

> Визуальный и интеракционный контракт фронтенд-фазы. Сгенерировано gsd-ui-researcher, проверяется gsd-ui-checker.

**Поверхности фазы (в охвате):**
- **Страница редактирования** (`/list/[id]/edit`, полноэкранная) — переиспользует `AddItemForm` в edit-режиме (D-01), предзаполнена текущими значениями покупки; заголовок и лейбл submit отличаются от add.
- **Иконки действий на карточке** — явные `Pencil` (редактировать) и `Trash2` (удалить) на каждом `ItemCard` (D-04), тач-цель ≥44px, не конфликтуют с badge приоритета (LIST-06) и аффордансом «показать разбивку» (LIST-07).
- **Подтверждение удаления** — модальный `AlertDialog` (D-05, новый компонент), деструктивное действие: «Удалить покупку?» + Отмена / Удалить. Жёсткое удаление, без undo/архива.

Mobile-first. Весь пользовательский текст — на русском; код/идентификаторы/пути — на английском (перенос из Фаз 1–2).

**Наследование:** этот контракт **расширяет** `02-UI-SPEC.md` (approved). Дизайн-система, шкала отступов, типографика, базовая палитра neutral + синий accent, семантическая палитра приоритета и внутренние состояния формы (`AddItemForm`) наследуются **без изменений**. Ниже переопределяются только Phase 3-specific роли: раскладка иконок действий, деструктивное визуальное лечение (`AlertDialog` + delete-иконка), дельты edit-формы относительно add.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (зафиксировано в CLAUDE.md; `components.json` инициализирован в Фазе 2) |
| Preset | style `radix-nova`, base color `neutral`, `cssVariables: true` (OKLCH), Tailwind v4. `registries: {}` — только официальный shadcn |
| Component library | Radix (shadcn primitives) |
| Icon library | lucide-react (`iconLibrary: "lucide"`) |
| Font | Geist Sans (`next/font/google`, `--font-sans`) |

**Инвентарь компонентов Фазы 3:**

| Компонент | Статус | Назначение (Phase 3) |
|-----------|--------|----------------------|
| `Button` | установлен | Иконки действий на карточке (`variant="ghost" size="icon"`), submit/cancel edit-формы, кнопки `AlertDialog` |
| `Card` | установлен | Карточка покупки (получает ряд действий) |
| `Form` / `Input` / `Label` / `Select` / `Checkbox` / `Textarea` / `Alert` | установлены | Переиспользуются целиком в edit-режиме `AddItemForm` (единая Zod-валидация) |
| `Collapsible` | установлен | Разбивка очков (LIST-07); её триггер делит ряд с иконками действий — см. Component Behaviour |
| `Badge` | установлен | Badge приоритета (без изменений; иконки действий не должны его вытеснять) |
| `AlertDialog` | **установить** (`npx shadcn add alert-dialog`) | Модальное подтверждение удаления (D-05) |

`AlertDialog` — из официального реестра shadcn (registry safety не требуется). `Dialog` в проекте не используется — берётся именно `AlertDialog` (семантика alertdialog для деструктивного подтверждения, `role="alertdialog"`, фокус-ловушка).

---

## Spacing Scale

Наследуется из `02-UI-SPEC.md` без изменений (кратно 4). Ниже — Phase 3-specific применение.

| Token | Value | Usage (Phase 3) |
|-------|-------|-----------------|
| xs | 4px | Зазор между иконками действий (`Pencil`↔`Trash2`) в ряду карточки; зазор иконка↔спиннер в кнопке «Сохранить» |
| sm | 8px | Зазор между триггером разбивки и группой иконок действий; зазор кнопок в футере `AlertDialog` |
| md | 16px | Внутренние отступы контента `AlertDialog`; вертикальный зазор полей edit-формы (как в add) |
| lg | 24px | Горизонтальный padding edit-страницы (как add) |
| xl | 32px | Вертикальный ритм edit-формы (как add) |

Exceptions (наследуются): интерактивные контролы — минимальная тач-цель **44px**. Явно для Фазы 3: **каждая иконка действия** (`Pencil`, `Trash2`) обязана иметь тач-зону ≥44px (`Button size="icon"` → `h-11 w-11`); триггер разбивки сохраняет `h-11`. Кнопки `AlertDialog` — высота ≥44px на мобильном.

---

## Typography

Наследуется из `02-UI-SPEC.md`. Sizes: 14 / 16 / 20 / 24. Weights: 400 regular, 600 semibold.

| Role | Size | Weight | Line Height | Применение (Phase 3) |
|------|------|--------|-------------|----------------------|
| Display | 24px | 600 | 1.2 | Заголовок edit-страницы (`Редактировать покупку`) — симметрично `Новая покупка` |
| Heading | 20px | 600 | 1.3 | `AlertDialogTitle` (`Удалить покупку?`) — переопределить дефолтный `text-lg` shadcn на роль Heading |
| Body | 16px | 400 | 1.5 | `AlertDialogDescription`; лейбл кнопок «Сохранить» / «Удалить» / «Отмена»; поля формы (16px минимум — anti zoom-on-focus iOS) |
| Label | 14px | 600 | 1.4 | Подписи полей формы (наследуются); текст ошибок сохранения |

Иконки действий (`Pencil`/`Trash2`) — glyph `size-4` (16px) внутри 44px тач-цели; текстовой подписи не несут (только `aria-label`, см. Copywriting).

---

## Color

Светлая тема — baseline (mobile-first, тёмной темы в этой фазе нет). Базовая палитра neutral + синий accent + семантическая палитра приоритета наследуются из `02-UI-SPEC.md` без изменений.

| Role | Value | Usage (Phase 3) |
|------|-------|-----------------|
| Dominant (60%) | `#FFFFFF` | Фон edit-страницы и формы, фон карточки, фон `AlertDialog` |
| Secondary (30%) | `#F5F5F5` (neutral-100) + бордер `#E5E5E5` (neutral-200) | Разделители; overlay-затемнение фона под `AlertDialog`; edit-иконка в покое — `text-muted-foreground` (`#737373` neutral-500) |
| Accent (10%) | `#2563EB` (blue-600) | Только: фон primary-кнопки `Сохранить` на edit-форме; фокус-ринг на всех интерактивных элементах (иконки действий, кнопки диалога). НЕ применяется к иконкам действий в покое, badge, `Отмена` |
| Destructive | `#DC2626` (red-600) | **Расширено в Фазе 3** (было: только текст ошибок). Теперь также: **фон** кнопки подтверждения `Удалить` (`AlertDialogAction`, `variant="destructive"`, белый текст) — единственное filled-destructive место; **hover/focus-цвет** delete-иконки (`Trash2`) на карточке |

Accent reserved for: **фон primary-кнопки `Сохранить`**, **фокус-ринг** интерактивных элементов. Ничего больше.

**Деструктивное лечение (Phase 3-specific):**
- Delete-иконка (`Trash2`) на карточке — **нейтральна в покое** (`text-muted-foreground`), становится `text-destructive` (#DC2626) на hover/focus. Причина: постоянный красный на каждой карточке создал бы визуальный шум и обесценил бы сигнал опасности; красный проявляется в момент намерения.
- Кнопка `Удалить` внутри `AlertDialog` — **filled destructive** (красный фон, белый текст): это фактическое необратимое действие, оно должно читаться как опасное. `Отмена` — `variant="outline"` (нейтральная, безопасный выбор), получает начальный фокус диалога.

---

## Copywriting Contract

Тон — единый неформально-нейтральный русский (перенос из Фаз 1–2), без восклицаний. Наследуемые тексты формы (подписи полей, ошибки валидации, empty state списка) — из `02-UI-SPEC.md`, не переформулируются. Ниже — только НОВЫЕ и переопределённые для Фазы 3 строки.

| Element | Copy |
|---------|------|
| Заголовок edit-страницы | `Редактировать покупку` (Display; вместо `Новая покупка`) |
| Primary CTA edit (submit) | `Сохранить` (вместо `Добавить покупку`) |
| Метка pending submit (edit) | Кнопка disabled + `Loader2` спиннер, лейбл `Сохранить` без изменений |
| Кнопка отмены edit | `Отмена` (возврат на `/list`, как в add) |
| Error — сбой сохранения edit (server/network) | `Не удалось сохранить изменения. Попробуйте ещё раз.` (форм-левел `Alert`, отличается от add-копии) |
| Иконка edit на карточке (`aria-label`) | `Редактировать покупку` (icon-only, `Pencil` → `/list/[id]/edit`) |
| Иконка delete на карточке (`aria-label`) | `Удалить покупку` (icon-only, `Trash2` → открывает `AlertDialog`) |
| `AlertDialogTitle` | `Удалить покупку?` |
| `AlertDialogDescription` | `Действие необратимо — восстановить покупку будет нельзя.` |
| `AlertDialogCancel` | `Отмена` |
| `AlertDialogAction` (destructive) | `Удалить` |
| Метка pending удаления | Кнопка `Удалить` disabled + `Loader2` спиннер; лейбл `Удалить` без изменений; двойное подтверждение предотвращено |
| Error — сбой удаления (server/network) | `Не удалось удалить покупку. Попробуйте ещё раз.` (диалог остаётся открыт, покупка не исчезает) |
| Открытие чужой/несуществующей покупки | Route-level `notFound()` (404) — рекомендуемый вариант из D-09 (Claude's Discretion: `notFound()` vs `redirect("/list")`). Отдельной кастомной копии не требуется |

**Destructive confirmation** (обязательное поле контракта): `Удалить покупку` → `AlertDialog` с заголовком `Удалить покупку?`, описанием `Действие необратимо — восстановить покупку будет нельзя.`, кнопками `Отмена` (default focus, безопасная) и `Удалить` (destructive filled). Тихого удаления нет.

### Дельты edit-формы относительно add (сводка)

| Аспект | Add (Фаза 2) | Edit (Фаза 3) |
|--------|--------------|---------------|
| Заголовок страницы | `Новая покупка` | `Редактировать покупку` |
| Submit-лейбл | `Добавить покупку` | `Сохранить` |
| Начальные значения | пустые / дефолты | предзаполнены из покупки (цена/платёж ÷100 → рубли; `monthlyPayment` виден при `isCredit`) |
| Ошибка сохранения | `Не удалось сохранить покупку…` | `Не удалось сохранить изменения…` |
| После успеха | редирект `/list` | редирект `/list` (без изменений) |

Все прочие подписи полей, тексты Select-ов, ошибки валидации, поведение `monthlyPayment` по `isCredit`, pending-защита — **идентичны** add (единая форма, D-01).

---

## Component Behaviour Contracts

### Ряд действий на карточке (D-04)
Раскладка, решающая ключевой вопрос фазы — иконки не конфликтуют ни с badge, ни с тап-зоной разбивки:

```
CardContent (flex-col gap-2)
  ├─ Ряд заголовка:  title (truncate, min-w-0)  ·  PriorityBadge (shrink-0)   [без изменений]
  └─ Collapsible (разбивка)
       ├─ Ряд действий (flex items-center gap-1):
       │     ├─ CollapsibleTrigger  (flex-1, min-w-0, h-11)  «Показать разбивку» ▼
       │     ├─ Button edit    (ghost, size-icon, h-11 w-11, shrink-0)  Pencil  → /list/[id]/edit
       │     └─ Button delete  (ghost, size-icon, h-11 w-11, shrink-0)  Trash2  → AlertDialog
       └─ CollapsibleContent (строки разбивки)                          [без изменений]
```

- Иконки — **визуальные соседи** триггера разбивки внутри одного flex-ряда, но **отдельные `Button`-элементы** (не вложены в триггер). Тап по иконке НЕ переключает `Collapsible` (нет перекрытия хит-зон; `gap-1` разделяет). Так решается коллизия с LIST-07.
- Иконки не входят в ряд заголовка → **не вытесняют badge** и не сокращают зону усечения `title`.
- Порядок слева→направо: разбивка → edit → **delete последней** (деструктивное действие — крайнее, дальше от основного потока, ниже риск случайного тапа).
- Каждая иконка — `aria-label` (icon-only, см. Copywriting); glyph `size-4`, тач-цель `h-11 w-11` (44px).
- edit-иконка нейтральна (`text-muted-foreground`); delete-иконка нейтральна в покое, `text-destructive` на hover/focus.
- Альтернатива (reversible, на усмотрение executor): выделенный футер-ряд действий под `CollapsibleContent`. Первичная рекомендация — общий ряд с триггером (компактнее по вертикали, mobile-first).

### Delete → AlertDialog (D-05)
- Триггер — delete-иконка карточки (client-leaf; карточка/список остаются RSC). Открывает `AlertDialog` (`role="alertdialog"`, фокус-ловушка, overlay-затемнение).
- Содержимое: `AlertDialogTitle` (Heading) + `AlertDialogDescription` (Body) + футер `AlertDialogCancel` («Отмена», outline, начальный фокус) + `AlertDialogAction` («Удалить», destructive filled).
- Подтверждение → Server Action `deleteItem(id)` (`requireUser` + scoping по `userId`, D-06). Во время выполнения — кнопка `Удалить` disabled + `Loader2`, защита от двойного клика.
- Успех → диалог закрывается, `router.refresh()` обновляет RSC-список, покупка исчезает; остаёмся на `/list` (D-07).
- Сбой → диалог остаётся открыт, показывает `Не удалось удалить покупку. Попробуйте ещё раз.`; покупка НЕ исчезает.
- `Esc` / тап по overlay / `Отмена` → закрытие без удаления.

### Edit-форма (`/list/[id]/edit`, D-01/D-02/D-07)
- RSC-обёртка грузит покупку `findItemForUser(userId, id)`; чужая/несуществующая → `notFound()` (D-09).
- Тот же `AddItemForm` в edit-режиме: полноэкранная одноколоночная раскладка, порядок полей, условный `monthlyPayment`, pending-защита, `Отмена` — **идентичны** add.
- Предзаполнение: `price`/`monthlyPayment` показываются в рублях (÷100 из копеек); при сохранении ×100 один раз на сервере (D-02, BL-01). `monthlyPayment` виден только при `isCredit`.
- Заголовок `Редактировать покупку`, submit `Сохранить`. Успех → `router.refresh()` + `router.push("/list")` (покупка с обновлённым badge и новой позицией сортировки — пересчёт `total` на чтении, D-08).

---

## UI Considerations

> Shape-rooted покрытие UI-*состояний*. Прогон `ui-consideration-probe` по НОВЫМ поверхностям Фазы 3 (S1 edit-форма, S2 иконки действий, S3 AlertDialog, S4 загрузка edit-маршрута). Внутренние состояния формы (пустая/частичная/валидация/pending/long-text полей) **наследуются из `02-UI-SPEC.md` §UI Considerations E1** и здесь не рестейтятся — только дельты edit. Copy пустого/ошибочного — в `## Copywriting Contract` выше.

Applicable state considerations resolved: **10 covered, 2 backstop, 0 unresolved**. Остальные ячейки 32-сетки (8 категорий × S1–S4) — dismissed N/A, covered структурно, или наследуются из Фазы 2 E1 (перечислены ниже — без молчаливых пропусков).

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| populated | S1 edit-форма (prefill) | ✅ covered | Форма открывается предзаполненной текущими значениями покупки; `price`/`monthlyPayment` — в рублях (÷100), `monthlyPayment` виден при `isCredit` |
| loading | S1 edit submit (pending) | ✅ covered | Submit disabled + `Loader2`, лейбл `Сохранить` без изменений, двойная отправка предотвращена |
| error | S1 сбой сохранения | ✅ covered | Форм-левел `Alert` с `Не удалось сохранить изменения. Попробуйте ещё раз.` |
| populated | S2 иконки действий (default) | ✅ covered | Каждая карточка показывает `Pencil` + `Trash2`, тач-цель 44px, отдельные `Button`-элементы; не вытесняют badge, не переключают `Collapsible` (gap-1) |
| long-text | S2 иконки vs длинный title | 🧪 backstop | `{ statement: "При длинном title иконки действий и badge приоритета остаются видимы и на своих тач-зонах ≥44px; усекается только title (min-w-0/truncate), раскладка карточки не ломается", verification: backstop }` |
| populated | S3 AlertDialog (open) | ✅ covered | Модаль `role="alertdialog"` с заголовком/описанием, `Отмена` (default focus, outline) + `Удалить` (destructive filled), overlay-затемнение, фокус-ловушка |
| loading | S3 удаление (pending) | ✅ covered | Кнопка `Удалить` disabled + `Loader2`; двойное подтверждение предотвращено |
| error | S3 сбой удаления | ✅ covered | Диалог остаётся открыт, `Не удалось удалить покупку. Попробуйте ещё раз.`; покупка не исчезает |
| populated | S4 своя покупка (load) | ✅ covered | `findItemForUser(userId, id)` предзаполняет форму; scoping по `userId` (D-09) |
| error | S4 чужая/несуществующая | ✅ covered | `notFound()` → 404 (рекомендация D-09; открыть/сохранить/удалить чужую покупку нельзя, SC-3) |
| loading | S4 переход на edit-маршрут | 🧪 backstop | `{ statement: "Навигация на /list/[id]/edit показывает route-level loading-состояние (loading.tsx/Suspense) без пустого кадра до готовности предзаполненной формы", verification: backstop }` |
| zero-one-many | S1/S3/S4 | dismissed | N/A: edit-форма, диалог и fetch работают с одной покупкой — измерения множественности нет |

**Наследуется из `02-UI-SPEC.md` E1 (не рестейтится):** пустая форма, per-field валидация, длинный текст в `Input`/`Textarea`, прокрутка при экранной клавиатуре, условный `monthlyPayment` — поведение идентично, т.к. `AddItemForm` переиспользуется целиком (D-01).

**Dismissed / inherited — остальные ячейки 32-сетки (probe reconciliation, без молчаливых пропусков):**
- **S2 · empty / partial / zero-one-many** — N/A: иконки статичны, рендерятся из уже загруженных данных карточки; своего пустого/частичного/множественного состояния нет.
- **S2 · loading / error** — N/A: иконки не имеют собственного async-состояния (как badge E2 в Фазе 2); async возникает только при тапе (покрыто S3).
- **S2 · overflow** — ✅ covered структурно: триггер разбивки `flex-1 min-w-0` сжимается, иконки `shrink-0` фиксированы → ряд действий не переполняется по горизонтали (тесно связано с long-text backstop выше).
- **S3 · empty / partial / overflow / long-text** — N/A: текст диалога фиксированный и короткий, динамического контента нет.
- **S4 · empty / partial / overflow** — N/A: маршрут грузит одну покупку; «нет данных» == `notFound()` (покрыто S4 · error), частичного/overflow-состояния у fetch нет.
- **S4 · long-text** — наследуется из E1: длинные значения полей рендерятся в предзаполненной форме по правилам Фазы 2 E1.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `AlertDialog` (добавляется) + `Button`, `Card`, `Collapsible`, `Badge`, `Form`, `Input`, `Label`, `Select`, `Checkbox`, `Textarea`, `Alert` (установлены в Фазе 2) | not required |

Сторонних реестров нет (`components.json` → `registries: {}`). Vetting gate неприменим. `AlertDialog` — официальный shadcn-примитив на Radix `AlertDialog` (`role="alertdialog"`, встроенная доступность).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (FLAG non-blocking — submit-лейбл «Сохранить» одиночным глаголом; принято, контекст заголовка «Редактировать покупку» снимает двусмысленность)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved (gsd-ui-checker, 2026-08-02) — 6/6 измерений пройдено, 1 non-blocking FLAG принят
