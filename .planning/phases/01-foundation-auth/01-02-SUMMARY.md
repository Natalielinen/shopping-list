---
phase: 01-foundation-auth
plan: 02
subsystem: auth
tags: [better-auth, argon2id, drizzle, postgres, isolation, vitest, tdd, migrations]

# Dependency graph
requires:
  - "01-01: каркас Next 16, server-only Drizzle-клиент (src/server/db/client.ts), Zod-контракт auth, обвязка Vitest/Playwright"
provides:
  - "Серверная конфигурация Better Auth (email/password, Argon2id, сессия 30 дней) — src/lib/auth.ts"
  - "Браузерный authClient (signUp/signIn/signOut) — src/lib/auth-client.ts"
  - "Catch-all маршрут аутентификации /api/auth/[...all] (toNextJsHandler)"
  - "Схема БД: канонические таблицы Better Auth (user/session/account/verification) + таблица items (userId FK, индекс), применённая к живой БД миграциями"
  - "Шов изоляции userId: getCurrentUser()/requireUser() (session -> userId) + findItemsForUser(userId) — единственный user-scoped choke point"
  - "Харнесс тестовой БД (resetDb/seedUser/seedItem над DATABASE_URL_TEST) + доказанный двухпользовательский тест изоляции (AUTH-04)"
affects: [auth, database, testing]

# Tech tracking
tech-stack:
  added:
    - "Задействованы (без новых установок): better-auth@1.6.25, @better-auth/cli@1.4.21, @node-rs/argon2@2.0.2, drizzle-kit@0.31.10"
  patterns:
    - "Argon2id через кастомные emailAndPassword.password.hash/verify (переопределяет дефолтный scrypt Better Auth)"
    - "session.expiresIn задаётся ЯВНО (дефолт Better Auth 7 дней != требуемым 30)"
    - "nextCookies() — последним плагином (auto-set httpOnly cookie)"
    - "userId только из серверной сессии; user-scoped repository — единственная точка доступа к items (WHERE user_id = ?)"
    - "@better-auth/cli generate -> drizzle-kit generate -> migrate; сгенерированный SQL коммитится (drift-free)"
    - "Интеграционные тесты БД: @vitest-environment node + алиас server-only + подмена DATABASE_URL на тестовую БД, реальная Postgres (не мок ORM)"

key-files:
  created:
    - "src/lib/auth.ts"
    - "src/lib/auth-client.ts"
    - "src/app/api/auth/[...all]/route.ts"
    - "src/server/db/schema.ts"
    - "src/server/auth/current-user.ts"
    - "src/server/repos/items.ts"
    - "src/server/repos/items.iso.test.ts"
    - "src/lib/auth.config.test.ts"
    - "tests/helpers/db.ts"
    - "tests/helpers/assert-schema.ts"
    - "tests/helpers/load-env.ts"
    - "tests/helpers/vitest-db-setup.ts"
    - "tests/helpers/server-only-stub.ts"
    - "drizzle/0000_soft_phantom_reporter.sql"
    - "drizzle/meta/0000_snapshot.json"
    - "drizzle/meta/_journal.json"
  modified:
    - "drizzle.config.ts"
    - "vitest.config.ts"

key-decisions:
  - "Схема сгенерирована через временный файл (auth-schema.generated.ts) и вручную смёржена в schema.ts с сохранением таблицы items — CLI generate прямой записью в schema.ts мог бы затереть items"
  - "@better-auth/cli не резолвит конфиг с import \"server-only\" — server-only временно снят с auth.ts/client.ts на время генерации и сразу восстановлен"
  - "drizzle-kit/tsx/Vitest не читают .env.local автоматически — добавлен единый загрузчик tests/helpers/load-env.ts, подключён в drizzle.config.ts и в setup Vitest"
  - "server-only падает под Vitest — алиас на пустую заглушку в vitest.config.ts, чтобы серверные модули импортировались в тестах"
  - "Тесты изоляции бьют по DATABASE_URL_TEST; DATABASE_URL подменяется на тестовую БД в setup, чтобы client.ts и сид-хелперы работали с одной базой"

