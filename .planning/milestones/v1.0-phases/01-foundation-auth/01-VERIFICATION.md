---
phase: 01-foundation-auth
verified: 2026-07-26T15:45:00Z
status: passed
score: 12/13 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "Длинный email в шапке обрезается ellipsis в одну строку и не выталкивает кнопку «Выйти» за экран (UI-SPEC backstop)"
    test: "Зарегистрироваться с очень длинным email (например, verylongemailaddress-1234567890@example-domain.com), открыть /list на мобильной ширине (~360px)"
    expected: "Email обрезается с многоточием в одну строку; шапка не переносится; кнопка «Выйти» остаётся видимой и кликабельной"
    why_human: "Свойство отрендеренного layout (overflow/ellipsis) — grep видит корректные классы min-w-0/truncate/shrink-0, но не может подтвердить визуальный результат при реальном переполнении"
human_verification:

  - test: "Зарегистрироваться с очень длинным email и открыть /list на мобильной ширине (~360px)"
    expected: "Email обрезается многоточием в одну строку; шапка не ломается; кнопка «Выйти» видима и доступна (touch target ≥44px)"
    why_human: "Визуальное свойство переполнения — программно не проверяется"

  - test: "Открыть .env.example и убедиться, что он содержит только имена ключей и комментарии-инструкции, без реальных значений DATABASE_URL / BETTER_AUTH_SECRET"
    expected: "Только плейсхолдеры/инструкции; реальные секреты отсутствуют"
    why_human: "Файл .env.example недоступен для чтения верификатором (permission-deny на .env*); git подтверждает, что реальные секреты в .env.local не закоммичены (только .env.example под контролем версий), но содержимое самого .env.example проверить программно не удалось"
---

# Phase 1: Фундамент и аутентификация — отчёт о верификации

**Phase Goal:** Пользователь может зарегистрироваться, войти, выйти и попасть в свой личный список; заложен каркас приложения и граница изоляции данных по пользователю в слое данных.
**Verified:** 2026-07-26T15:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Все четыре критерия успеха роадмапа (AUTH-01..04) подтверждены поведенчески — верификатор лично прогнал обе тест-обвязки на этом дереве:

- `npx vitest run` → **25/25 passed** (включая интеграционный тест изоляции двух пользователей против реальной Postgres).
- `npx playwright test` → **7/7 passed** (register авто-вход, login + персистентность через reload, root/protected редиректы, logout, браузерная изоляция).

Единственный оставшийся пункт — косметический visual backstop (ellipsis email в шапке), который нельзя доказать программно, и недоступный для чтения `.env.example`. Оба уведены в человеческую проверку. Цель фазы фактически достигнута.

### Observable Truths

| #   | Truth (источник) | Status | Evidence |
| --- | ---------------- | ------ | -------- |
| 1 | SC1 / AUTH-01: регистрация → авто-вход → защищённый пустой список | ✓ VERIFIED | `e2e/auth/register.spec.ts` прогнан зелёным (URL `/list`, «Список пуст», email в шапке); путь форма→authClient→Better Auth→сессия→guard→findItemsForUser |
| 2 | SC2 / AUTH-02: вход сохраняет сессию между перезагрузками; неавторизованный /list → /login | ✓ VERIFIED | `login.spec.ts` (reload остаётся на /list), `protected-redirect.spec.ts`, `root-redirect.spec.ts` — все зелёные |
| 3 | SC3 / AUTH-03: выход с защищённой страницы очищает сессию, возврат в неавторизованное состояние | ✓ VERIFIED | `logout.spec.ts` зелёный: клик «Выйти» → /login, повторный /list снова → /login (серверная сессия инвалидирована) |
| 4 | SC4 / AUTH-04: изоляция данных в СЛОЕ ДАННЫХ, ограниченном userId | ✓ VERIFIED | `items.iso.test.ts` (integration, реальная Postgres, зелёный): B получает `[]`, A видит свою строку; `findItemsForUser` = `db.select().from(items).where(eq(items.userId, userId))`; плюс браузерный `isolation.spec.ts` зелёный |
| 5 | D-12: пароли хешируются Argon2id (не scrypt) | ✓ VERIFIED | `auth.config.test.ts` зелёный: `password.hash("...")` → префикс `$argon2id$`; `auth.ts` использует `@node-rs/argon2` |
| 6 | D-11: срок жизни сессии задан явно 30 дней | ✓ VERIFIED | `auth.config.test.ts`: `session.expiresIn === 2592000`; `auth.ts` line 36 |
| 7 | Секреты не попадают в клиентский бандл (server-only границы) | ✓ VERIFIED | grep: ни один `'use client'`-компонент не импортирует server-only модули; `BETTER_AUTH_SECRET`/`DATABASE_URL` только в `auth.ts`/`db/client.ts` (оба `import "server-only"`); нет `NEXT_PUBLIC` на секретах |
| 8 | Ошибка входа устойчива к account-enumeration | ✓ VERIFIED | `auth-errors.test.ts` зелёный: несуществующий email и неверный пароль дают ОДНУ строку «Неверный email или пароль» |
| 9 | userId берётся только из серверной сессии, никогда из тела/query/params | ✓ VERIFIED | `getCurrentUser` = `auth.api.getSession({ headers })`; `findItemsForUser(userId)` требует userId параметром; вызывающий код (`list/page.tsx`) берёт `user.id` из сессии |
| 10 | Empty-state D-06: «Список пуст» / «Скоро здесь можно будет добавлять покупки.» без формы добавления | ✓ VERIFIED | `list/page.tsx` рендерит точные тексты; `empty-list.spec.ts` зелёный; формы добавления нет |
| 11 | Общий Zod-контракт валидации (client+server), тексты ошибок из UI-SPEC | ✓ VERIFIED | `validation/auth.test.ts` зелёный; формы используют `zodResolver(registerSchema/loginSchema)`; component-тесты форм показывают «Пароль должен содержать минимум 8 символов» / «Введите корректный email» / «Заполните это поле» |
| 12 | Схема: таблица `items` с `userId` FK → user.id и индексом | ✓ VERIFIED | `schema.ts` + миграция `0000_*.sql`: `items_user_id_user_id_fk` FK, `items_user_id_idx` INDEX |
| 13 | Длинный email в шапке обрезается ellipsis, не выталкивает «Выйти» (UI-SPEC backstop, `verification: backstop`) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `AppHeader.tsx`: `min-w-0 truncate` на email + `shrink-0` на кнопке — идиоматически корректно, но рендер-визуал не покрыт тестом → человеческая проверка |

