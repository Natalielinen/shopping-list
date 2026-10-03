---
phase: 05-dependencies-blocking
plan: 04
subsystem: api
tags: [nextjs, server-actions, drizzle, vitest, dependencies, security, defense-in-depth]

# Dependency graph
requires:
  - phase: 05-01
    provides: "чистое ядро deps — isBlocked (blocked.ts)"
  - phase: 05-02
    provides: "self-FK depends_on (миграция 0003), ItemInsertData.dependsOn"
  - phase: 05-03
    provides: "производная блокировка в списке (Lock + disabled-чекбокс), PurchaseCheckbox с пропами blocked/dependencyTitle, авто-разблокировка на router.refresh()"
  - phase: 04
    provides: "setItemPurchased (Server Action), SetPurchasedResult, findItemForUser (userId-scoped), PurchaseCheckbox + toast (sonner)"
provides:
  - "Серверный guard блокировки в setItemPurchased (D-03, defense-in-depth): отметка «куплено» заблокированной покупки отклоняется на сервере до записи { ok:false, error: BLOCKED_ERROR }"
  - "Проброс серверного текста ошибки в тост (toast.error(res.error)) — обойдённый disabled-UI объясняет причину"
  - "Action-уровневый интеграционный тест guard'а на реальной PG (actions.guard.test.ts)"
affects: [dependencies-blocking, list, security]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Серверный guard в Server Action как авторитетный backstop к disabled-UI (never-trust-client): findItemForUser(userId-scoped) покупки и зависимости → чистый isBlocked → { ok:false } ДО записи; blocked нигде не хранится"
    - "Guard применяется ТОЛЬКО при next === true; снятие «куплено» (next === false) всегда без guard — обратимость сохранена"
    - "Серверный текст ошибки как источник истины для тоста: PurchaseCheckbox показывает res.error (не локальную константу), чтобы обойдённый disabled объяснил причину"

key-files:
  created:
    - src/app/(app)/list/actions.guard.test.ts
  modified:
    - src/app/(app)/list/actions.ts
    - src/components/items/PurchaseCheckbox.tsx
    - vitest.config.ts

key-decisions:
  - "BLOCKED_ERROR как серверная константа (дословно из UI-SPEC §Copywriting), возвращается в SetPurchasedResult.error — тип не расширялся (уже { ok:false; error:string })"
  - "STATUS_ERROR оставлен фолбэком в PurchaseCheckbox на случай пустого res.error, хотя guard всегда заполняет error"
  - "fileParallelism: false в vitest.config.ts — оба DB-интеграционных файла (actions.guard.test.ts, items.iso.test.ts) делят одну тестовую PG и не могут гонять параллельно (Rule 3)"

patterns-established:
  - "Defense-in-depth для UI-блокировок: клиентский disabled + серверный guard в том же Server Action, доказанный action-уровневым интеграционным тестом на реальной PG"
  - "Мок requireUser через mutable-holder (устанавливается после seedUser) при интеграционном тесте Server Action на реальном слое данных"

requirements-completed: [DEP-01, DEP-02]

