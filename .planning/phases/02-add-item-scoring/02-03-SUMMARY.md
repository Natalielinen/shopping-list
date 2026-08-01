---
phase: 02-add-item-scoring
plan: 03
subsystem: add-item-form
tags: [nextjs, server-action, rsc, react-hook-form, zod, shadcn, radix, playwright, tracer]

# Dependency graph
requires:
  - phase: 02-01
    provides: computeTotal / priorityLevel / PRIORITY_THRESHOLDS + *_VALUES шкалы
  - phase: 02-02
    provides: itemInputSchema / ItemInput + createItemForUser (write-seam со scoping)
  - phase: 01-foundation-auth
    provides: getCurrentUser / requireUser, findItemsForUser, list/page RSC + AppLayout guard, Playwright e2e тулчейн, shadcn Button/Card/Form/Input/Alert
provides:
  - Server Action createItem (userId из сессии + серверная ре-валидация + write)
  - Маршрут /list/new (RSC-обёртка + client-форма AddItemForm с обязательными полями)
  - RSC-список с вычислением приоритета на чтении, сортировкой в JS и карточками
  - ItemCard + PriorityBadge (4 избыточных канала уровня приоритета)
  - shadcn Select/Checkbox/Badge/Collapsible/Textarea + jsdom-шимы Radix
  - Сквозной e2e add-item.spec.ts (add → redirect → badge → сортировка)
affects: [02-04-optional-fields, 02-05-score-breakdown]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action возвращает результат-объект { ok } (не redirect в try/catch, Pitfall 7); навигацию делает клиент"
    - "router.refresh() ДО router.push() — сброс Router Cache без отмены навигации после Server Action"
    - "RHF три-дженерик useForm<Input, ctx, Output> для схемы с .default() (input/output расходятся)"
    - "shadcn Select + RHF через defaultValue={field.value} + onValueChange={field.onChange} (без controlled-switch варнинга)"
    - "Вычисление приоритета на чтении: now создаётся один раз в RSC, сортировка в JS (не SQL ORDER BY, Pitfall 8)"
    - "PriorityBadge: 4 избыточных канала (число + метка + lucide-иконка + цвет), whitespace-nowrap"

key-files:
  created:
    - src/app/(app)/list/new/actions.ts
    - src/app/(app)/list/new/page.tsx
    - src/components/items/AddItemForm.tsx
    - src/components/items/ItemCard.tsx
    - src/components/items/PriorityBadge.tsx
    - src/components/ui/select.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/textarea.tsx
    - e2e/app/add-item.spec.ts
  modified:
    - src/app/(app)/list/page.tsx
    - vitest.setup.ts
    - e2e/auth/register.spec.ts
    - e2e/app/empty-list.spec.ts

key-decisions:
  - "createItem не редиректит — возвращает { ok:true } | { ok:false, error }; навигация на клиенте (D-09, Pitfall 7)"
  - "router.refresh() перед router.push() — обратный порядок (push→refresh) отменял навигацию после Server Action"
  - "Тонкий срез: только обязательные поля (title + category/urgency/need/benefit); optional-поля и разбивка — планы 04/05"
  - "Select через defaultValue (uncontrolled) вместо value — убирает варнинг uncontrolled→controlled, RHF получает значение через onValueChange"
  - "Обновлены Phase-1 e2e (register/empty-list) под новое пустое состояние Фазы 2 (Rule 1 — сломаны моими изменениями)"

patterns-established:
  - "Pattern 1: Server Action write-путь (requireUser → safeParse → createItemForUser → результат-объект)"
  - "Pattern 2: RSC-список с вычислением на чтении + JS-сортировка + карточки"
  - "Pattern 3: PriorityBadge из чистого priorityLevel + семантическая палитра UI-SPEC"

requirements-completed: [ITEM-01, ITEM-02, SCORE-05, LIST-06]

# Metrics
duration: 21min
completed: 2026-08-01
status: complete
---

# Phase 2 Plan 03: TRACER-срез «добавить покупку и увидеть приоритет» Summary