patterns-established:
  - "Isolation seam: session -> getCurrentUser -> user-scoped repository (userId в каждой сигнатуре и WHERE)"
  - "Schema-gate: отдельная [BLOCKING] задача миграции + проба assert-schema перед проверкой поведения (tsc проходит и без применённой БД)"
  - "Better Auth регенерация: CLI generate -> drizzle-kit generate/migrate после любого изменения auth-конфига"

requirements-completed: [AUTH-04]

coverage:
  - id: T1
    description: "Better Auth настроен: email/password, minPasswordLength 8 (D-03), requireEmailVerification false (D-02), autoSignIn по умолчанию (D-04)"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (exit 0); source-ассерты acceptance_criteria Task 1"
        status: pass
    human_judgment: false
  - id: T2
    description: "Пароли хешируются Argon2id (D-12) — хеш начинается с $argon2id$"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "src/lib/auth.config.test.ts — password.hash('password123') startsWith $argon2id$"
        status: pass
    human_judgment: false
  - id: T3
    description: "session.expiresIn = 2592000 (30 дней, D-11), не дефолтные 7"
    verification:
      - kind: unit
        ref: "src/lib/auth.config.test.ts — auth.options.session.expiresIn === 60*60*24*30"
        status: pass
    human_judgment: false
  - id: T4
    description: "Схема (Better Auth + items с userId FK + индекс) применена к живой БД миграциями"
    verification:
      - kind: integration
        ref: "npx drizzle-kit migrate (exit 0, идемпотентно) + npx tsx tests/helpers/assert-schema.ts (user/items присутствуют)"
        status: pass
    human_judgment: false
  - id: T5
    description: "Двухпользовательская изоляция: findItemsForUser(B) пуст, findItemsForUser(A) содержит строку A (AUTH-04 / критерий №4)"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "npx vitest run src/server/repos/items.iso.test.ts — реальная Postgres (DATABASE_URL_TEST), 1/1 green"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-26
status: complete
---

# Phase 1 Plan 02: Бэкенд аутентификации и шов изоляции данных — Summary

**Better Auth настроен под зафиксированные решения (email/password, Argon2id через @node-rs/argon2, явная 30-дневная сессия), схема Better Auth + таблица `items` сгенерирована CLI и применена к живой Postgres миграциями, а шов изоляции userId (`getCurrentUser` -> `findItemsForUser`) доказан двухпользовательским интеграционным тестом против реальной тестовой БД (AUTH-04 / критерий №4).**

## Performance

- **Duration:** ~12 мин (после восстановления node_modules через npm install)
- **Started:** 2026-07-26T17:42:45+03:00 (первый коммит задачи)
- **Completed:** 2026-07-26T17:51+03:00
- **Tasks:** 3 (Task 3 — TDD, два коммита RED->GREEN)
- **Files:** 16 создано, 2 изменено

## Accomplishments
- `src/lib/auth.ts`: `betterAuth()` с `drizzleAdapter(db, { provider: "pg", schema })`, email/password (min 8, без верификации email), кастомные Argon2id `hash`/`verify`, `session.expiresIn = 60*60*24*30`, `nextCookies()` последним; `import "server-only"` первой строкой
- `src/lib/auth-client.ts`: `createAuthClient()` (same-origin) для браузерных потоков
- `src/app/api/auth/[...all]/route.ts`: `toNextJsHandler(auth)` (GET/POST)
- `src/server/db/schema.ts`: канонические таблицы Better Auth (user/session/account/verification + relations) сгенерированы CLI, таблица `items` (id, userId FK -> user.id, title, createdAt) с индексом `items_user_id_idx` сохранена
- Миграции сгенерированы (`drizzle/0000_soft_phantom_reporter.sql`) и применены к живой БД (`drizzle-kit migrate`, идемпотентно); проба `assert-schema.ts` подтверждает наличие таблиц
- Шов изоляции: `getCurrentUser()`/`requireUser()` (userId только из серверной сессии) + `findItemsForUser(userId)` (единственный choke point, `WHERE user_id = ?`)
- Харнесс тестовой БД (`resetDb`/`seedUser`/`seedItem` над `DATABASE_URL_TEST` + миграция тестовой БД) и двухпользовательский тест изоляции — доказано, что B не видит данные A
- Юнит-ассерты конфига: 30-дневная сессия (D-11) и Argon2id-префикс хеша (D-12)

