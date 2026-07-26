---
phase: 01-foundation-auth
plan: 03
subsystem: ui
tags: [nextjs, app-router, better-auth, react-hook-form, zod, playwright, rtl, tracer, mobile-first]

# Dependency graph
requires:
  - "01-01: каркас Next 16, shadcn/ui (button/input/label/card/alert/form), Zod-контракт auth, обвязка Vitest/Playwright"
  - "01-02: серверная конфигурация Better Auth (auth.ts), браузерный authClient, catch-all /api/auth, шов изоляции getCurrentUser -> findItemsForUser, миграции схемы"
provides:
  - "Экраны аутентификации: /register и /login (RSC-оболочки + client-leaf формы RegisterForm/LoginForm)"
  - "Корневой редирект / -> /login|/list по серверной сессии (D-05)"
  - "Защищённая группа маршрутов (app): серверный getSession-guard в layout + AppHeader (имя приложения + email), loading.tsx, error.tsx"
  - "Защищённый пустой список /list через findItemsForUser + empty state из UI-SPEC (D-06)"
  - "Playwright global-setup (сброс тестовой БД) + e2e: register/login/root-redirect/protected-redirect/empty-list"
  - "Компонентные тесты форм (RTL): валидация + pending/disabled submit"
affects: [ui, auth, testing]

# Tech tracking
tech-stack:
  added:
    - "Задействованы (без новых установок): react-hook-form, @hookform/resolvers/zod, lucide-react, next/link, next/navigation"
  patterns:
    - "RSC-страница/layout + client-leaf форма ('use client' только в листе) — секрет BETTER_AUTH_SECRET не попадает в бандл"
    - "Серверный getSession-guard в layout группы (app) как граница безопасности (не proxy/middleware, D-07)"
    - "Playwright webServer направляет приложение на DATABASE_URL_TEST; readiness-проба по /register (200), т.к. / отдаёт 307-редирект"
    - "e2e готовит пользователя через API Better Auth (POST /api/auth/sign-up/email), context.clearCookies() изолирует сценарий входа"
    - "Vitest исключает каталог e2e/ (спеки Playwright) из сбора"

key-files:
  created:
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(auth)/register/page.tsx"
    - "src/components/auth/LoginForm.tsx"
    - "src/components/auth/RegisterForm.tsx"
    - "src/components/auth/LoginForm.test.tsx"
    - "src/components/auth/RegisterForm.test.tsx"
    - "src/app/(app)/layout.tsx"
    - "src/app/(app)/loading.tsx"
    - "src/app/(app)/error.tsx"
    - "src/app/(app)/list/page.tsx"
    - "src/components/app/AppHeader.tsx"
    - "e2e/global-setup.ts"
    - "e2e/auth/register.spec.ts"
    - "e2e/auth/login.spec.ts"
    - "e2e/auth/root-redirect.spec.ts"
    - "e2e/auth/protected-redirect.spec.ts"
    - "e2e/app/empty-list.spec.ts"
  modified:
    - "src/app/layout.tsx"
    - "src/app/page.tsx"
    - "playwright.config.ts"
    - "vitest.config.ts"
    - ".gitignore"

key-decisions:
  - "RegisterForm подставляет name = email в signUp.email: поле name таблицы Better Auth обязательно (notNull), а D-01 запрещает запрашивать отдельное имя — в шапке всё равно показываем email"
  - "Playwright readiness-проба по /register (прямой 200), а не по / (307-редирект): редирект на / приводил к таймауту webServer (проба не принимала редирект)"
  - "e2e-приложение работает с тестовой БД: webServer.env.DATABASE_URL := DATABASE_URL_TEST; global-setup сбрасывает и мигрирует именно тестовую БД, изолируя e2e от dev-данных"
  - "Отдельный порт e2e (3100) и reuseExistingServer:false — из-за single-server-lock Next 16 (второй next dev в том же каталоге отказывается стартовать)"

patterns-established:
  - "RSC page/layout + client-leaf form: интерактивность и хуки только в 'use client'-листе"
  - "Серверный guard в (app)/layout.tsx — единственная точка защиты маршрутов группы"
  - "e2e через реальный Better Auth API для сидинга пользователя + clearCookies для чистого сценария входа"

requirements-completed: [AUTH-01, AUTH-02]

