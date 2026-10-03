---
phase: 01
slug: foundation-auth
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| dev machine → npm registry | Установка пакетов вводит сторонний код в сборку | Исполняемый код пакетов |
| repo → git | Секреты не должны попасть в историю | `DATABASE_URL`, `BETTER_AUTH_SECRET` |
| client → Better Auth route (`/api/auth/[...all]`) | Недоверенный ввод (email/password) пересекает границу | Учётные данные |
| authenticated request → data layer | Каждый запрос к items несёт `userId` только из серверной сессии | `userId`, содержимое списка |
| server module → client bundle | Секреты и хеширование не должны утечь в клиент | `BETTER_AUTH_SECRET`, хеши, `DATABASE_URL` |
| protected route → server guard | Доступ к `/list` только при валидной серверной сессии | Cookie сессии |
| login error surface → user | Сообщение об ошибке не раскрывает существование аккаунта | Факт наличия email в БД |
| authenticated session → logout | Выход инвалидирует серверную сессию, не только UI | DB-сессия, cookie |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC | Tampering | npm installs (scaffold + deps) | high | mitigate | First-party Approved-пакеты (RESEARCH § Package Legitimacy Audit), pin exact версии, нет посторонних install-скриптов | closed |
| T-01-SECRET | Information Disclosure | `.env.example` / git | high | mitigate | `.env.example` — только плейсхолдеры (подтверждено UAT); `.env*` в `.gitignore` с `!.env.example`; `BETTER_AUTH_SECRET` генерируется пользователем, не коммитится | closed |
| T-01-TESTDB | Information Disclosure | `DATABASE_URL_TEST` | low | accept | Локальная одноразовая тестовая БД, отдельная от prod, синтетические данные (ниже порога `high`, non-blocking) | closed |
| T-02-PWSTORE | Information Disclosure | Хранение пароля (Better Auth) | high | mitigate | Argon2id через кастомный `password.hash`/`verify` (@node-rs/argon2, D-12); нет plaintext; `auth.config.test.ts` проверяет префикс `$argon2id$` (T2 pass) | closed |
| T-02-IDOR | Elevation of Privilege | `findItemsForUser` / items | high | mitigate | Единственный choke point; `userId` из сессии в каждой сигнатуре и `WHERE`; двухпользовательский iso-тест (T5/AUTH-04 pass) | closed |
| T-02-SESSION | Spoofing | Сессия / cookie | high | mitigate | DB-backed сессии Better Auth; httpOnly+secure+sameSite через `nextCookies()`; явный 30-дневный `expiresIn` (T3 pass) | closed |
| T-02-SECRET | Information Disclosure | `BETTER_AUTH_SECRET` / `DATABASE_URL` | high | mitigate | `server-only` на `auth.ts`/`db/client.ts`/repo; секреты unprefixed, из untracked env | closed |
| T-02-FORGE | Tampering | Server actions / route handlers | medium | mitigate | `requireUser()` + Zod-валидация в начале action/handler; `userId` никогда из тела запроса | closed |
| T-02-SC | Tampering | @node-rs/argon2, better-auth installs | low | accept | Все пакеты Approved (RESEARCH § Package Legitimacy Audit), pin exact (ниже порога `high`, non-blocking) | closed |
| T-03-SESSION | Spoofing | Сессия / httpOnly cookie | high | mitigate | Серверный `getSession()` guard в `(app)/layout.tsx` (граница безопасности, не middleware); httpOnly cookie через `nextCookies` (Threat Flags 03) | closed |
| T-03-SECRETLEAK | Information Disclosure | Клиентский бандл | high | mitigate | Страницы/layout остаются RSC; интерактивность в leaf `'use client'`; `server-only` на auth/db; секреты unprefixed (Threat Flags 03) | closed |
| T-03-CSRF | Tampering | Auth-эндпоинты | medium | mitigate | Встроенная CSRF/cookie-защита Better Auth; same-origin `authClient` (Threat Flags 03) | closed |
| T-03-OPTIMISTIC | Elevation of Privilege | Защита маршрутов | medium | mitigate | Реальная серверная валидация сессии, без опоры на оптимистичную проверку cookie в proxy/middleware (Threat Flags 03) | closed |
| T-04-ENUM | Information Disclosure | Ошибка входа | high | mitigate | Обобщённое «Неверный email или пароль» через `mapAuthError`; логин не различает несуществующий аккаунт и неверный пароль (Threat Flags 04) | closed |
| T-04-LOGOUT | Spoofing | Инвалидация сессии | high | mitigate | `authClient.signOut()` очищает серверную DB-сессию и cookie; e2e: после выхода `/list` → `/login` (Threat Flags 04, D-09) | closed |
| T-04-IDOR-E2E | Elevation of Privilege | Список за авторизацией | high | mitigate | Браузерный тест изоляции: B не видит данные A; дополняет интеграционный якорь плана 02 (Threat Flags 04, AUTH-04) | closed |
| T-04-ERRLEAK | Information Disclosure | Server error → UI | medium | mitigate | Сетевые/серверные ошибки маплятся на общий текст; verbose-детали БД не доходят до клиента (Threat Flags 04) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-01-TESTDB | Локальная одноразовая тестовая БД, изолирована от prod, только синтетические данные; severity low (ниже порога high) | Natalie Chufistova | 2026-08-01 |
| R-02 | T-02-SC | Все install-пакеты Approved в RESEARCH § Package Legitimacy Audit, версии pin exact; severity low (ниже порога high) | Natalie Chufistova | 2026-08-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 17 | 17 | 0 | gsd-secure-phase (L1 grep-depth, short-circuit: register authored at plan time, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-01