**Доказан весь вертикальный путь Фазы 2 за один проход: форма обязательных полей → Server Action `createItem` (userId из сессии, серверная ре-валидация) → `createItemForUser` (insert со scoping) → клиентский редирект на `/list` → RSC-список с вычисленным на чтении badge приоритета, отсортированный по убыванию `total`; подтверждён сквозным Playwright e2e.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-08-01T07:51:41Z
- **Completed:** 2026-08-01T08:12:23Z
- **Tasks:** 2
- **Files modified:** 15 (11 создано, 4 изменено)

## Accomplishments
- Добавлены пять shadcn-компонентов (`Select`/`Checkbox`/`Badge`/`Collapsible`/`Textarea`) из официального реестра; в `vitest.setup.ts` — jsdom-шимы Radix (`hasPointerCapture`/`scrollIntoView`/`ResizeObserver`), защищённые от node-окружения.
- `createItem` — первый Server Action проекта: `requireUser()` (userId только из сессии, T-2-03), `itemInputSchema.safeParse` (never-trust-client, T-2-04), `createItemForUser` (T-2-01), возврат результат-объекта без `redirect()` (Pitfall 7).
- `AddItemForm` — тонкий client-срез (title + 4 обязательных Select) на RHF + zodResolver; при успехе `router.refresh()` + `router.push("/list")`, при сбое — форм-левел `Alert`.
- `/list` расширен: `computeTotal` на чтении с единым `now`, сортировка в JS по убыванию total (tiebreak `createdAt`), рендер `ItemCard` + `PriorityBadge`; пустое состояние — новая копирайт-строка Фазы 2 + кнопка-ссылка «Добавить покупку».
- Сквозной e2e `add-item.spec.ts` зелёный: добавление двух покупок, редирект, badge с меткой уровня и числом, порядок карточек по убыванию total.

## Task Commits

1. **Task 1: shadcn-компоненты + jsdom-шимы** — `e484f0e` (chore)
2. **Task 2 (tracer): сквозной срез add-item + badge** — `dd35630` (feat)

## Files Created/Modified
- `src/app/(app)/list/new/actions.ts` (создан) — Server Action `createItem` + тип `CreateItemResult`.
- `src/app/(app)/list/new/page.tsx` (создан) — RSC-обёртка формы (session guard + «Новая покупка»).
- `src/components/items/AddItemForm.tsx` (создан) — client-форма RHF + Select-ы обязательных полей.
- `src/components/items/ItemCard.tsx` (создан) — RSC-карточка (title truncate + PriorityBadge).
- `src/components/items/PriorityBadge.tsx` (создан) — RSC-leaf badge (число + метка + иконка + цвет).
- `src/app/(app)/list/page.tsx` (изменён) — вычисление на чтении + JS-сортировка + карточки + новое пустое состояние.
- `src/components/ui/{select,checkbox,badge,collapsible,textarea}.tsx` (созданы) — shadcn official registry.
- `vitest.setup.ts` (изменён) — jsdom-шимы Radix (guarded для node-env).
- `e2e/app/add-item.spec.ts` (создан) — сквозной tracer-e2e.
- `e2e/auth/register.spec.ts`, `e2e/app/empty-list.spec.ts` (изменены) — синхронизированы с новым пустым состоянием Фазы 2.

