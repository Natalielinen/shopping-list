---
status: testing
phase: 03-edit-delete-items
source: [03-VERIFICATION.md]
started: 2026-08-02T07:11:02Z
updated: 2026-08-02T07:11:02Z
---

## Current Test

number: 1
name: Длинный title на 375px — badge и иконки видимы, тач-зоны ≥44px, усекается только название
expected: |
  Название усекается многоточием, badge и обе иконки («карандаш»/«корзина») не выталкиваются
  за край и не наезжают друг на друга; тач-зоны ≥44px, тап по иконкам попадает уверенно.
awaiting: user response

## Tests

### 1. Длинный title на 375px — раскладка карточки
expected: На экране 375px открыть /list с покупкой, у которой очень длинное название (60+ символов). Название усекается многоточием (truncate), badge приоритета и обе иконки («карандаш»/«корзина») остаются полностью видимы, тач-зоны ≥44px, усекается только название.
result: [pending]

### 2. Переход на /list/[id]/edit — route-level loading без пустого кадра
expected: Перейти с /list на /list/[id]/edit по иконке «карандаш» на медленном соединении (throttling). Виден промежуточный loading-скелет/состояние (loading.tsx), нет мелькания пустого экрана до готовности предзаполненной формы.
result: [pending]

### 3. Иконка «корзина» — цвет на hover/focus и отсутствие срабатывания Collapsible
expected: На /list навести/сфокусировать иконку «корзина». В покое она нейтральна (text-muted-foreground), на hover/focus становится text-destructive. Отдельно: тап по иконкам edit/delete НЕ раскрывает разбивку очков (Collapsible).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
