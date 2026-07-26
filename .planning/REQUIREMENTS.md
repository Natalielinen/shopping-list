# Requirements: Shopping List с приоритетами

**Defined:** 2026-07-26
**Core Value:** Пользователь видит покупки автоматически отсортированными по осмысленному приоритету, чтобы понимать, что покупать в первую очередь.

## v1 Requirements

Требования для первого релиза. Каждое маппится на фазы roadmap.

### Authentication & Isolation

- [ ] **AUTH-01**: Пользователь может зарегистрироваться по email и паролю
- [ ] **AUTH-02**: Пользователь может войти, и сессия сохраняется между перезагрузками
- [ ] **AUTH-03**: Пользователь может выйти из аккаунта
- [ ] **AUTH-04**: Каждый пользователь видит только свои покупки (изоляция данных по userId в слое данных)

### Item Management (CRUD)

- [ ] **ITEM-01**: Пользователь может добавить покупку через форму; поле title обязательно
- [ ] **ITEM-02**: Пользователь выбирает обязательные category, urgency, need, benefit из выпадающих списков
- [ ] **ITEM-03**: Пользователь может заполнить необязательные поля: link, description, price, deadline
- [ ] **ITEM-04**: Пользователь может отметить isCredit; при isCredit=true показывается необязательное поле monthlyPayment
- [ ] **ITEM-05**: Пользователь может выставить doubts (по умолчанию — нет сомнений)
- [ ] **ITEM-06**: Пользователь может указать зависимость (depends) от другой своей покупки
- [ ] **ITEM-07**: Пользователь может редактировать свою покупку
- [ ] **ITEM-08**: Пользователь может удалить свою покупку

### Scoring Engine

- [ ] **SCORE-01**: total считается как простая сумма всех очковых полей (category + urgency + need + benefit + deadlinePoints + doubts + штраф за кредит)
- [ ] **SCORE-02**: deadlinePoints = clamp(28 − дни_до_дедлайна, −100, 100); без дедлайна = 0
- [ ] **SCORE-03**: isCredit=true вычитает 2 очка из total
- [ ] **SCORE-04**: doubts вычитает очки: нет (0), лёгкие (−1), сильные (−3)
- [ ] **SCORE-05**: total вычисляется на чтении и отражает текущую дату (не «замораживается» при создании)
- [ ] **SCORE-06**: Шкалы очков category/urgency/need/benefit фиксированы согласно SUMMARY (единый источник)

### List, Sort, Filter & Archive

- [ ] **LIST-01**: Список по умолчанию отсортирован по убыванию приоритета (с детерминированным tiebreaker)
- [ ] **LIST-02**: Пользователь может сортировать по порядку добавления
- [ ] **LIST-03**: Пользователь может сортировать по алфавиту
- [ ] **LIST-04**: Пользователь может отметить покупку купленной (completed); купленные уходят в архив
- [ ] **LIST-05**: Фильтр «показывать купленные» включает архивные покупки в общий список
- [ ] **LIST-06**: Каждая покупка показывает badge с приоритетом (с меткой/цветом, доступно для восприятия)
- [ ] **LIST-07**: Каждая покупка показывает разбивку приоритета (какие поля сколько очков дали)
- [ ] **LIST-08**: Интерфейс адаптивный, mobile-first

### Dependencies / Blocking

- [ ] **DEP-01**: Покупка с зависимостью заблокирована (нельзя отметить купленной), пока не куплен товар, от которого она зависит
- [ ] **DEP-02**: Заблокированные покупки визуально отличаются в списке

## v2 Requirements

Отложено на будущее. Отслеживается, но не входит в текущий roadmap.

### Customization

- **CUST-01**: Пользователь может редактировать шкалы очков (category/urgency/need)
- **CUST-02**: Взвешенная сумма приоритета (веса для полей)

### Collaboration & Notifications

- **COLL-01**: Совместные/общие списки между пользователями
- **NOTF-01**: Уведомления о приближающихся дедлайнах

### Money

- **MONEY-01**: Отслеживание цен / история цен покупок

## Out of Scope

Явно исключено. Задокументировано, чтобы не расползался охват.

| Feature | Reason |
|---------|--------|
| Ручное перетаскивание для смены порядка | Конфликтует с автоматическим приоритетом — порядок меняется только через поля очков |
| Нативное мобильное приложение | Web-first; mobile-first вёрстка покрывает потребность |
| Push-уведомления в v1 | Вне охвата первого релиза |
| Настраиваемые пользователем шкалы в v1 | Сложность; шкалы фиксированы в v1 (кандидат в v2) |

## Traceability

Какие фазы покрывают какие требования. Заполнено при создании roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| ITEM-01 | Phase 2 | Pending |
| ITEM-02 | Phase 2 | Pending |
| ITEM-03 | Phase 2 | Pending |
| ITEM-04 | Phase 2 | Pending |
| ITEM-05 | Phase 2 | Pending |
| SCORE-01 | Phase 2 | Pending |
| SCORE-02 | Phase 2 | Pending |
| SCORE-03 | Phase 2 | Pending |
| SCORE-04 | Phase 2 | Pending |
| SCORE-05 | Phase 2 | Pending |
| SCORE-06 | Phase 2 | Pending |
| LIST-06 | Phase 2 | Pending |
| LIST-07 | Phase 2 | Pending |
| ITEM-07 | Phase 3 | Pending |
| ITEM-08 | Phase 3 | Pending |
| LIST-01 | Phase 4 | Pending |
| LIST-02 | Phase 4 | Pending |
| LIST-03 | Phase 4 | Pending |
| LIST-04 | Phase 4 | Pending |
| LIST-05 | Phase 4 | Pending |
| LIST-08 | Phase 4 | Pending |
| ITEM-06 | Phase 5 | Pending |
| DEP-01 | Phase 5 | Pending |
| DEP-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-26*
*Last updated: 2026-07-26 after roadmap creation (traceability filled)*