## Task Commits

Каждая задача закоммичена атомарно:

1. **Task 1: Better Auth config + schema + шов изоляции** — `c8a021f` (feat)
2. **Task 2: [BLOCKING] генерация схемы CLI + drizzle-kit generate/migrate** — `c1ae2fb` (feat)
3. **Task 3 (TDD RED): падающие тесты изоляции + конфига** — `3d4661e` (test)
4. **Task 3 (TDD GREEN): харнесс тестовой БД -> тесты зелёные** — `e1185fc` (feat)

_Task 3 (tdd="true") дал два коммита: RED (падение на импорте server-only, харнесс отсутствует) -> GREEN (db.ts + алиас server-only + подмена DATABASE_URL)._

## Verification Evidence
- `npx tsc --noEmit` -> exit 0
- `npx drizzle-kit migrate` -> exit 0 (миграции применены, повтор идемпотентен)
- `npx tsx tests/helpers/assert-schema.ts` -> «таблицы user, items присутствуют» (exit 0)
- `npx vitest run src/server/repos/items.iso.test.ts` -> 1/1 green (AUTH-04)
- `npx vitest run src/lib/auth.config.test.ts` -> 2/2 green (D-11, D-12)
- `npx vitest run` (полный прогон) -> 3 файла / 8 тестов green (без регрессий в Zod-тестах 01-01)

