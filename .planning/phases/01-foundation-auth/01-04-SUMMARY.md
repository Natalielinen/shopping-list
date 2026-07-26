---
phase: 01-foundation-auth
plan: 04
subsystem: auth
tags: [better-auth, logout, error-mapping, enumeration-guard, playwright, isolation, vitest, tdd, mobile-first]

# Dependency graph
requires:
  - "01-02: серверный Better Auth (auth.ts), браузерный authClient (signOut), шов изоляции getCurrentUser -> findItemsForUser, харнесс тестовой БД (seedUser/seedItem над DATABASE_URL_TEST)"
  - "01-03: экраны login/register (LoginForm/RegisterForm), серверный guard в (app)/layout, AppHeader со слотом под выход, e2e global-setup + Playwright на DATABASE_URL_TEST"
provides:
  - "Кнопка «Выйти» (LogoutButton) в шапке — authClient.signOut() -> router.push('/login') (D-09), завершает контур identity (Criterion 3 / AUTH-03)"
  - "Централизованный маппинг ошибок аутентификации (mapAuthError) на тексты UI-SPEC — обобщённый вход (enumeration-guard V7), «email занят», сетевая ошибка"
  - "E2E logout с любой защищённой страницы + браузерный e2e-тест изоляции на двух пользователях (AUTH-04 end-to-end)"
affects: [auth, ui, testing]

# Tech tracking
tech-stack:
  added:
    - "Без новых установок — задействованы better-auth authClient.signOut, next/navigation useRouter, @playwright/test, vitest"
  patterns:
    - "Единая точка маппинга ошибок (mapAuthError(error, context)) — формы не показывают сырые серверные детали (T-04-ERRLEAK)"
    - "Login-контекст ВСЕГДА сводит ошибку неверных учётных данных к одной строке — enumeration-guard независим от существования аккаунта (V7, prohibition)"
    - "LogoutButton — client-leaf ('use client') в серверной шапке; signOut инвалидирует серверную DB-сессию + cookie, затем router.push + refresh"
    - "E2E-изоляция: пользователь A засевается напрямую в тестовую БД (seedUser/seedItem), пользователь B — через API Better Auth (авто-вход), проверка через реальный браузерный путь"

key-files:
  created:
    - "src/lib/auth-errors.ts"
    - "src/lib/auth-errors.test.ts"
    - "src/components/app/LogoutButton.tsx"
    - "e2e/auth/logout.spec.ts"
    - "e2e/auth/isolation.spec.ts"
  modified:
    - "src/components/app/AppHeader.tsx"
    - "src/components/auth/LoginForm.tsx"
    - "src/components/auth/RegisterForm.tsx"

key-decisions:
  - "mapAuthError принимает контекст ('login' | 'register'): в login любой credential-error (401/403/INVALID_EMAIL_OR_PASSWORD) -> обобщённая строка, всё остальное -> сеть; в register 422/USER_ALREADY_EXISTS -> «email занят», остальное -> сеть"
  - "LogoutButton — вариант outline (нейтральный, не accent — UI-SPEC Color), высота h-11 (44px touch target), без диалога подтверждения (выход не деструктивен)"
  - "LogoutButton уводит на /login даже при сбое signOut (try/catch) — пользователь всё равно выходит из UI"
  - "E2E-изоляция: A — прямой seed в БД (не нужен пароль/логин A), B — API sign-up с авто-входом; проверяем невидимость секретного title A и пустой стейт для B"

patterns-established:
  - "Централизованный map ошибок аутентификации на тексты UI-SPEC как единственная точка перевода серверной ошибки в UI-строку"
  - "Enumeration-guard на уровне маппинга: login-ошибка не различает несуществующий аккаунт и неверный пароль"

requirements-completed: [AUTH-03]

