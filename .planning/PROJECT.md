# Shopping List с приоритетами

## What This Is

Web-приложение (mobile-first) для составления списка покупок, где каждая покупка получает числовой приоритет. Приоритет считается автоматически из выборов пользователя (категория, срочность, необходимость, выгода, дедлайн, сомнения, кредит). Список по умолчанию сортируется от большего приоритета к меньшему, с пользовательскими фильтрами. Мультипользовательское: у каждого свой список за авторизацией.

## Core Value

Пользователь видит свои покупки автоматически отсортированными по осмысленному приоритету, чтобы понимать, что покупать в первую очередь.

## Business Context

<!-- Не монетизируется. Личный/семейный инструмент. -->

- **Customer**: Частные пользователи, ведущие список покупок
- **Success metric**: Пользователь регулярно возвращается и доверяет порядку списка

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Пользователь может зарегистрироваться, войти и выйти (email/пароль); данные изолированы по пользователю (AUTH-01..04) — Phase 1
- ✓ Пользователь может добавить покупку через форму (title обязателен) с обязательными category/urgency/need/benefit и необязательными link/description/price/deadline/doubts/isCredit (+ условный monthlyPayment) (ITEM-01..05) — Phase 2
- ✓ Приоритет (total) считается автоматически на чтении с текущей датой: сумма очковых полей, deadlinePoints (просрочка = фикс +100), isCredit −2, doubts 0/−1/−3, фиксированные шкалы SUMMARY (SCORE-01..06) — Phase 2
- ✓ Каждая покупка показывает доступный badge приоритета (4 избыточных канала) и раскрываемую по тапу разбивку очков; список отсортирован по убыванию приоритета (LIST-06, LIST-07) — Phase 2

### Active

<!-- Current scope. Building toward these. -->

- [ ] Пользователь может редактировать и удалять свои покупки (с пересчётом приоритета) — Phase 3
- [ ] Фильтры сортировки: по порядку добавления, по алфавиту (детерминированный tiebreaker) — Phase 4
- [ ] Пользователь может отметить покупку купленной (completed); купленные уходят в архив — Phase 4
- [ ] Фильтр «показывать купленные» включает архивные покупки в общий список — Phase 4
- [ ] Зависимость покупки (depends): указание зависимости и блокировка, пока не куплен товар, от которого она зависит — Phase 5

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Настраиваемые пользователем шкалы очков (category/urgency/need редактируемые) — сложность, шкалы фиксированы в v1; кандидат в v2
- Веса для полей приоритета (взвешенная сумма) — начинаем с простой суммы для прозрачности
- Совместные/общие списки между пользователями — не нужно для первой версии
- Нативное мобильное приложение — web-first, mobile-first вёрстка покрывает потребность
- Push-уведомления о дедлайнах — вне охвата v1

## Context

- Разработка ведётся по TDD (тесты пишутся до/вместе с кодом)
- Mobile-first: интерфейс проектируется сначала под телефон
- Схема покупки (item) детально описана в исходном `SUMMARY.md` в корне проекта — источник истины по полям и очкам
- Шкалы Category / Urgency / Need / Benefit приняты как есть из SUMMARY

## Constraints

- **Tech stack (frontend)**: Next.js + TypeScript — mobile-first web, единый язык со всем стеком
- **Tech stack (backend)**: Next.js API routes + PostgreSQL — без отдельного сервера, меньше движущихся частей
- **Auth**: Мультипользовательский вход по email/паролю — данные изолированы по пользователю
- **Methodology**: TDD — покрытие тестами обязательно
- **Design**: Mobile-first — приоритет мобильной вёрстки

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js full-stack (API routes) + PostgreSQL | Один язык (TS), меньше инфраструктуры для mobile-first web | ✓ Phase 1/2 — Next.js 16 App Router + RSC + Server Actions, Drizzle + Postgres |
| Мультипользовательский с авторизацией email/пароль | Списками пользуются несколько человек, у каждого свой | ✓ Phase 1 — Better Auth (Argon2id, DB-сессии 30 дней), шов изоляции userId доказан двухпользовательским тестом (AUTH-04) |
| total = простая сумма всех очковых полей | Прозрачность и предсказуемость приоритета | ✓ Phase 2 — чистый движок, вычисление на чтении с инъекцией `now` (SCORE-05) |
| deadlinePoints = 28 − дни_до_дедлайна, без дедлайна = 0, clamp [−100,100] | Единая формула, совпадает с примером из SUMMARY | ✓ Phase 2 — + спец-случай D-04: любая просрочка (дни < 0) = фикс +100 ДО clamp |
| isCredit вычитает −2 очка | Умеренный штраф, сопоставим с «тратит больше чем стоит» | ✓ Phase 2 |
| doubts: 0 / −1 / −3 | Сомнения понижают приоритет пропорционально | ✓ Phase 2 |
| BenefitType по шкале SUMMARY (+1/−1/0/+2/−2) | Подтверждено пользователем | ✓ Phase 2 |
| «Жизненно важно» (urgency) = 12 очков | В SUMMARY очки не заданы; выше «экстра срочности» (10) — принято на discuss-phase (D-03) | ✓ Phase 2 |
| Шкалы Category/Urgency/Need/Benefit фиксированы в v1 | Настраиваемость — сложность, отложена в v2 | ✓ Phase 2 — exhaustive Record-шкалы по SUMMARY |
| price/monthlyPayment хранятся в integer-копейках | Точные деньги без float-погрешностей; перевод рубли→копейки `Math.round(×100)` один раз на сервере (BL-01) | ✓ Phase 2 |
| Форма на отдельной странице `/list/new`; Server Action возвращает `{ok}` + клиентский `router.push` | Полноэкранная mobile-first форма (D-06); избегаем NEXT_REDIRECT-ловушки redirect() внутри action | ✓ Phase 2 |
| Пороги badge приоритета: total ≥30 Высокий / 10–30 Средний / <10 Низкий | Обоснованы фактическими шкалами SUMMARY; уровень кодируется не только цветом (D-10, LIST-06) | ✓ Phase 2 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-01 after Phase 2*