## Decisions Made
- **Навигация на клиенте, не в action** (Pitfall 7): `createItem` возвращает `{ ok }`; `redirect()` внутри try/catch кинул бы NEXT_REDIRECT и был бы пойман. Клиент навигирует сам.
- **`router.refresh()` ДО `router.push()`:** обнаружено при отладке — обратный порядок (`push` затем `refresh`) отменял навигацию после Server Action (URL оставался `/list/new`). Refresh-перед-push сбрасывает Router Cache и навигирует к свежему `/list`.
- **RHF три-дженерик `useForm<ItemFormInput, unknown, ItemInput>`:** схема с `.default()` (doubts/isCredit) даёт расхождение input/output типов zodResolver; три-дженерик снимает несовместимость типов.
- **Select через `defaultValue`** (не `value`): убирает варнинг «uncontrolled → controlled»; значение всё равно доходит до RHF через `onValueChange`.
- **Тонкий срез:** сознательно только обязательные поля; optional-поля (план 04) и раскрываемая разбивка (план 05) строятся поверх доказанного пути.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Порядок router.push/refresh отменял навигацию**
- **Found during:** Task 2 (прогон e2e)
- **Issue:** Копия паттерна из `RegisterForm` (`router.push` затем `router.refresh`) после Server Action оставляла URL на `/list/new` — навигация отменялась. Не связано с задержкой компиляции (20s таймаут не помогал).
- **Fix:** Переставлен порядок на `router.refresh()` → `router.push("/list")` — сброс Router Cache до навигации.
- **Files modified:** `src/components/items/AddItemForm.tsx`
- **Commit:** `dd35630`

**2. [Rule 1 - Bug] jsdom-шимы падали в node-окружении**
- **Found during:** Task 1 (прогон `vitest run src/lib`)
- **Issue:** `Element.prototype.hasPointerCapture` в `vitest.setup.ts` бросал `ReferenceError: Element is not defined` в тестах с `@vitest-environment node` (`auth.config.test.ts`).
- **Fix:** Обёрнуто в `if (typeof Element !== "undefined")` — шимы применяются только в jsdom.
- **Files modified:** `vitest.setup.ts`
- **Commit:** `e484f0e`

**3. [Rule 1 - Bug] Phase-1 e2e ассертили устаревшее пустое состояние**
- **Found during:** Task 2 (merge-гейт волны, полный прогон Playwright)
- **Issue:** Изменение пустого состояния `/list` (новая копирайт-строка + кнопка «Добавить покупку») ломало `register.spec.ts` и `empty-list.spec.ts`, которые проверяли текст Фазы 1 и отсутствие кнопки добавления.
- **Fix:** Обновлены оба спека под контракт Фазы 2 (новый body-текст; проверка ссылки «Добавить покупку» на `/list/new`).
- **Files modified:** `e2e/auth/register.spec.ts`, `e2e/app/empty-list.spec.ts`
- **Commit:** `dd35630`

## Issues Encountered
- Отладка «форма не редиректит»: пошаговая инструментация (browser console → Playwright listeners, серверные логи Server Action) показала, что `createItem` возвращает `{ ok:true }`, но `router.push` был no-op из-за последующего `router.refresh()`. Устранено сменой порядка вызовов. Вся временная отладочная логика удалена перед коммитом.
- Benign log Postgres (`transformCreateStmt`) при подготовке тестовой БД в global-setup — не влияет на результат (все 8 e2e зелёные).

## Known Limitations (scope Фазы 2, не стабы)
- После добавления покупки на непустом `/list` нет видимого входа на форму — кнопка «Добавить» в шапке (`AppHeader`, D-08) относится к плану 04. Вход через пустое состояние работает; e2e для второй покупки навигирует прямым `goto("/list/new")`.
- Форма содержит только обязательные поля; optional-поля (link/description/price/deadline/doubts/isCredit/monthlyPayment) — план 04; раскрываемая разбивка очков (LIST-07) — план 05. Это сознательный тонкий срез tracer, задокументированный в плане.

## User Setup Required
None — внешних сервисов не добавлено; использованы существующие `DATABASE_URL`/`DATABASE_URL_TEST`.

## Next Phase Readiness
- Доказанный путь готов к расширению: план 04 добавляет optional-поля в `AddItemForm` (schema уже их принимает) + кнопку «Добавить» в шапку; план 05 — `ScoreBreakdown` (Collapsible уже установлен).
- Финальные прогоны: `npx vitest run` → 104 passed; `npx playwright test` → 8 passed; `npx tsc --noEmit` → 0; `eslint` → 0.

## Self-Check: PASSED

---
*Phase: 02-add-item-scoring*
*Completed: 2026-08-01*