**Score:** 12/13 truths verified (1 present, behavior-unverified — визуальный backstop)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/auth.ts` | betterAuth: drizzleAdapter, Argon2id, 30д сессия, nextCookies последним | ✓ VERIFIED | Все элементы присутствуют; `import "server-only"` первой строкой |
| `src/lib/auth-client.ts` | createAuthClient() same-origin | ✓ VERIFIED | Экспортирует `authClient` |
| `src/app/api/auth/[...all]/route.ts` | toNextJsHandler(auth) GET/POST | ✓ VERIFIED | Экспортирует `GET`, `POST` |
| `src/server/db/schema.ts` | Better Auth таблицы + items(userId FK, indexed) | ✓ VERIFIED | user/session/account/verification + items с FK+index |
| `src/server/auth/current-user.ts` | getCurrentUser/requireUser из сессии | ✓ VERIFIED | server-only; сессия из headers |
| `src/server/repos/items.ts` | findItemsForUser(userId) — единственный шов | ✓ VERIFIED | server-only; WHERE eq(items.userId, userId) |
| `src/server/repos/items.iso.test.ts` | двухпользовательский тест изоляции | ✓ VERIFIED | реальная Postgres; B получает `[]`; прогнан зелёным |
| `src/server/db/client.ts` | Drizzle over postgres.js, server-only | ✓ VERIFIED | server-only; postgres(process.env.DATABASE_URL) |
| `src/components/auth/LoginForm.tsx` / `RegisterForm.tsx` | 'use client' RHF+zodResolver+authClient | ✓ VERIFIED | оба корректны; mapAuthError подключён |
| `src/components/app/LogoutButton.tsx` / `AppHeader.tsx` | logout control + шапка | ✓ VERIFIED | signOut→/login; AppHeader рендерит LogoutButton |
| `src/lib/auth-errors.ts` | mapAuthError → тексты UI-SPEC | ✓ VERIFIED | enumeration-guard в login-ветке |
| `drizzle/` | сгенерированные+применённые миграции | ✓ VERIFIED | `0000_soft_phantom_reporter.sql` + `_journal.json`; migrate прогнан |
| e2e specs (7 шт.) | покрытие критериев 1–4 | ✓ VERIFIED | все 7 зелёные при прогоне верификатором |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `auth.ts` | `db/client.ts` | `drizzleAdapter(db, { provider: "pg" })` | ✓ WIRED |
| `repos/items.ts` | `db/schema.ts` | `eq(items.userId, userId)` | ✓ WIRED |
| `current-user.ts` | `auth.ts` | `auth.api.getSession({ headers })` | ✓ WIRED |
| `RegisterForm.tsx` | `auth-client.ts` | `authClient.signUp.email` → `router.push('/list')` | ✓ WIRED |
| `(app)/layout.tsx` | `auth.ts` | `getSession` → `redirect('/login')` при null | ✓ WIRED |
| `(app)/list/page.tsx` | `repos/items.ts` | `findItemsForUser(user.id)` | ✓ WIRED |
| `LoginForm.tsx` | `auth-errors.ts` | `mapAuthError(error, "login")` в Alert | ✓ WIRED |
| `AppHeader.tsx` | `LogoutButton.tsx` | рендер в шапке | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `list/page.tsx` | `items` | `findItemsForUser(user.id)` → реальный `db.select().from(items).where(...)` | Да (реальный запрос к Postgres; в Фазе 1 записей нет по дизайну D-06 → пустой стейт) | ✓ FLOWING |
| `AppHeader.tsx` | `email` | `session.user.email` из серверной сессии | Да (e2e подтверждает отображение email) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Полный unit/integration прогон | `npx vitest run` | 25/25 passed | ✓ PASS |
| Полный e2e прогон | `npx playwright test` | 7/7 passed | ✓ PASS |
| Изоляция B не видит данные A (integration) | часть vitest | зелёный | ✓ PASS |
| Argon2id префикс хеша | `auth.config.test.ts` | `$argon2id$` подтверждён | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AUTH-01 | 01-01, 01-03 | Регистрация по email/паролю | ✓ SATISFIED | `register.spec.ts` зелёный; auto-signIn (D-04) |
| AUTH-02 | 01-03 | Вход + персистентность сессии | ✓ SATISFIED | `login.spec.ts` зелёный (reload остаётся на /list) |
| AUTH-03 | 01-04 | Выход из аккаунта | ✓ SATISFIED | `logout.spec.ts` зелёный |
| AUTH-04 | 01-02, 01-04 | Изоляция данных по userId в слое данных | ✓ SATISFIED | `items.iso.test.ts` (integration) + `isolation.spec.ts` (e2e) зелёные; шов `findItemsForUser` |

Все четыре заявленных ID (AUTH-01..04) покрыты и подтверждены. REQUIREMENTS.md маппит на Phase 1 ровно AUTH-01..04 — orphaned требований нет.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Debt-маркеры (TODO/FIXME/XXX/HACK) отсутствуют в src/tests/e2e | — | Совпадения `placeholder` — это HTML-атрибут input и CSS-класс `placeholder:`, не стабы |

Стабов не найдено: `list/page.tsx` рендерит реальные данные из шва; формы вызывают реальный `authClient`; пустой массив items в Фазе 1 — намеренный дизайн (D-06), а не hollow-stub.

### Prohibitions

| Prohibition | Verification | Status |
| ----------- | ------------ | ------ |
| userId НЕ из тела/query/params запроса | judgment | ✓ VERIFIED — только из серверной сессии |
| Секреты НЕ в клиентском бандле | judgment | ✓ VERIFIED — server-only границы, нет NEXT_PUBLIC |
| Ошибка входа НЕ раскрывает существование аккаунта | test | ✓ VERIFIED — `auth-errors.test.ts` |
| Страницы/layout НЕ 'use client' ради интерактивности | judgment | ✓ VERIFIED — интерактивность только в leaf-формах |
| Реальные секреты НЕ в .env.example | judgment | ? UNCERTAIN — файл недоступен для чтения (permission-deny на .env*); git подтверждает: только `.env.example` под версионированием, `.env.local`/`.env` gitignored и не закоммичены → утечка секретов в git через env-файл disproven; содержимое самого .env.example проверить не удалось (уведено в человеческую проверку) |

### Human Verification Required

1. **Ellipsis длинного email в шапке (visual backstop)** — зарегистрироваться с очень длинным email, открыть /list на ~360px. Ожидается: email обрезается многоточием в одну строку, шапка не ломается, кнопка «Выйти» видима и доступна. Причина: рендер-визуал переполнения программно не проверяется (классы `min-w-0 truncate shrink-0` присутствуют и корректны).
2. **Содержимое .env.example** — открыть файл и убедиться, что там только имена ключей и комментарии, без реальных значений. Причина: файл недоступен верификатору из-за permission-deny; git-часть (реальные секреты не закоммичены) уже подтверждена.

### Gaps Summary

Гэпов, блокирующих цель фазы, нет. Все 4 критерия успеха (AUTH-01..04) подтверждены поведенчески верификатором через личный прогон vitest (25/25) и Playwright (7/7). Архитектурный шов изоляции реализован именно в слое данных (`findItemsForUser` с `WHERE user_id = ?`), userId берётся только из серверной сессии, секреты за server-only границами, ошибка входа устойчива к enumeration. Статус `human_needed` вызван двумя незначительными пунктами, которые нельзя закрыть программно: (1) визуальный backstop обрезки email и (2) недоступное для чтения содержимое `.env.example`. Ни один из них не затрагивает достижение цели фазы.

Известный не-блокирующий пункт: Better Auth логирует «Base URL is not set» (BETTER_AUTH_URL отложен на будущую фазу) — все потоки работают, гэпом не считается.

---

_Verified: 2026-07-26T15:45:00Z_
_Verifier: Claude (gsd-verifier)_
