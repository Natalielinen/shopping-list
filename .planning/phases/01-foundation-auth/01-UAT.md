---
status: testing
phase: 01-foundation-auth
source: [01-VERIFICATION.md]
started: 2026-07-26T15:46:00Z
updated: 2026-07-26T15:46:00Z
---

## Current Test

number: 1
name: Обрезка длинного email в шапке (visual backstop)
expected: |
  На защищённой странице (например `/list`) в шапке (`AppHeader`) очень длинный
  email пользователя обрезается многоточием (`…`) и НЕ ломает вёрстку шапки —
  кнопка «Выйти» остаётся видимой и кликабельной, горизонтального переполнения нет
  (проверять в mobile-ширине, ~375px). Классы `min-w-0 truncate` + `shrink-0` уже
  на месте — нужно подтвердить рендер глазами.
awaiting: user response

## Tests

### 1. Обрезка длинного email в шапке (visual backstop)
expected: На `/list` длинный email в `AppHeader` обрезается многоточием, шапка не переполняется, кнопка «Выйти» видна и кликабельна на мобильной ширине (~375px).
result: [pending]

### 2. Содержимое `.env.example`
expected: |
  Закоммиченный шаблон `.env.example` содержит ТОЛЬКО плейсхолдеры (без реальных
  секретов) для ключей `DATABASE_URL`, `DATABASE_URL_TEST`, `BETTER_AUTH_SECRET`
  (и любых прочих переменных окружения фазы). Реальные значения живут только в
  gitignored `.env.local`. Верификатор не смог прочитать `.env.example`
  (permission-deny на `.env*`) — нужно подтвердить содержимое глазами.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
