---
phase: 03
slug: edit-delete-items
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 03 — Security

> Контракт безопасности фазы: реестр угроз, принятые риски и журнал аудита.
> Фаза 3 добавила редактирование (ITEM-07) и жёсткое удаление (ITEM-08) покупок — обе операции работают со записью в БД под изоляцией по `userId`, поэтому основная поверхность угроз здесь — IDOR (доступ к чужим покупкам) и mass-assignment владельца.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Клиент → Server Action | Недоверенный ввод формы редактирования пересекает границу сервера | Поля покупки (title, category, price, deadline, monthlyPayment и т.д.) |
| Server Action → repo/БД | `userId` берётся из серверной сессии (`requireUser()`), не из payload — это шов изоляции данных по пользователю | `userId` (из сессии) + `id` покупки |
| Приложение → реестр shadcn/Radix | Вендоренный UI-код примитива `alert-dialog` | Исходный код компонента (supply chain) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-3-01 | Elevation/Tampering (IDOR на update) | `updateItem` / `updateItemForUser` | high | mitigate | `userId` только из `requireUser()`; UPDATE scoped `and(eq(items.id,id), eq(items.userId,userId))`; чужая/несуществующая → `null` (no-op). Якорь: `items.iso.test.ts` (реальная Postgres) | closed |
| T-3-02 | Information Disclosure (IDOR на read) | `findItemForUser` / `edit/page.tsx` | high | mitigate | read scoped по `userId`; чужая/отсутствующая → `notFound()` (404), форма не предзаполняется чужими данными. Якорь: `items.iso.test.ts` + e2e | closed |
| T-3-03 | Tampering (mass-assignment владельца) | `updateItem` payload | high | mitigate | `userId` никогда из payload; `ItemInsertData` исключает `id/userId/createdAt`; repo подмешивает `userId` из сессии в WHERE | closed |
| T-3-04 | Tampering (never-trust-client) | `updateItem` input | medium | mitigate | `itemInputSchema.safeParse` на сервере до записи; невалидное → `{ ok: false }` без записи | closed |
| T-3-05 | Elevation/Tampering (IDOR на delete) | `deleteItem` / `deleteItemForUser` | high | mitigate | `userId` только из `requireUser()`; DELETE scoped `and(eq(items.id,id), eq(items.userId,userId))`; чужая → `null` (no-op). Якорь: `items.iso.test.ts` (реальная Postgres) | closed |
| T-3-06 | Tampering (destructive UX) | `DeleteItemButton` | medium | mitigate | Жёсткое удаление только через подтверждение `AlertDialog` (никогда тихо, D-05); pending-guard от двойного клика; ошибка → диалог остаётся открыт, покупка не исчезает | closed |
| T-3-SC | Tampering (supply chain) | примитив `alert-dialog` | low | accept | Официальный реестр shadcn; реализовано из unified-пакета `radix-ui` (уже в стеке с Фазы 2), 0 новых npm-зависимостей — см. Accepted Risks | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-3-SC | `AlertDialog` реализован из unified-пакета `radix-ui`, уже установленного и провалидированного в Фазе 2 (react-select/checkbox/collapsible той же семьи), а не из отдельного `@radix-ui/react-alert-dialog`. Итог — **0 новых npm-зависимостей**, поведение примитива идентично; supply-chain-риск ниже, чем у запланированного отдельного пакета. Вендоренный код в `src/components/ui/alert-dialog.tsx` проверен в diff. Соответствует locked-решению D-05. | Natalie Chufistova (D-05) | 2026-08-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 7 | 7 | 0 | secure-phase (ASVS L1, реестр авторизован на этапе планирования) |

**Примечание.** Код-ревью фазы нашло предупреждение WR-01: экшены `updateItem`/`deleteItem` возвращали `{ ok: true }` при no-op (репозиторий вернул `null` из-за несовпадения владельца). Сама изоляция при этом не нарушалась (WHERE по `userId` уже блокировал запись), но ложный «успех» вводил в заблуждение. Исправлено в этой же фазе: при `null` из репозитория экшены возвращают `{ ok: false }`. Это **усиливает** T-3-01/T-3-03/T-3-05 — попытка IDOR/no-op теперь честно рапортует отказ.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02