coverage:
  - id: C1
    description: "Регистрация валидным email + паролем (>=8) авто-входит и ведёт на защищённый пустой список (Criterion 1 / AUTH-01 / D-04)"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/auth/register.spec.ts (1/1 green)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Вход сохраняет сессию между перезагрузками (Criterion 2 / AUTH-02 / D-10)"
    requirement: "AUTH-02"
    verification:
      - kind: e2e
        ref: "npx playwright test e2e/auth/login.spec.ts (1/1 green, reload остаётся на /list)"
        status: pass
    human_judgment: false
  - id: C3
    description: "Неавторизованный на / -> /login (D-05) и защищённый /list без сессии -> /login (D-07)"
    verification:
      - kind: e2e
        ref: "root-redirect.spec.ts + protected-redirect.spec.ts (2/2 green)"
        status: pass
    human_judgment: false
  - id: C4
    description: "Авторизованный видит пустой стейт «Список пуст» + «Скоро здесь можно будет добавлять покупки.» без формы добавления (D-06)"
    verification:
      - kind: e2e
        ref: "empty-list.spec.ts (1/1 green, 0 textbox/кнопок добавления)"
        status: pass
    human_judgment: false
  - id: C5
    description: "Формы валидируются общим Zod-контрактом (тексты UI-SPEC) и блокируют submit в pending"
    verification:
      - kind: unit
        ref: "RegisterForm.test.tsx + LoginForm.test.tsx (7/7 green, RTL)"
        status: pass
    human_judgment: false
  - id: C6
    description: "Страницы/layout остаются RSC; интерактивность в leaf 'use client' — секрет не в бандле (Anti-Pattern/T-03-SECRETLEAK)"
    verification:
      - kind: other
        ref: "'use client' только в RegisterForm/LoginForm/error.tsx; layout/page/list — серверные; npx tsc --noEmit exit 0"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-07-26
status: complete
---

# Phase 1 Plan 03: Экраны аутентификации и защищённый список (Walking Skeleton tracer) — Summary

**Собран сквозной срез Walking Skeleton: регистрация -> авто-вход -> защищённый пустой список, затем вход с сохранением сессии между перезагрузками — доказана вся цепочка (форма -> authClient -> Better Auth -> сессия -> серверный guard в layout -> getCurrentUser -> findItemsForUser -> рендер пустого стейта) на реальном e2e-пути (Playwright), формы покрыты RTL, редиректы D-05/D-07 и пустой стейт D-06 зелёные.**

## Performance

- **Duration:** ~21 мин
- **Started:** 2026-07-26T14:59:10Z
- **Completed:** 2026-07-26T15:21:03Z
- **Tasks:** 2 (Task 1 — tracer; Task 2 — tdd, коммиты RED->GREEN)
- **Files:** 17 создано, 5 изменено

## Accomplishments
- **Tracer (Task 1)** — сквозной happy-path задел каждый слой фазы: корневой редирект (D-05), экран регистрации (client-leaf `RegisterForm` -> `authClient.signUp.email` -> авто-вход D-04), серверный guard в `(app)/layout.tsx` (`getSession` -> `redirect('/login')`, D-07), защищённый `/list` через `findItemsForUser` с пустым стейтом ровно из UI-SPEC (D-06), `AppHeader` (имя приложения + email, D-08 partial), `loading.tsx`/`error.tsx`. Проверен Playwright (`register.spec.ts`) end-to-end до расширения.
- **Экран входа (Task 2)** — `LoginForm` (`authClient.signIn.email`), переключатели login<->register с текстами UI-SPEC, pending-состояние кнопки (disabled + spinner).
- **Компонентные тесты (RTL, TDD)** — `RegisterForm.test.tsx`/`LoginForm.test.tsx`: тексты ошибок валидации из UI-SPEC (email/короткий пароль/пустое поле), блокировка двойного submit в pending. RED (LoginForm отсутствовал) -> GREEN.
- **e2e guard-покрытие** — `login.spec.ts` (персистентность сессии после reload, AUTH-02/D-10), `root-redirect.spec.ts` (D-05), `protected-redirect.spec.ts` (D-07), `empty-list.spec.ts` (D-06, без формы добавления).
- **Инфраструктура e2e** — `global-setup.ts` сбрасывает тестовую БД; `playwright.config.ts` направляет приложение на `DATABASE_URL_TEST` и поднимает dev на выделенном порту.

## Task Commits

1. **Task 1: Tracer — register -> авто-вход -> защищённый пустой список** — `87c5b7b` (feat)
2. **Task 2 (TDD RED): компонентные тесты RegisterForm + LoginForm** — `588da31` (test)
3. **Task 2 (TDD GREEN): LoginForm + вход + guard-e2e** — `b6984cf` (feat)

_Task 2 (tdd="true") дал два коммита: RED (LoginForm отсутствует -> тесты падают; RegisterForm-тесты зелёные, т.к. форма создана в Task 1) -> GREEN (реализация LoginForm + login page)._

## Tracer Feedback Gate

Автономный прогон: после коммита tracer его `<verify>` (`register.spec.ts`) перезапущен end-to-end и **прошёл зелёным** — архитектура подтверждена, расширение (Task 2) выполнено на проверенном фундаменте.

## Verification Evidence
- `npx tsc --noEmit` -> exit 0
- `npx vitest run` -> 5 файлов / 15 тестов green (7 новых form-тестов + Zod/config/изоляция без регрессий)
- `npx playwright test` -> 5/5 green (register, login+reload, root-redirect, protected-redirect, empty-list)

