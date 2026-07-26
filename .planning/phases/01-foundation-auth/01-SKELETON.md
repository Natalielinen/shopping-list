# Walking Skeleton — Shopping List с приоритетами

**Phase:** 1 (Фундамент и аутентификация)
**Generated:** 2026-07-26

## Capability Proven End-to-End

> Одно предложение: наименьшая пользовательская возможность, прогоняющая весь стек.

Новый посетитель регистрируется по email и паролю, автоматически входит и попадает на защищённую страницу своего (пустого) списка, отрисованную через слой данных, ограниченный его `userId`. История register → авто-вход → пустой список — это tracer.

**Как user story:** **As a** новый посетитель, **I want to** зарегистрироваться, войти и попасть в свой личный список за авторизацией, **so that** мои покупки изолированы и видны только мне.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 App Router (React 19.2, TS 5, Turbopack) | Зафиксировано в CLAUDE.md; RSC + Server Actions убирают отдельный API-слой |
| Data layer | PostgreSQL 16/17 + Drizzle ORM (0.45) через postgres.js (3.4) | SQL-first, тонкая типизация; схема — источник типов; миграции drizzle-kit — reviewable SQL |
| Auth | Better Auth 1.6 (email/password), Argon2id (@node-rs/argon2, D-12), DB-сессии, 30-дневный `expiresIn` (D-11) | Greenfield-дефолт 2026; встроенный Drizzle-адаптер + `toNextJsHandler`; кастомный hasher под Argon2id |
| Route protection | Серверный `getSession()` guard в `(app)/layout.tsx` | Реальная граница безопасности; middleware/proxy оптимистичен и небезопасен (Next 16 `proxy.ts`) |
| Isolation seam | `getCurrentUser()` (session→userId) + user-scoped repository `findItemsForUser(userId)` | Единственная точка доступа к данным; `userId` только из сессии; фундамент CRUD Фаз 2–5 (AUTH-04) |
| Directory layout | `src/app/(auth)` и `(app)` route-groups; `src/lib` (auth/validation); `src/server/{db,auth,repos}`; `src/components/{auth,app,ui}` | Разделение RSC/сервер/клиент; секреты за `server-only` |
| Testing | Vitest 4 (unit/integration) + RTL 16 (компоненты) + Playwright 1.62 (e2e/auth), выделенная тестовая БД `DATABASE_URL_TEST` | TDD по CLAUDE.md; async RSC покрываются Playwright |
| Deployment target | Локальный full-stack прогон (`npx next dev`) + реальная Postgres | MVP; деплой-таргет не выбирается в Фазе 1 |

## Stack Touched in Phase 1

- [x] Project scaffold (Next 16, build, ESLint, Vitest, Playwright, shadcn/ui)
- [x] Routing — реальные маршруты `/`, `/login`, `/register`, `/list`
- [x] Database — реальное чтение (`findItemsForUser`) и реальная запись (регистрация создаёт user/session; seed вставляет items)
- [x] UI — интерактивные формы register/login (RHF + zodResolver) + logout, связанные с Better Auth
- [x] Deployment — документированный локальный full-stack прогон (`npx next dev` + Postgres), e2e через Playwright webServer

## Out of Scope (Deferred to Later Slices)

> Явно вне скелета — чтобы будущие фазы не переоткрывали минимализм Фазы 1.

- Форма/кнопка добавления покупки, запись items, движок подсчёта очков — Фаза 2 (в Фазе 1 только таблица + read-seam, D-06/D-13)
- Редактирование/удаление покупок — Фаза 3
- Сортировки, фильтры, «купленное», архив, mobile-list — Фаза 4
- Зависимости и блокировка — Фаза 5
- Верификация email, восстановление пароля, 2FA, magic links, rate-limit, отображаемое имя — не в v1 (Deferred Ideas)
- Dark mode, выбор деплой-таргета — вне Фазы 1

## Subsequent Slice Plan

Каждая следующая фаза добавляет один вертикальный срез поверх скелета, не меняя его архитектурных решений:

- Phase 2: Добавление покупки через форму + чистый движок подсчёта очков + badge и разбивка приоритета (пишет в `items` через user-scoped repo)
- Phase 3: Редактирование и удаление своих покупок с пересчётом приоритета
- Phase 4: Mobile-first список — сортировки, фильтры, «купленное» и архив
- Phase 5: Зависимости и блокировка покупок
