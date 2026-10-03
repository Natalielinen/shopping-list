# Phase 1 — External-API Coverage

**Generated:** 2026-07-26
**Detector:** api-coverage (planner mental detector, Phase 1)

No external API integration: Phase 1 wires self-hosted Better Auth + Drizzle + postgres.js against the project's own Postgres; no external service capability surface.

## Rationale

Детектор мог сработать на токенах «SDK»/«integrate»/«adapter» вокруг Better Auth и Drizzle. Это ложное срабатывание: все интегрируемые компоненты Фазы 1 — self-hosted библиотеки, работающие против собственной Postgres проекта:

- **Better Auth** — self-hosted, хранит пользователей/сессии в собственной Postgres через first-party Drizzle-адаптер; никакого удалённого auth-провайдера/SaaS.
- **Drizzle ORM + drizzle-kit** — локальный слой доступа к БД, без сети.
- **postgres.js** — драйвер к собственной Postgres проекта.

Ни один из них не является внешним SaaS с удалённой capability-surface, поэтому матрица покрытия API не составляется.