coverage:
  - id: L1
    description: "mapAuthError(login) для 401/403/INVALID_EMAIL_OR_PASSWORD возвращает ровно «Неверный email или пароль»; несуществующий аккаунт и неверный пароль неотличимы (V7)"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "npx vitest run src/lib/auth-errors.test.ts — 12/12 green"
        status: pass
    human_judgment: false
  - id: L2
    description: "mapAuthError(register) для 422/USER_ALREADY_EXISTS -> «Этот email уже занят»; сеть/сервер -> «Что-то пошло не так. Попробуйте ещё раз.»"
    verification:
      - kind: unit
        ref: "src/lib/auth-errors.test.ts — email-taken и network кейсы green"
        status: pass
    human_judgment: false
  - id: L3
    description: "Выход с защищённой страницы очищает сессию и ведёт на /login; повторный заход на /list снова редиректит на /login (Criterion 3 / AUTH-03 / D-07+D-09)"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/auth/logout.spec.ts — 1/1 green"
        status: pass
    human_judgment: false
  - id: L4
    description: "Пользователь B, войдя в браузере, не видит засеянные данные пользователя A — виден только пустой стейт B (AUTH-04 end-to-end)"
    requirement: "AUTH-04"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/auth/isolation.spec.ts — 1/1 green"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-26
status: complete
---

# Phase 1 Plan 04: Выход из аккаунта и укрепление текстов ошибок — Summary

**Завершён контур аутентификации фазы: кнопка «Выйти» в шапке инвалидирует серверную сессию и уводит на `/login` (Criterion 3 / AUTH-03), маппинг ошибок (`mapAuthError`) сведён к текстам UI-SPEC с enumeration-guard на входе (V7), а браузерный e2e-тест на двух пользователях подтвердил изоляцию данных на уровне реального пути (AUTH-04 end-to-end) — полный прогон `npx vitest run` (25/25) и `npx playwright test` (7/7) зелёный.**

## Performance

- **Duration:** ~5 мин
- **Started:** 2026-07-26T15:27:20Z
- **Completed:** 2026-07-26T15:32:25Z
- **Tasks:** 2 (Task 1 — tdd, коммиты RED->GREEN; Task 2 — e2e)
- **Files:** 5 создано, 3 изменено

## Accomplishments
- **`src/lib/auth-errors.ts`** — `mapAuthError(error, context)` + константы `AUTH_ERROR_MESSAGES`. Login-контекст ВСЕГДА сводит credential-ошибку (401/403/`INVALID_EMAIL_OR_PASSWORD`) к обобщённой «Неверный email или пароль», всё остальное — к сетевому тексту (enumeration-guard, T-04-ENUM/V7). Register-контекст: 422/`USER_ALREADY_EXISTS` -> «Этот email уже занят», иначе — сеть. Тексты дословно из UI-SPEC Copywriting Contract.
- **`src/components/app/LogoutButton.tsx`** (`'use client'`) — кнопка «Выйти» (outline neutral, `h-11`/44px touch target, без диалога), вызывает `authClient.signOut()` -> `router.push('/login')` + `router.refresh()` (D-09); при сбое signOut всё равно уводит на `/login`.
- **`src/components/app/AppHeader.tsx`** — слот справа заполнен `LogoutButton` (D-08 завершён: имя + email + выход).
- **`LoginForm.tsx` / `RegisterForm.tsx`** — инлайновый маппинг заменён на `mapAuthError(error, "login" | "register")`; form-level shadcn `Alert` (destructive) без раскрытия серверных деталей.
- **`e2e/auth/logout.spec.ts`** — выход с `/list`, редирект на `/login`, повторный `/list` снова редиректит (сессия очищена — Criterion 3).
- **`e2e/auth/isolation.spec.ts`** — A засеян напрямую в тестовую БД (seedUser + seedItem), B регистрируется через API; B открывает `/list`, секретный title A не виден, показан пустой стейт (AUTH-04 e2e).

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1 (TDD RED): падающие тесты mapAuthError** — `5ba7f49` (test)
2. **Task 1 (TDD GREEN): LogoutButton + auth-errors + подключение в формы/шапку** — `860f441` (feat)
3. **Task 2: e2e logout + браузерная изоляция** — `0431e17` (test)

