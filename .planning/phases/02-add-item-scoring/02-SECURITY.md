---
phase: 2
slug: add-item-scoring
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 2 — Security

> Контракт безопасности фазы: реестр угроз, принятые риски, аудит-трейл. ASVS L1, порог блокировки — `high`. Реестр авторизован на этапе планирования (`<threat_model>` в каждом PLAN.md); проверка митигаций — grep-глубина L1 против реального кода.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Клиент (форма) → Server Action | Недоверенный payload формы пересекает границу; сервер обязан ре-валидировать и брать `userId` из сессии | Поля покупки (title/enum/числа/дата) |
| Неаутентифицированный вызов → Server Action | `createItem` может быть вызван без сессии | — |
| Пользователь A → данные пользователя B | Изоляция списков по `userId` в слое данных (AUTH-04) | Строки таблицы `items` |
| Внешний пакет / реестр → сборка | `npm install date-fns`, `npx shadcn add` вносят сторонний код | Исходники / зависимости |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-2-01 | Tampering / Elevation | `createItem` / `createItemForUser` (mass-assignment) | high | mitigate | `userId` только из `requireUser()`; в insert идут только `parsed.data`; `total`/`deadlinePoints`/`id` не принимаются (нет колонок / генерируются). Подтверждено: нет чтения `userId` из payload | closed |
| T-2-02 | Elevation of Privilege (IDOR) | write в чужой список | high | mitigate | Каждый запрос scoping по `userId` (AUTH-04); интеграционный тест write-изоляции на реальной Postgres (`items.iso.test.ts`) зелёный | closed |
| T-2-03 | Spoofing | неаутентифицированный вызов `createItem` | high | mitigate | `requireUser()` бросает до любой записи при отсутствии сессии | closed |
| T-2-04 | Tampering | серверная ре-валидация входа (`itemInputSchema`) | high | mitigate | `itemInputSchema.safeParse(input)` в Server Action (never-trust-client V5), несмотря на клиентский RHF; enum-whitelist, `nonnegative`, `z.url`, ≤2 знака | closed |
| T-2-05 | Tampering (XSS) | рендер title / description / link / строк разбивки | medium | mitigate | React экранирует по умолчанию; `link` валидируется `z.url`; нет `dangerouslySetInnerHTML` во всём `src/` | closed |
| T-2-05b | Tampering | `deadlinePoints` при просрочке | medium | mitigate | Спец-случай `days < 0 → 100` ДО clamp (`scoring.ts:69`); юнит-тесты крайних случаев (D-04) исключают «растущее» значение | closed |
| T-2-06 | Tampering | отрицательные / мусорные `price` / `monthlyPayment` | medium | mitigate | Zod `nonnegative` + `finite` + ≤2 знака + верхняя граница под int4; рубли→копейки `Math.round(×100)` ровно один раз на сервере (BL-01, без double-transform) | closed |
| T-2-10 | Tampering (SQLi) | Drizzle параметризация | medium | mitigate | Вставка через Drizzle `.values()` — параметризована, строки не конкатенируются | closed |
| T-2-SC-npm | Tampering (supply-chain) | `npm install date-fns@4` | high | mitigate | Пакет проверен в RESEARCH §Package Legitimacy Audit — verdict OK (95M/нед, официальный repo, `postinstall: null`); закреплён в `.claude/CLAUDE.md` | closed |
| T-2-SC-shadcn | Tampering (supply-chain) | `npx shadcn add` | medium | accept | Только официальный реестр shadcn (`components.json` → `registries: {}`); copy-in код, не npm-пакет — vetting неприменим | closed |
| T-2-07 | Information Disclosure | `ScoreBreakdown` | low | accept | Разбивка показывает только данные покупки текущего пользователя (карточка уже отфильтрована `findItemsForUser` по `userId`); чужие данные недостижимы на уровне RSC-родителя | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-2-01 | T-2-SC-shadcn | Официальный реестр shadcn; copy-in код (не npm-пакет), `registries: {}` пуст — vetting сторонних реестров неприменим | Пользователь (default policy) | 2026-08-01 |
| AR-2-02 | T-2-07 | Разбивка выводит только покупки текущего пользователя (RSC-родитель уже отфильтрован по `userId`); утечка кросс-юзер невозможна | Пользователь (default policy) | 2026-08-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 11 | 11 | 0 | gsd-secure-phase (ASVS L1, from artifacts, grep-depth) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-01
