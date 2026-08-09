---
status: complete
phase: 04-list-sort-filter-archive
source: [04-VERIFICATION.md]
started: 2026-08-09T06:43:40Z
updated: 2026-08-09T07:00:56Z
---

## Current Test

[testing complete]

## Tests

### 1. Панель управления на 375px — тач-зоны ≥44px и sticky
expected: На ширине 375px панель ListControls умещает полноширинный Select сортировки + строку фильтра «Показывать купленные»; каждая тач-цель ≥44px; вертикальный стек не ломается; sticky-панель не перекрывает и не просвечивает под первой карточкой при прокрутке.
result: pass

### 2. Карточка на 375px — усечение title и тап по чекбоксу
expected: Длинное название покупки усекается (truncate) и не выталкивает badge приоритета и чекбокс «куплено» (тач-зона ≥44px, слева от названия); тап по чекбоксу отмечает купленной и НЕ раскрывает разбивку очков (Collapsible).
result: issue
reported: "чекбокс слишком большой"
severity: cosmetic

### 3. Undo-тост и приглушение купленной карточки
expected: После отметки купленной undo-тост (bottom-center) не закрывает панель управления сверху; кнопка «Отменить» работает. При включённом фильтре купленная карточка приглушена (opacity-70) И зачёркнута (line-through) — статус читается не только по цвету.
result: pass

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-04-2
  truth: "Чекбокс «куплено» на карточке имеет тач-зону ≥44px, но сам визуальный глиф чекбокса — обычного размера (не 44px-квадрат)"
  status: failed
  reason: "User reported: чекбокс слишком большой"
  severity: cosmetic
  test: 2
  artifacts: []
  missing: []
