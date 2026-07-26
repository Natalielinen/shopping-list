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

(Пока нет — валидируется поставкой)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Пользователь может зарегистрироваться и войти (email/пароль); данные привязаны к пользователю
- [ ] Пользователь может добавить покупку через форму (title обязателен)
- [ ] Пользователь выбирает category, urgency, need, benefit из выпадающих списков (обязательные, дают очки)
- [ ] Пользователь может указать необязательные поля: link, description, price, deadline, doubts, isCredit (+ monthlyPayment), depends
- [ ] Приоритет (total) считается автоматически как простая сумма всех очковых полей
- [ ] Дедлайн даёт очки по формуле `deadlinePoints = 28 − дни_до_дедлайна` (без дедлайна = 0), ограничение [−100, 100]
- [ ] Покупка в кредит (isCredit=true) вычитает 2 очка из приоритета; при isCredit отображается поле monthlyPayment
- [ ] Сомнения (doubts) вычитают очки: нет (0), лёгкие (−1), сильные (−3)
- [ ] Список отображается по умолчанию по убыванию приоритета
- [ ] Фильтры сортировки: по приоритету, по порядку добавления, по алфавиту
- [ ] Пользователь может отметить покупку купленной (completed); купленные уходят в архив
- [ ] Фильтр «показывать купленные» включает архивные покупки в общий список
- [ ] Зависимость покупки (depends): покупка заблокирована, пока не куплен товар, от которого она зависит
- [ ] Пользователь может редактировать и удалять свои покупки

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
| Next.js full-stack (API routes) + PostgreSQL | Один язык (TS), меньше инфраструктуры для mobile-first web | — Pending |
| Мультипользовательский с авторизацией email/пароль | Списками пользуются несколько человек, у каждого свой | — Pending |
| total = простая сумма всех очковых полей | Прозрачность и предсказуемость приоритета | — Pending |
| deadlinePoints = 28 − дни_до_дедлайна, без дедлайна = 0, clamp [−100,100] | Единая формула, совпадает с примером из SUMMARY | — Pending |
| isCredit вычитает −2 очка | Умеренный штраф, сопоставим с «тратит больше чем стоит» | — Pending |
| doubts: 0 / −1 / −3 | Сомнения понижают приоритет пропорционально | — Pending |
| BenefitType по шкале SUMMARY (+1/−1/0/+2/−2) | Подтверждено пользователем | — Pending |
| «Жизненно важно» (urgency) = 20 очков | В SUMMARY очки не заданы; выше «экстра срочности» (10) | — Pending (подтвердить) |
| Шкалы Category/Urgency/Need фиксированы в v1 | Настраиваемость — сложность, отложена в v2 | — Pending |

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
*Last updated: 2026-07-26 after initialization*