## Decisions Made
- **Генерация через временный файл:** `@better-auth/cli generate --output auth-schema.generated.ts` -> инспекция -> ручной мёрж канонических таблиц в `schema.ts` с сохранением `items` -> удаление временного файла. Прямая запись CLI в `schema.ts` рисковала затереть таблицу `items`.
- **server-only и CLI:** `@better-auth/cli` не может резолвить конфиг с `import "server-only"` (сам CLI это сообщает). Строка временно снята с `auth.ts` и `client.ts` только на время генерации и немедленно восстановлена (в коммитах server-only на месте).
- **Загрузка .env.local:** drizzle-kit/tsx/Vitest не читают `.env.local` (в отличие от Next.js). Единый загрузчик `tests/helpers/load-env.ts` подключён в `drizzle.config.ts` и в setup-файл Vitest.
- **Одна БД для теста изоляции:** сид-хелперы пишут в `DATABASE_URL_TEST`, а `findItemsForUser` читает через `client.ts` (`DATABASE_URL`). Setup-файл Vitest подменяет `DATABASE_URL := DATABASE_URL_TEST`, чтобы обе стороны работали с одной базой.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@better-auth/cli generate` не резолвит конфиг с `import "server-only"`**
- **Found during:** Task 2 (генерация схемы)
- **Issue:** CLI прерывается с сообщением «remove import 'server-only' … temporarily».
- **Fix:** `import "server-only"` временно снят с `auth.ts` и `client.ts`, выполнена генерация, строка сразу восстановлена. В коммитах server-only присутствует.
- **Files:** src/lib/auth.ts, src/server/db/client.ts (итоговое состояние — без изменений относительно Task 1)
- **Committed in:** c1ae2fb

**2. [Rule 3 - Blocking] drizzle-kit / tsx / Vitest не загружают `.env.local`**
- **Found during:** Task 2 (migrate не видел DATABASE_URL)
- **Issue:** переменные окружения из untracked `.env.local` не попадали в процесс инструментов.
- **Fix:** добавлен `tests/helpers/load-env.ts` (парсит `.env.local` без перезаписи реального окружения), подключён в `drizzle.config.ts` и в `tests/helpers/vitest-db-setup.ts`.
- **Files:** tests/helpers/load-env.ts, drizzle.config.ts, tests/helpers/vitest-db-setup.ts
- **Committed in:** c1ae2fb, e1185fc

**3. [Rule 3 - Blocking] `server-only` падает при импорте под Vitest**
- **Found during:** Task 3 (RED падал на server-only)
- **Issue:** серверные модули (`auth.ts`, `client.ts`, repos) нельзя импортировать в тестах напрямую из-за `server-only`.
- **Fix:** алиас `server-only` -> пустая заглушка `tests/helpers/server-only-stub.ts` в `vitest.config.ts`.
- **Files:** tests/helpers/server-only-stub.ts, vitest.config.ts
- **Committed in:** e1185fc

**4. [Rule 3 - Blocking] `assert-schema.ts` создан раньше плана (нужен verify Task 2)**
- **Found during:** Task 2 (verify ссылается на пробу)
- **Issue:** план относит `assert-schema.ts` к файлам Task 3, но verify Task 2 его использует.
- **Fix:** проба создана в рамках Task 2. Первый вариант с `= ANY(sql.array(...))` падал (Postgres 42809) — заменён на `to_regclass('public.<table>')`.
- **Files:** tests/helpers/assert-schema.ts
- **Committed in:** c1ae2fb

**5. [Rule 3 - Infra] Расширены `drizzle.config.ts` и `vitest.config.ts` (владение 01-01)**
- **Issue:** для подключения к БД и запуска интеграционных тестов потребовались env-загрузка и алиас server-only.
- **Fix:** минимальные добавления (import loadEnvLocal; resolve.alias; setupFiles). Существующее поведение (jsdom-тесты 01-01) сохранено — полный прогон зелёный.
- **Committed in:** c1ae2fb, e1185fc

---

**Total deviations:** 5 auto-fixed (все Rule 3, инфраструктурная разблокировка). Ни одной подмены пакетов, ни одного архитектурного изменения. `node_modules` восстановлены `npm install` (пакеты уже были в package.json).

## Known Stubs
- **Нет блокирующих заглушек.** `findItemsForUser` — намеренно read-only шов (D-13); запись (insert/update/delete) по плану реализуется в Фазе 2. Это зафиксированное решение, а не незавершённая функциональность: read-seam достаточно, чтобы тест изоляции AUTH-04 был настоящим (сид строки + проверка невидимости для другого пользователя).

## Next Phase Readiness
- Шов изоляции (`getCurrentUser` -> `findItemsForUser`) и таблица `items` готовы как фундамент CRUD Фазы 2 — write-путь достраивается по паттерну `and(eq(id), eq(userId))`.
- Готово для планов 01-03/01-04: UI-страницы (login/register/list), защита маршрутов серверным `getSession()` в layout `(app)`, шапка + logout — весь серверный бэкенд аутентификации на месте.
- **Регенерация схемы:** после любого изменения auth-конфига (плагин/поле) повторять `@better-auth/cli generate` (снять server-only на время) -> `drizzle-kit generate/migrate`.
- **Тестовая БД:** тесты изоляции требуют `DATABASE_URL_TEST` в `.env.local`; харнесс сам применяет миграции к тестовой БД.

## Self-Check: PASSED

- Все созданные файлы существуют (12 ключевых источников + миграции проверены на диске).
- Все коммиты присутствуют: c8a021f, c1ae2fb, 3d4661e, e1185fc.
- Прогоны: `npx tsc --noEmit` (0), `npx drizzle-kit migrate` (0, идемпотентно), `npx tsx tests/helpers/assert-schema.ts` (0), `npx vitest run` (8/8 green, включая изоляцию AUTH-04, D-11, D-12).

---
*Phase: 01-foundation-auth*
*Completed: 2026-07-26*