_Task 1 (tdd="true") дал два коммита: RED (модуль `auth-errors.ts` отсутствует -> тест не собирается) -> GREEN (реализация + разводка в формы/шапку)._

## MVP+TDD Gate

Фаза выполнялась с `MVP_MODE=true, TDD_MODE=false` — halt-gate MVP+TDD НЕактивен. Task-level `tdd="true"` для Task 1 соблюдён: RED-коммит (`test`) предшествует GREEN-коммиту (`feat`).

## Verification Evidence
- `npx vitest run src/lib/auth-errors.test.ts` -> 12/12 green (login-обобщение, email-taken, network, дословные тексты UI-SPEC)
- `npx tsc --noEmit` -> exit 0
- `npx playwright test e2e/auth/logout.spec.ts e2e/auth/isolation.spec.ts` -> 2/2 green
- `npx vitest run` (полный) -> 6 файлов / 25 тестов green (без регрессий form/config/изоляция)
- `npx playwright test` (полный) -> 7/7 green (register, login+reload, root-redirect, protected-redirect, empty-list, logout, isolation)

## Decisions Made
- **Контекстный маппинг ошибок:** `mapAuthError(error, "login" | "register")` вместо двух отдельных функций — одна точка перевода серверной ошибки в UI-строку, контекст выбирает набор правил. Login-ветка структурно не может раскрыть существование аккаунта (единая строка для 401/403).
- **LogoutButton — outline, без подтверждения:** UI-SPEC Color относит выход к нейтральному контролу (не accent), а Destructive confirmation в фазе нет (выход не деструктивен). `h-11` даёт 44px touch target.
- **Отказоустойчивость выхода:** `try/catch` вокруг `signOut()` — даже при сетевом сбое пользователь уводится на `/login` (UI-состояние выхода не должно застревать).
- **E2E-изоляция через смешанный сидинг:** A засевается напрямую в БД (пароль A не нужен — A не логинится), B создаётся через API Better Auth (авто-вход даёт сессию B в браузере). Проверяется невидимость уникального title A и пустой стейт B — тест настоящий, а не тавтологичный.

## Deviations from Plan

None — план выполнен ровно как написан. Подмен пакетов нет, архитектурных изменений нет, out-of-scope правок нет.

## Known Stubs
- **Нет заглушек.** Все артефакты плана реализованы и покрыты (unit + e2e). Ветка непустого списка в `list/page.tsx` остаётся заготовкой Фазы 2 (D-13 read-only) — это зафиксированное решение прошлых планов, не относится к 01-04.

## Threat Flags
Новой security-поверхности вне `<threat_model>` не введено. Митигации подтверждены: `mapAuthError` login-обобщение (T-04-ENUM/V7), `authClient.signOut` очищает серверную сессию + cookie с e2e-подтверждением (T-04-LOGOUT), браузерный тест изоляции B≠A (T-04-IDOR-E2E), сетевые/серверные ошибки маплятся на общий текст (T-04-ERRLEAK).

## Next Phase Readiness
- Контур аутентификации Фазы 1 полностью замкнут: register -> login -> persistent-сессия -> guard -> пустой список -> logout, изоляция доказана на уровне интеграции (план 02) и браузера (план 04).
- Фаза 2 (CRUD покупок + движок приоритета) строится поверх шва изоляции `and(eq(id), eq(userId))`; `mapAuthError` — образец для будущего маппинга ошибок доменных Server Actions.
- Открытый нефункциональный пункт (не блокирует): Better Auth логирует «Base URL is not set» — кандидат на установку `BETTER_AUTH_URL` в последующих фазах (все e2e зелёные без него).

## Self-Check: PASSED

- Все созданные файлы существуют на диске (auth-errors + test, LogoutButton, две e2e-спеки).
- Все коммиты присутствуют: 5ba7f49, 860f441, 0431e17.
- Прогоны: `npx tsc --noEmit` (0), `npx vitest run` (25/25 green), `npx playwright test` (7/7 green, включая logout AUTH-03 и изоляцию AUTH-04 e2e).

---
*Phase: 01-foundation-auth*
*Completed: 2026-07-26*
