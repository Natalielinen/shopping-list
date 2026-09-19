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
- ✓ Пользователь может редактировать и удалять свои покупки с пересчётом приоритета на чтении; правки корректно очищают nullable-поля; update/delete изолированы по userId (ITEM-07, ITEM-08) — Phase 3
- ✓ Mobile-first список: переключаемая сортировка (приоритет/по добавлению/по алфавиту, детерминированные tiebreakers), отметка «куплено» → архив (изолированный по userId write-шов, обратимо) и фильтр «показывать купленные» с секцией «Куплено» (LIST-01..05, LIST-08) — Phase 4
- ✓ Пользователь может сделать одну свою покупку зависящей от другой (одна зависимость, nullable self-FK); зависимая заблокирована (нельзя отметить купленной) серверным guard'ом, пока не куплена зависимость; заблокированные визуально отличаются (замок + подпись «Заблокировано: …» + disabled-чекбокс); защита от циклов на сервере; удаление зависимости авто-разблокирует (FK ON DELETE SET NULL) (ITEM-06, DEP-01, DEP-02) — Phase 5

### Active

<!-- Current scope. Building toward these. -->

- Все требования milestone **v1.0** выполнены (Phases 1–5). Следующий scope — v2 (кандидаты в Out of Scope / backlog).

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
| Одна зависимость на покупку — nullable self-FK `depends_on` ON DELETE SET NULL; блокировка прямая, вычисляется на чтении | Простая модель для v1; удаление зависимости авто-разблокирует без каскада; multi-dep/транзитивная блокировка отложены в v2 (D-01/D-02/D-06) | ✓ Phase 5 — миграция 0003, серверный guard (defense-in-depth) + защита от циклов (`wouldCreateCycle`), IDOR-владение на write-швах; 219 unit + e2e зелёные |

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
*Last updated: 2026-09-19 after Phase 5 (milestone v1.0 complete)*
