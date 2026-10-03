---
phase: 01-foundation-auth
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, shadcn, drizzle, postgres, better-auth, zod, vitest, playwright, tdd]

# Dependency graph
requires: []
provides:
  - "Компилируемый каркас Next.js 16 (App Router, src/, Tailwind v4, TS 5) со всем стеком Фазы 1"
  - "Server-only Drizzle-клиент над postgres.js (src/server/db/client.ts) — точка входа в БД"
  - "drizzle.config.ts, указывающий на forward-путь schema.ts и каталог миграций ./drizzle"
  - "Общий Zod-контракт валидации email/пароля (registerSchema, loginSchema) + выведенные типы"
  - "Настроенная тест-обвязка: Vitest 4 (jsdom, alias @/*) и Playwright (webServer boot)"
  - "shadcn/ui (radix-nova, base neutral, OKLCH) + компоненты button/input/label/card/alert/form"
  - ".env.example с контрактом DATABASE_URL / DATABASE_URL_TEST / BETTER_AUTH_SECRET без секретов"
affects: [auth, database, ui, testing]

# Tech tracking
tech-stack:
  added:
    - "next@16.2.12, react@19.2, typescript@5"
    - "drizzle-orm@0.45.2, postgres@3.4.9, drizzle-kit@0.31.10"
    - "better-auth@1.6.25, @better-auth/cli@1.4.21, @node-rs/argon2@2.0.2"
    - "zod@4.4.3, react-hook-form@7.83.0, @hookform/resolvers@5.5.5, server-only"
    - "vitest@4.1.10, @vitejs/plugin-react, vite-tsconfig-paths, jsdom, @testing-library/{react,user-event,jest-dom,dom}"
    - "@playwright/test@1.62.0, tsx"
    - "shadcn/ui (radix-nova preset)"
  patterns:
    - "server-only guard первой строкой в модулях доступа к БД (защита секретов от клиентского бандла)"
    - "Единый Zod-контракт как источник правды для валидации client+server + z.infer типы"
    - "TDD-цикл RED -> GREEN на уровне задачи (отдельные test/feat коммиты)"
    - "Единый долгоживущий postgres.js-клиент (не pg.Pool) для не-serverless сервера"

key-files:
  created:
    - "src/server/db/client.ts"
    - "drizzle.config.ts"
    - "src/lib/validation/auth.ts"
    - "src/lib/validation/auth.test.ts"
    - "vitest.config.ts"
    - "vitest.setup.ts"
    - "playwright.config.ts"
    - ".env.example"
    - "src/components/ui/form.tsx"
    - "components.json"
    - ".npmrc"
  modified:
    - "package.json"
    - ".gitignore"

key-decisions:
  - "shadcn init через новый CLI: preset radix-nova (base neutral, OKLCH, lucide) — соответствует UI-SPEC; классического флага --base-color больше нет"
  - "form.tsx написан вручную по каноничному образцу shadcn — registry-элемент form в radix-nova поставляется без файла"
  - ".npmrc legacy-peer-deps=true — снимает ложный конфликт optional-peer valibot внутри @hookform/resolvers"
  - "Схема (schema.ts) намеренно не привязана к Drizzle-клиенту в этом плане — владение client.ts остаётся за 01-01, schema.ts создаётся в 01-02"

patterns-established:
  - "server-only: модули доступа к секретам/БД падают при импорте на клиенте"
  - "Zod single source of truth: одна схема валидирует форму и Server Action, типы через z.infer"
  - "TDD gate: RED-коммит (падающий тест) предшествует GREEN-коммиту (реализация)"

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "Каркас Next 16 + весь стек Фазы 1 компилируется и поднимается (Walking Skeleton)"
    verification:
      - kind: e2e
        ref: "npx next build (compiles) + npx next dev -> GET / 200"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server-only Drizzle-клиент над postgres.js + drizzle.config.ts"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Общий Zod-контракт валидации email/пароля (registerSchema отклоняет невалидный email и пароль <8; loginSchema требует непустой пароль; тексты ошибок из UI-SPEC)"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "src/lib/validation/auth.test.ts (5/5 pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Тест-обвязка Vitest 4 (jsdom, alias @/*) + Playwright (webServer boot) — доказан мажорный апгрейд Vitest 4 (риск A4)"
    verification:
      - kind: unit
        ref: "npx vitest run (Vitest 4.1.10, 1 файл / 5 тестов pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: ".env.example документирует DATABASE_URL, DATABASE_URL_TEST, BETTER_AUTH_SECRET без реальных секретов; .env* в .gitignore"
    verification:
      - kind: other
        ref: "grep DATABASE_URL=/DATABASE_URL_TEST=/BETTER_AUTH_SECRET= в .env.example; .gitignore игнорирует .env*"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-07-26
status: complete
---

