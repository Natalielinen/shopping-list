---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 05
current_phase_name: dependencies-blocking
status: executing
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-09-19T04:59:22.912Z"
last_activity: 2026-09-19
last_activity_desc: Phase 05 execution started
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 20
  completed_plans: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-09)

**Core value:** Пользователь видит свои покупки автоматически отсортированными по осмысленному приоритету, чтобы понимать, что покупать в первую очередь.
**Current focus:** Phase 05 — dependencies-blocking

## Current Position

Phase: 05 (dependencies-blocking) — EXECUTING
Plan: 2 of 4
Status: Ready to execute
Last activity: 2026-09-19 — Phase 05 execution started

Progress: [█████████░] 85%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: — min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 2 | 5 | - | - |
| 03 | 2 | - | - |
| 04 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01-02 | 12 | 3 tasks | 18 files |
| Phase 01 P03 | 21min | 2 tasks | 22 files |
| Phase 01 P04 | 5 | 2 tasks | 8 files |
| Phase 02 P01 | 5 | 2 tasks | 4 files |
| Phase 02 P02 | 12min | 2 tasks | 7 files |
| Phase 02 P03 | 21min | 2 tasks | 15 files |
| Phase 02 P04 | 7min | 2 tasks | 3 files |
| Phase 02 P05 | 12min | 1 tasks | 4 files |
| Phase 03 P01 | 8 | 2 tasks | 12 files |
| Phase 03 P02 | 5min | 3 tasks | 9 files |
| Phase 04 P01 | 12min | 3 tasks | 6 files |
| Phase 04 P02 | 6min | 1 tasks | 2 files |
| Phase 04 P03 | 6min | 2 tasks | 10 files |
| Phase 04 P04 | 15min | 3 tasks | 5 files |
| Phase 04 P05 | ~10min | 2 tasks | 2 files |
| Phase 05 P01 | 4min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Vertical MVP — чистый модуль подсчёта очков (с внедряемыми «часами», total на чтении) встроен в Phase 2, а не вынесен в отдельную фазу-движок.
- [Roadmap]: Auth + изоляция данных (Phase 1) предшествуют любому пользовательскому CRUD; зависимости/блокировка (Phase 5) — в конце, т.к. ссылаются на существующие покупки.
- [Phase ?]: [01-02] Argon2id через кастомный password.hash/verify + сессия 30 дней (явно) в Better Auth; шов изоляции userId (findItemsForUser) доказан двухпользовательским тестом (AUTH-04)
- [Phase ?]: 01-03: экраны login/register — RSC-оболочка + client-leaf форма (интерактивность в 'use client'-листе, секрет не в бандле)
- [Phase ?]: 01-03: e2e через Playwright с приложением на DATABASE_URL_TEST; readiness-проба по /register (не / из-за 307)
- [Phase ?]: 01-04: контур auth замкнут — LogoutButton (signOut -> /login, D-09/AUTH-03) + mapAuthError с enumeration-guard на входе (V7); изоляция подтверждена e2e на двух пользователях (AUTH-04)
- [Phase ?]: [02-01] Чистый движок подсчёта: now:Date внедряется, просрочка=+100 ДО clamp (D-04), exhaustive Record-шкалы (vital=12), 57 юнит-тестов зелёные (TDD RED→GREEN)
- [Phase ?]: Деньги (price/monthlyPayment) хранятся как integer-копейки (Pitfall 10, без float-ошибок)
- [Phase ?]: deadline — date(mode:date) без TZ, чтобы вклад срока не сдвигался на день (Pitfall 4)
- [Phase ?]: total/deadlinePoints не хранятся в items (SCORE-05 — считаются на чтении)
- [Phase ?]: createItem не редиректит — возвращает { ok }; навигация на клиенте (D-09, Pitfall 7)
- [Phase ?]: router.refresh() ДО router.push() — обратный порядок отменял навигацию после Server Action
- [Phase ?]: monthlyPayment всегда optional в схеме; условна только видимость поля по isCredit (Pitfall 6), с очисткой setValue(undefined) при снятии
- [Phase ?]: AppHeader остаётся серверным компонентом: кнопка «Добавить» — навигационная ссылка (Link + Button asChild), D-08
- [Phase ?]: [02-05] ScoreBreakdown (LIST-07): client-leaf Collapsible, свёрнут по умолчанию; shared-now — breakdown и total считаются одним now в RSC-родителе (list/page.tsx), листья без new Date → сумма разбивки == total
- [Phase ?]: [03-01] Edit-слой: findItemForUser/updateItemForUser со scoping and(eq(id),eq(userId)) (IDOR T-3-01/T-3-02); updateItem рубли→копейки один раз, { ok } без redirect; единая форма add/edit (mode/initialValues); пересчёт badge на чтении (D-08)
- [Phase ?]: 03-02: удаление (ITEM-08) — deleteItemForUser со scoping по userId (IDOR T-3-05) + deleteItem без payload-валидации (D-06); AlertDialog confirm, e.preventDefault() держит диалог открытым при ошибке (D-05/T-3-06)
- [Phase ?]: 03-02: AlertDialog взят из уже установленного unified-пакета radix-ui (нулевой прирост supply-chain), а не отдельного @radix-ui/react-alert-dialog
- [Phase ?]: 04-01 D-07: статус «куплено» = одна nullable purchased_at timestamp (option-a), null=активна
- [Phase ?]: 04-03: useOptimistic+useTransition+router.refresh в одном startTransition — реконсиляция без отскока (A1 подтверждена, фолбэк не нужен)
- [Phase ?]: 04-03: граница RSC→client на примитивах (total/createdAtMs/purchasedAtMs) — ListView получает ListViewItem, breakdown уцелевает через переупорядочивание ссылок
- [Phase ?]: 04-03: sonner theme=light, next-themes удалён; тост возврата без кнопки Отменить (Open Question 1)
- [Phase ?]: 04-04: ListControls — контролируемый client-leaf без состояния (sortKey/showPurchased держит ListView, эфемерный useState, D-09); партиция ДО сортировки (§Pitfall 1 — архив всегда sortPurchased); купленная карточка — избыточный канал статуса (opacity-70 + line-through, не только цвет)
- [Phase ?]: 04-04: визуальный бэкстоп 375px (LIST-08) отложен в UAT (/gsd-verify-work 4), как визуальные бэкстопы Фазы 3 — не сфабрикован, ждёт человека
- [Phase ?]: Тач-цель ≥44px чекбокса «куплено» — через обёртку-<label> (h-11 w-11) вокруг глифа size-5, а не раздуванием самого Checkbox (G-04-2)
- [Phase ?]: [05-01] Чистое ядро зависимостей: isBlocked (прямая блокировка, без обхода графа, D-02) + wouldCreateCycle (обход depends_on с visited-set, конечен при corrupt cycle, D-05); ноль импортов, 13 юнит-тестов зелёные (TDD RED→GREEN)

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- ✓ Resolved (Phase 2): значения шкал закрыты — «Жизненно важно»=12 (D-03), DoubtsType 0/−1/−3, BenefitType по SUMMARY; exhaustive Record<Enum,number> без `?? 0`.
- ✓ Resolved (Phase 2): часовой пояс границы дня — `deadlinePoints` нормализует deadline и `now` к UTC-полуночи перед `differenceInCalendarDays` (WR-01).
- None open for Phase 3.
- ⏳ Open (Phase 4): LIST-08 — mobile-first визуальный бэкстоп на 375px отложен в UAT (`/gsd-verify-work 4`). Не провален; реализация (панель, приглушение, тост) завершена, ждёт ручного подтверждения тач-зон/sticky/усечения.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-19T04:59:16.063Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None