coverage:
  - id: D1
    description: "setItemPurchased(B, true) при B.dependsOn=A и не купленной A → { ok:false, error: BLOCKED_ERROR }; статус B не меняется (D-03 / T-05-02, Tampering-обход disabled-чекбокса отклонён на сервере до записи)"
    requirement: "DEP-01"
    verification:
      - kind: integration
        ref: "src/app/(app)/list/actions.guard.test.ts (отметка заблокированной → { ok:false })"
        status: pass
    human_judgment: false
  - id: D2
    description: "Авто-разблокировка на сервере: setItemPurchased(B, true) после покупки A → { ok:true }; отметка покупки без dependsOn → { ok:true } (guard не срабатывает)"
    requirement: "DEP-01"
    verification:
      - kind: integration
        ref: "src/app/(app)/list/actions.guard.test.ts (после покупки зависимости → { ok:true }; без зависимости → { ok:true })"
        status: pass
    human_judgment: false
  - id: D3
    description: "Guard применяется только при next === true: setItemPurchased(B, false) при заблокированной B → { ok:true } (снятие «куплено» всегда разрешено, обратимость сохранена)"
    requirement: "DEP-01"
    verification:
      - kind: integration
        ref: "src/app/(app)/list/actions.guard.test.ts (снятие заблокированной → { ok:true })"
        status: pass
    human_judgment: false
  - id: D4
    description: "Guard использует findItemForUser (userId-scoped) для покупки и её зависимости — чужую покупку/зависимость прочитать нельзя (T-05-01, IDOR V4); userId только из requireUser()"
    requirement: "DEP-01"
    verification:
      - kind: integration
        ref: "src/app/(app)/list/actions.guard.test.ts (реальная PG, requireUser → засеянный пользователь, все чтения userId-scoped)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PurchaseCheckbox при !res.ok показывает toast.error(res.error) — серверный текст guard-отклонения объясняет причину обойдённого disabled-UI (S3 error)"
    requirement: "DEP-02"
    verification:
      - kind: integration
        ref: "src/app/(app)/list/actions.guard.test.ts (сервер возвращает BLOCKED_ERROR в error); проводка toast.error(res.error) реализована и типизирована"
        status: pass
    human_judgment: false
  - id: D6
    description: "Визуальные бэкстопы на 375px: строка «Заблокировано: {длинное название}» усекается (min-w-0 truncate), иконка Lock видима, ряд заголовка не ломается; длинная опция Select зависимости умещается; карточка НЕ приглушена; авто-разблокировка после покупки зависимости; ошибка цикла в edit"
    requirement: "DEP-02"
    verification:
      - kind: manual_procedural
        ref: "human-verify checkpoint (задача 2) на 375px — APPROVED пользователем"
        status: pass
    human_judgment: true
    rationale: "Визуальное усечение и mobile-first вёрстка на узком экране (375px, LIST-08) — 2 backstop-истины UI-SPEC, требуют человеческого визуального контроля; подтверждены пользователем ответом «approved»"

# Metrics
duration: 42min
completed: 2026-09-19
status: complete
---

# Phase 5 Plan 04: серверный guard блокировки (D-03) Summary

**Серверный defense-in-depth guard в `setItemPurchased`: отметка «куплено» заблокированной покупки отклоняется на сервере ДО записи через userId-scoped `findItemForUser` + чистый `isBlocked`, серверный текст ошибки пробрасывается в тост, доказано action-уровневым интеграционным тестом на реальной PG; визуальные бэкстопы 375px подтверждены пользователем.**

## Performance

- **Duration:** ~42 min (включая human-verify)
- **Started:** 2026-09-19T08:31:31Z (первый коммит RED)
- **Completed:** 2026-09-19T09:13:00Z (после approve + финализация)
- **Tasks:** 2 (задача 1 — auto/tdd; задача 2 — checkpoint:human-verify)
- **Files modified:** 3 изменено (1 новый файл)

## Accomplishments
- Замкнут контур блокировки со стороны сервера (D-03 / T-05-02, Tampering): `disabled`-чекбокс из плана 05-03 был лишь клиентской подсказкой — теперь любой обойдённый/подделанный запрос «куплено» на заблокированную покупку отклоняется в `setItemPurchased` до вызова `setItemPurchasedForUser`.
- Guard читает саму покупку и её зависимость через существующий `findItemForUser` (userId-scoped, IDOR-безопасный шов, T-05-01) и применяет чистый `isBlocked` (план 05-01); `blocked` нигде не хранится и не кэшируется.
- Guard срабатывает строго при `next === true`; снятие «куплено» (`next === false`) всегда проходит без guard — обратимость сохранена; отметка покупки без `dependsOn` не затронута.
- Серверный текст ошибки (`BLOCKED_ERROR`, дословно из UI-SPEC §Copywriting) пробрасывается в `PurchaseCheckbox` через `toast.error(res.error)` — обойдённый `disabled`-UI получает объяснение причины (S3 error).
- Guard доказан action-уровневым интеграционным тестом на реальной тестовой PG (4/4 кейса): блокировка, авто-разблокировка после покупки зависимости, снятие заблокированной, отметка без зависимости.
- Визуальные бэкстопы (усечение длинного названия зависимости на 375px, длинная опция Select, mobile-first LIST-08, авто-разблокировка, ошибка цикла) подтверждены человеко-проверкой — пользователь ответил «approved».

## Task Commits

Each task was committed atomically:

1. **Задача 1 (RED): падающий guard-тест** - `5e6ab24` (test)
2. **Задача 1 (GREEN): серверный guard в setItemPurchased + серверный текст ошибки в тост** - `c12dc8c` (feat)
3. **Задача 1 (fix, Rule 3): сериализация тест-файлов для общей PG** - `0318b81` (fix)
4. **Задача 2 (human-verify): визуальная проверка блокировки на 375px** - APPROVED пользователем (кода не менялось)

_Note: TDD-цикл задачи 1 прошёл RED → GREEN отдельными коммитами; REFACTOR не потребовался._