# Phase 1 Plan 01: Каркас Walking Skeleton и TDD-обвязка — Summary

**Next.js 16 + Tailwind v4 + Drizzle/postgres.js + Better Auth стек скаффолжен и компилируется; поднят server-only Drizzle-клиент, настроены Vitest 4 и Playwright, а общий Zod-контракт валидации email/пароля написан по TDD и покрыт зелёным тестом.**

## Performance

- **Duration:** ~33 мин
- **Started:** 2026-07-26T13:18:00Z (примерно)
- **Completed:** 2026-07-26T13:51:12Z
- **Tasks:** 3 (Task 3 — TDD, два коммита RED→GREEN)
- **Files modified:** 34 файла в коммитах (включая scaffold и package-lock)

## Accomplishments
- Scaffold Next.js 16.2.12 (App Router, TypeScript 5, Tailwind v4, src/) со всем стеком Фазы 1, установленным с точными версиями из RESEARCH
- shadcn/ui инициализирован (preset radix-nova, base color neutral, CSS-переменные OKLCH, lucide) + компоненты button/input/label/card/alert/form
- Server-only Drizzle-клиент над одним долгоживущим клиентом postgres.js + drizzle.config.ts на forward-путь schema.ts
- Vitest 4 и Playwright настроены; мажорный апгрейд Vitest 4 доказан рабочим прогоном (снят риск A4 из RESEARCH)
- Общий Zod-контракт валидации (registerSchema/loginSchema) написан по TDD с текстами ошибок ровно из UI-SPEC Copywriting Contract; 5/5 тестов зелёные
- .env.example документирует три ключа окружения без утечки секретов

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Scaffold Next 16 + стек + shadcn + .env.example** — `f899d01` (feat)
2. **Task 2: Server-only Drizzle-клиент + drizzle.config.ts** — `6e1a075` (feat)
3. **Task 3 (TDD RED): Vitest/Playwright harness + падающий тест схемы** — `8457a3d` (test)
4. **Task 3 (TDD GREEN): реализация Zod-схем валидации** — `7db1501` (feat)

_Task 3 (tdd="true") дал два коммита: RED (падающий тест) → GREEN (реализация)._

## Files Created/Modified
- `src/server/db/client.ts` — server-only Drizzle-клиент над postgres.js (единый клиент)
- `drizzle.config.ts` — конфиг drizzle-kit (dialect postgresql, schema→schema.ts, out ./drizzle, url из DATABASE_URL)
- `src/lib/validation/auth.ts` — registerSchema, loginSchema + типы RegisterInput/LoginInput
- `src/lib/validation/auth.test.ts` — unit-тесты Zod-схем (граница D-03, тексты UI-SPEC)
- `vitest.config.ts` — Vitest 4: @vitejs/plugin-react + vite-tsconfig-paths, jsdom
- `vitest.setup.ts` — подключение матчеров @testing-library/jest-dom
- `playwright.config.ts` — baseURL + webServer, поднимающий `next dev`
- `.env.example` — контракт DATABASE_URL / DATABASE_URL_TEST / BETTER_AUTH_SECRET
- `src/components/ui/form.tsx` — каноничный shadcn Form (react-hook-form обёртка), написан вручную
- `components.json` — конфигурация shadcn (baseColor neutral, cssVariables, lucide)
- `.npmrc` — legacy-peer-deps=true (обход конфликта optional-peer)
- `package.json`, `.gitignore` — стек-зависимости; `!.env.example` в игноре

## Decisions Made
- **shadcn через новый CLI:** актуальный `shadcn init` отказался от флага `--base-color` и работает через именованные пресеты (Nova/Vega/...). Использован `-d -b radix` → preset radix-nova, который даёт ровно требуемое UI-SPEC: base color neutral, CSS-переменные OKLCH, иконки lucide, шрифт Geist. Компоненты используют объединённый пакет `radix-ui` (не отдельные `@radix-ui/react-*`).
- **form.tsx вручную:** в реестре radix-nova элемент `form` — пустая заглушка без файлов, поэтому канонический `Form` (обёртка react-hook-form) написан вручную в стиле пресета (`Slot.Root`, локальный `Label`).
- **Схема не привязана к клиенту:** `drizzle(client)` без schema — `schema.ts` создаётся в плане 01-02, владение `client.ts` остаётся за этим планом.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Конфликт optional-peer dependency при установке @hookform/resolvers**
- **Found during:** Task 1 (установка runtime-зависимостей)
- **Issue:** `@hookform/resolvers@5.5.5` объявляет optional peer `valibot@^1.0.0`, но его транзитивная цепочка `@typeschema/valibot` тянет `valibot@0.39` → npm ERESOLVE блокирует установку. Пакет valibot проектом не используется (валидация на Zod).
- **Fix:** Добавлен `.npmrc` c `legacy-peer-deps=true` (+ `save-exact=true`). Не подменял пакеты — все зависимости легитимны (RESEARCH § Package Legitimacy Audit).
- **Files modified:** .npmrc
- **Verification:** npm install runtime + dev deps проходит; npx tsc/next build/vitest зелёные
- **Committed in:** f899d01