## Decisions Made
- **`name = email` в регистрации:** таблица `user` Better Auth требует `name` (notNull), а D-01 запрещает отдельное поле имени. Подставляем email; в шапке всё равно показываем `session.user.email`. Обратимо — если понадобится отображаемое имя, добавляется поле формы (D-01 отмечает миграцию).
- **Readiness-проба Playwright по `/register`:** корневой `/` отдаёт 307-редирект, из-за чего webServer-проба не засчитывала готовность и падала по таймауту 120s. Перенаправили пробу на `/register` (прямой 200). Это диагностировано после первого таймаута (см. Deviations).
- **e2e против тестовой БД:** `webServer.env.DATABASE_URL := DATABASE_URL_TEST`, `global-setup` сбрасывает/мигрирует тестовую базу — e2e изолированы от dev-данных и детерминированы. Next не перезаписывает уже заданную переменную окружения значением из `.env.local`.
- **Отдельный порт e2e + reuseExistingServer:false:** Next 16 держит single-server-lock на каталог проекта; выделенный порт 3100 и собственный сервер Playwright исключают конфликт с возможным dev-сервером.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Таймаут Playwright webServer из-за 307-редиректа на readiness-URL**
- **Found during:** Task 1 (первый прогон `register.spec.ts`)
- **Issue:** `webServer.url` указывал на корневой `/`, который отдаёт 307-редирект на `/login`; проба готовности не засчитывала редирект -> таймаут 120s, тесты не стартовали.
- **Fix:** readiness-проба перенаправлена на `/register` (прямой 200, без getSession). Диагностировано ручной загрузкой dev-сервера (curl `/` -> 307, `/register` -> 200).
- **Files modified:** playwright.config.ts
- **Verification:** `register.spec.ts` -> green (4.9s)
- **Committed in:** 87c5b7b

**2. [Rule 3 - Blocking] `npx vitest run` собирал спеки Playwright из e2e/**
- **Found during:** Task 2 (полный прогон vitest)
- **Issue:** Vitest по дефолту включает `**/*.spec.ts`, из-за чего пытался исполнять e2e-спеки Playwright (несовместимый runner) -> 5 «упавших» сьютов при 15 зелёных тестах.
- **Fix:** `test.exclude = [...defaultExclude, "e2e/**"]` в `vitest.config.ts`.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` -> 5 файлов / 15 тестов green
- **Committed in:** b6984cf

**3. [Rule 3 - Infra] Артефакты Playwright не игнорировались git**
- **Found during:** Task 1 (после первого прогона появился `test-results/`)
- **Issue:** сгенерированные каталоги Playwright (`test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`) не были в `.gitignore`.
- **Fix:** добавлены в `.gitignore`.
- **Files modified:** .gitignore
- **Committed in:** 87c5b7b

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 3). Ни подмены пакетов, ни архитектурных изменений. Изменения `playwright.config.ts`/`vitest.config.ts` (владение 01-01) — минимальная инфраструктурная разблокировка e2e/vitest.

## Environment Notes
- Обнаружен и снят leftover-`next dev` из прошлой сессии, державший single-server-lock Next 16 (это, а не код, изначально мешало старту webServer). Для e2e важно, чтобы перед прогоном не был запущен другой dev-сервер этого проекта.
- Better Auth логирует предупреждение «Base URL is not set» — некритично: same-origin `authClient` и потоки на `router.push` работают, все e2e зелёные. Установка `BETTER_AUTH_URL` — кандидат на последующие планы, не требуется для Фазы 1.

## Known Stubs
- **`AppHeader` — слот под кнопку «Выйти» (не реализовано намеренно, D-08 partial).** Logout добавляется в плане 01-04; здесь оставлен только визуальный слот справа. Это зафиксированный план фазы, а не незавершённость: критерии выхода (D-09/AUTH-03) — область плана 04.
- **`list/page.tsx` — ветка рендера непустого списка** (`items.map`) — заготовка на Фазу 2 (запись покупок). В Фазе 1 недостижима (записи не создаются, D-13 read-only), пустой стейт D-06 — единственное состояние. Тест `empty-list.spec.ts` подтверждает отсутствие формы/textbox.

## Threat Flags
Новой security-поверхности вне `<threat_model>` не введено. Митигации подтверждены: серверный `getSession`-guard в `(app)/layout.tsx` (T-03-SESSION), RSC-страницы + client-leaf формы, `server-only` на auth/db-модулях (T-03-SECRETLEAK), same-origin `authClient` + встроенная CSRF-защита Better Auth (T-03-CSRF), реальная серверная проверка вместо оптимистичной (T-03-OPTIMISTIC).

## Next Phase Readiness
- Готово для плана 01-04: кнопка «Выйти» в `AppHeader` (`authClient.signOut` -> `/login`, D-09/AUTH-03) — слот и серверная шапка на месте.
- Полный поток аутентификации (register/login/сессия/guard/пустой список) проверен e2e — фундамент UI Фазы 2 (форма добавления + движок приоритета) готов; запись покупок достраивается по паттерну `and(eq(id), eq(userId))` поверх существующего шва изоляции.

## Self-Check: PASSED

- Все созданные файлы существуют на диске (формы, страницы, layout/loading/error, AppHeader, e2e-спеки, компонентные тесты).
- Все коммиты присутствуют: 87c5b7b, 588da31, b6984cf.
- Прогоны: `npx tsc --noEmit` (0), `npx vitest run` (15/15 green), `npx playwright test` (5/5 green).

---
*Phase: 01-foundation-auth*
*Completed: 2026-07-26*
