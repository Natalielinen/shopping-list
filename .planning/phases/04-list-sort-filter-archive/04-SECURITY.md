---
phase: 04
slug: list-sort-filter-archive
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-09
---

# Phase 04 — Security

> Контракт безопасности фазы: реестр угроз, принятые риски и журнал аудита.
> Фаза 4 добавила новый write-шов `setItemPurchased` (отметка «куплено» → архив), клиентскую сортировку/фильтр над RSC-данными и nullable-миграцию `purchased_at`. Основная поверхность — IDOR/mass-assignment на новом write-шве (как в Фазе 3) и целостность клиентской сортировки. Реестр STRIDE заведён на этапе планирования (11 угроз в 5 планах), проверка ASVS L1.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Клиент → Server Action | Недоверенные аргументы `setItemPurchased(id, purchased)` пересекают границу сервера | `id`, `purchased` (boolean) |
| Server Action → repo/БД | `userId` из серверной сессии (`requireUser()`) — шов изоляции; `purchased_at` пишется только здесь | `userId` (из сессии) + `id` |
| RSC → client (`ListView`) | RSC отдаёт клиенту предвычисленные примитивы; клиентский фильтр/сортировка — производное UI-состояние | Уже изолированные по `userId` строки |
| Приложение → npm/shadcn | Установка `sonner` (примитив тоста) | Исходный код пакета (supply chain) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-4-01 | Elevation/Tampering (IDOR) | `setItemPurchased` / `setItemPurchasedForUser` | high | mitigate | `userId` только из `requireUser()`; UPDATE scoped `and(eq(items.id,id), eq(items.userId,userId))`; чужая → `null` no-op. Якорь: IDOR-тест на реальной Postgres (04-01) | closed |
| T-4-02 | Tampering (mass-assignment владельца) | параметр Server Action / repo | high | mitigate | `userId` — обязательный отдельный параметр из сессии; `id`/`purchased` не влияют на владельца (образец `createItemForUser`) | closed |
| T-4-03 | Tampering (SQL-инъекция через `id`) | `setItemPurchasedForUser` | low | mitigate | Параметризованный Drizzle `.where(eq(...))` — без строковой склейки | closed |
| T-4-04 | Tampering (mass-assignment статуса) | `ItemInsertData` (create/update) | high | mitigate | `purchased_at` — серверно-управляемое поле; исключено из `Omit ItemInsertData` (WR-01); единственный write-путь — `setItemPurchasedForUser` | closed |
| T-4-05 | Tampering (never-trust-client) | `setItemPurchased` input | low | mitigate | `purchased` приводится к строгому boolean (`purchased === true`) в Server Action (V5) | closed |
| T-4-06 | Information Disclosure (IDOR на чтение) | RSC-список | medium | mitigate | Чтение только через `findItemsForUser(userId)`, `userId` из сессии (наследуется, Фаза 1) | closed |
| T-4-07 | Denial of Service (data loss) | миграция `purchased_at` (0002) | medium | mitigate | Nullable без default → чистый `ADD COLUMN`; существующие строки → `NULL` = активны; без миграции данных | closed |
| T-4-08 | Tampering (целостность порядка) | `localeCompare` в `sort.ts` | low | mitigate | Явная локаль `"ru"` + `sensitivity: "base"`; юнит-тест фиксирует порядок. Контроль целостности, не security | closed |
| T-4-09 | Information Disclosure (клиентский фильтр) | секция «Куплено» | low | accept | Рендерит только строки, уже загруженные `findItemsForUser(userId)` (изоляция на серверном шве, Фаза 1); нового read-seam нет — см. Accepted Risks | closed |
| T-4-10 | Tampering (корректность сортировки) | `partitionByPurchased` / `sort.ts` | low | mitigate | Партиция ДО сортировки; архив всегда `sortPurchased` (`purchasedAt` убыв.) независимо от Select; юнит-тесты 04-02 + e2e | closed |
| T-4-SC | Tampering (supply chain) | установка `sonner` | low | accept | Официальный shadcn-компонент; `sonner@2.0.7`, verdict OK (43.9M загрузок/нед, репо `emilkowalski/sonner`, postinstall null) — см. Accepted Risks | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-4-SC | `sonner@2.0.7` — официальный shadcn-компонент (примитив тоста); проверка легитимности OK (43.9M загрузок/нед, репо `emilkowalski/sonner`, postinstall = null). Обёртка упрощена до `theme="light"`, `next-themes` НЕ добавлен. Единственная новая npm-зависимость фазы. | Natalie Chufistova | 2026-08-09 |
| R-04-02 | T-4-09 | Клиентский фильтр «показывать купленные» и секция «Куплено» — производное UI-состояние над уже изолированными по `userId` данными (`findItemsForUser`, Фаза 1). Нового серверного read-seam фильтр не создаёт; раскрытия чужих данных нет. | Natalie Chufistova | 2026-08-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-09 | 11 | 11 | 0 | secure-phase (ASVS L1, реестр авторизован на этапе планирования) |

**Примечание.** Код-ревью фазы (0 критичных) подтвердило ключевые митигции трассировкой по коду: `setItemPurchasedForUser` изолирован по `userId` (T-4-01/02/03), `setItemPurchased` берёт `userId` только из `requireUser()`, приводит `purchased` к строгому boolean (T-4-05) и возвращает `{ ok: false }` при no-op. Предупреждение WR-01 (защита-в-глубину от mass-assignment статуса, T-4-04) исправлено в этой же фазе: `purchased_at` добавлен в `Omit ItemInsertData`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-09