**2. [Rule 3 - Blocking] Отсутствует required peer @testing-library/dom**
- **Found during:** Task 3 (первый прогон Vitest, RED)
- **Issue:** `@testing-library/jest-dom/vitest` в setup падал с `Cannot find package '@testing-library/dom'` — под legacy-peer-deps npm не доустановил обязательный peer RTL/jest-dom.
- **Fix:** `npm install -D @testing-library/dom` (первоправая тест-библиотека, обязательный peer).
- **Files modified:** package.json, package-lock.json
- **Verification:** setup грузится; RED падает теперь по правильной причине (нет модуля схемы); после GREEN — 5/5 зелёные
- **Committed in:** 8457a3d (в составе test-коммита Task 3)

**3. [Rule 3 - Blocking] .env.example игнорировался git**
- **Found during:** Task 1 (создание .env.example)
- **Issue:** сгенерированный `.gitignore` содержит `.env*`, что исключало и `.env.example`, который обязан коммититься.
- **Fix:** добавлено исключение `!.env.example` в `.gitignore`.
- **Files modified:** .gitignore
- **Verification:** `git add .env.example` проходит, файл в индексе
- **Committed in:** f899d01

---

**Total deviations:** 3 auto-fixed (3 blocking, Rule 3)
**Impact on plan:** Все правки — инфраструктурная разблокировка установки/харнесса, без изменения архитектуры или scope. Ни одной подмены пакетов.

## Issues Encountered
- **create-next-app в непустой директории:** worktree уже содержал `.claude/`, `.planning/`. Scaffold выполнен во временную поддиректорию `scaffold-tmp` и перенесён в корень; служебные stub-файлы (`CLAUDE.md`, `AGENTS.md`, `.next`) не переносились. Вложенного `.git` create-next-app не создал.
- **Новый shadcn CLI интерактивен:** `init` спрашивал preset; обойдено флагом `-d` (defaults → preset base/radix-nova) для неинтерактивного запуска.
- **CLI Postgres не на PATH:** `pg_isready`/`psql`/`docker` недоступны в bash-окружении, но Postgres слушает порт 5432 (проверено Node-сокетом) — hard-prerequisite выполнен. Ни одна проверка этого плана не подключается к БД (client.ts только типизируется), поэтому живой Postgres здесь не требовался.

## User Setup Required
Внешние сервисы требуют ручной настройки ПЕРЕД планами 01-02+ (БД-зависимая работа):
- **PostgreSQL 16/17** запущен и доступен (локально или Docker `postgres:17`). На машине БД уже слушает `localhost:5432`.
- Скопировать `.env.example` → `.env.local` и заполнить:
  - `DATABASE_URL` — основная БД
  - `DATABASE_URL_TEST` — отдельная одноразовая тестовая БД (для тестов изоляции)
  - `BETTER_AUTH_SECRET` — сгенерировать `openssl rand -base64 32` (≥32 символов)
- **Node 22 LTS** — установлен (v22.15.1).
- Браузеры Playwright установлены (`npx playwright install` выполнен).

## Next Phase Readiness
- Каркас компилируется, поднимается (`next dev` → 200) и покрыт рабочим тест-прогонщиком — фундамент для всех волн Фазы 1 готов.
- Готово для плана 01-02: генерация схемы Better Auth (`@better-auth/cli generate`) + таблица `items`, привязка schema к Drizzle-клиенту, миграции.
- **Блокер для DB-зависимых планов:** пользователь должен задать `.env.local` (DATABASE_URL/DATABASE_URL_TEST/BETTER_AUTH_SECRET) — иначе миграции и e2e/интеграционные тесты не запустятся.
- **Примечание по AUTH-01:** в этом плане реализована только валидационная часть (Zod-контракт). Полный поток регистрации (endpoint, auto-login, редирект) реализуется в последующих планах фазы.

## Self-Check: PASSED

- Все созданные файлы существуют: client.ts, drizzle.config.ts, auth.ts, auth.test.ts, vitest.config.ts, vitest.setup.ts, playwright.config.ts, .env.example, form.tsx, components.json, 01-01-SUMMARY.md.
- Все коммиты присутствуют: f899d01, 6e1a075, 8457a3d, 7db1501, 79a0d63.
- Прогоны: `npx tsc --noEmit` (0), `npx next build` (compiles), `npx next dev` (GET / 200), `npx vitest run` (5/5 green).

---
*Phase: 01-foundation-auth*
*Completed: 2026-07-26*