## Files Created/Modified
- `src/app/(app)/list/actions.ts` - guard в `setItemPurchased`: константа `BLOCKED_ERROR`, при `next` загрузка покупки и зависимости через `findItemForUser` → `isBlocked` → `{ ok:false, error: BLOCKED_ERROR }` до записи (28 строк добавлено)
- `src/components/items/PurchaseCheckbox.tsx` - в ветке `!res.ok` замена `toast.error(STATUS_ERROR)` на `toast.error(res.error)` (серверный текст; STATUS_ERROR — фолбэк)
- `src/app/(app)/list/actions.guard.test.ts` - НОВЫЙ: `// @vitest-environment node`, мок `requireUser` через mutable-holder, реальная PG (resetDb/seedUser/seedItem/closeTestDb), 4 кейса behavior
- `vitest.config.ts` - `fileParallelism: false` (Rule 3 — DB-интеграционные файлы делят одну тестовую PG)

## Decisions Made
- **`BLOCKED_ERROR` как серверная константа в error-ответе:** тип `SetPurchasedResult` уже `{ ok:false; error:string }` — расширять не потребовалось; текст берётся дословно из UI-SPEC §Copywriting Contract.
- **`STATUS_ERROR` оставлен фолбэком** в `PurchaseCheckbox` на случай пустого `res.error`, хотя серверный экшен всегда заполняет `error`.
- **`fileParallelism: false`:** оба DB-интеграционных файла (`actions.guard.test.ts`, `items.iso.test.ts`) бьют по одной тестовой PG; параллельный прогон гнал их глобальные TRUNCATE друг с другом (unique email 23505, no-op статус).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Сериализация тест-файлов для общей тестовой PG**
- **Found during:** Задача 1 (прогон нового actions.guard.test.ts вместе с существующими)
- **Issue:** Новый `actions.guard.test.ts` и `items.iso.test.ts` работают с одной тестовой Postgres. Vitest по умолчанию гоняет файлы параллельно — их глобальные `resetDb`/TRUNCATE пересекались, вызывая гонки (unique email 23505 при seedUser, no-op статус при setItemPurchased).
- **Fix:** Добавлен `fileParallelism: false` в `vitest.config.ts` — файлы тестов прогоняются последовательно (тесты внутри файла по-прежнему быстрые).
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run src/app/(app)/list/actions.guard.test.ts` зелёный (4/4); полный прогон стабилен.
- **Committed in:** 0318b81

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking).
**Impact on plan:** Авто-фикс необходим для детерминированного прогона DB-интеграционных тестов на общей PG. Скоуп не расширен — код guard'а и проводки тоста реализованы дословно по плану.

## Issues Encountered
- **Ложная тревога при human-verify (НЕ дефект кода).** Во время визуальной проверки был замечен переход на `/list/new` — но он вызван случайным тапом по кнопке-заголовку «Добавить», а не отметкой «куплено». Автоматический repro подтвердил: сама отметка покупки купленной корректно остаётся на `/list` (никакой навигации setItemPurchased не инициирует). Это верификационное наблюдение, не баг — код не менялся.

## User Setup Required
None - конфигурация внешних сервисов не требуется (используется существующая dev/test Postgres из .env.local).

## Known Stubs
None - guard подключён к реальному слою данных (findItemForUser + isBlocked), тест гоняется на реальной PG. Заглушек нет.

## Next Phase Readiness
- Фаза 5 (зависимости и блокировка) функционально замкнута: выбор зависимости в форме, производная блокировка в списке, авто-разблокировка (план 05-03) и серверный defense-in-depth guard (план 05-04) реализованы и покрыты.
- Успех-критерии фазы достигнуты: заблокированную покупку нельзя отметить купленной даже в обход UI (DEP-01 / D-03); обойдённый UI показывает серверный текст причины (S3 error); визуальные бэкстопы подтверждены человеком (DEP-02 / LIST-08).
- Готово к `/gsd-verify-work`.

## Self-Check: PASSED

- FOUND: src/app/(app)/list/actions.guard.test.ts
- FOUND: .planning/phases/05-dependencies-blocking/05-04-SUMMARY.md
- FOUND: commit 5e6ab24 (задача 1 RED)
- FOUND: commit c12dc8c (задача 1 GREEN)
- FOUND: commit 0318b81 (задача 1 fix, Rule 3)
- Guard-тест: 4 passed (4) на реальной PG

---
*Phase: 05-dependencies-blocking*
*Completed: 2026-09-19*
