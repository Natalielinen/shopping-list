---
phase: 01-foundation-auth
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/lib/auth-errors.ts
  - src/lib/validation/auth.ts
  - src/server/auth/current-user.ts
  - src/server/db/client.ts
  - src/server/db/schema.ts
  - src/server/repos/items.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/(app)/layout.tsx
  - src/app/(app)/list/page.tsx
  - src/app/(app)/error.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/RegisterForm.tsx
  - src/components/app/AppHeader.tsx
  - src/components/app/LogoutButton.tsx
  - tests/helpers/db.ts
  - tests/helpers/load-env.ts
  - e2e/auth/isolation.spec.ts
  - e2e/auth/logout.spec.ts
  - e2e/auth/login.spec.ts
  - e2e/auth/register.spec.ts
  - e2e/global-setup.ts
  - drizzle.config.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Фаза 1: Отчёт code review

**Проверено:** 2026-07-26
**Глубина:** standard
**Файлов проверено:** 28
**Статус:** issues_found

## Summary

Проверена security-критичная поверхность фазы 1 (foundation-auth): конфигурация Better Auth, шов изоляции данных, серверные границы доступа к БД, guard защищённого layout, формы авторизации и маппинг ошибок с защитой от account-enumeration.

Четыре ключевых заявленных инварианта выполнены:

1. **Изоляция данных** — единственная точка чтения `findItemsForUser(userId)` всегда добавляет `eq(items.userId, userId)` в WHERE; `userId` берётся исключительно из серверной сессии (`getCurrentUser` → `auth.api.getSession({ headers })`), никогда из тела/query. Ни один путь не возвращает чужие строки. Подтверждено e2e-тестом `isolation.spec.ts`, который корректно направляет и приложение, и seed в одну тестовую БД (`playwright.config.ts` прокидывает `DATABASE_URL: DATABASE_URL_TEST` в webServer).
2. **Секреты не утекают в клиент** — `import "server-only"` первой строкой в `auth.ts`, `current-user.ts`, `db/client.ts`, `repos/items.ts`; `auth-client.ts` не содержит секретов; env-переменные без префикса `NEXT_PUBLIC_`.
3. **Enumeration-guard на входе** — `mapAuthError(..., "login")` сводит 401/403/`INVALID_EMAIL_OR_PASSWORD` к единой строке «Неверный email или пароль».
4. **Guard защищённого маршрута** — `(app)/layout.tsx` выполняет серверную проверку `getSession` и `redirect("/login")`, `list/page.tsx` дублирует проверку; логика подтверждена e2e (`logout.spec.ts` проверяет, что после выхода `/list` снова редиректит).

Blocker-ов не найдено. Ниже — предупреждения и заметки, снижающие устойчивость/безопасность в проде.

## Warnings

### WR-01: `BETTER_AUTH_SECRET` не валидируется — риск тихого fallback на небезопасный дефолт

**File:** `src/lib/auth.ts:21`
**Issue:** `secret: process.env.BETTER_AUTH_SECRET` передаётся напрямую. Если переменная не задана в окружении, Better Auth получает `undefined` и не падает — он продолжает работу с встроенным дефолтным секретом (с предупреждением в консоль). В проде это означает, что токены сессий подписываются известным значением и потенциально подделываемы. CLAUDE.md явно требует `BETTER_AUTH_SECRET` ≥32 символов (`openssl rand -base64 32`), но fail-closed проверки нет. Nullish-assertion даже не используется (в отличие от `DATABASE_URL!`), поэтому отсутствие переменной проходит совершенно молча.
**Fix:** Добавить явную проверку до вызова `betterAuth`, чтобы падать при старте, а не деградировать до дефолта:
```typescript
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET обязателен и должен быть ≥32 символов"
  );
}
export const auth = betterAuth({ secret, /* ... */ });
```

### WR-02: Путь регистрации допускает account enumeration

**File:** `src/lib/auth-errors.ts:49-53`, `src/components/auth/RegisterForm.tsx:52-56`
**Issue:** Вход усилен против enumeration, но регистрация — нет: `mapAuthError(..., "register")` при конфликте (`422`/`USER_ALREADY_EXISTS`) возвращает «Этот email уже занят». Это позволяет атакующему перебором формы регистрации определить, какие email уже зарегистрированы — тот же класс утечки (T-04-ENUM), от которого защищён вход. Формулировка — часть UI-SPEC Copywriting Contract, поэтому это осознанный продуктовый компромисс, но с точки зрения безопасности риск должен быть зафиксирован явно (и, при желании, смягчён generic-текстом «Проверьте почту для подтверждения» + email-verification-флоу в будущих фазах).
**Fix:** Зафиксировать риск в threat-модели фазы. Если приемлемо раскрытие — оставить как есть с явным решением; иначе переключить на нейтральный текст, не подтверждающий существование аккаунта.

### WR-03: Сбой `signOut()` оставляет сессию активной, но уводит пользователя как «вышедшего»

**File:** `src/components/app/LogoutButton.tsx:19-30`
**Issue:** В `catch` при сбое `authClient.signOut()` выполняется `router.push("/login")` без `router.refresh()`. Если запрос выхода не дошёл до сервера, серверная DB-сессия и httpOnly cookie НЕ инвалидированы — сессия остаётся действительной ещё 30 дней (D-11), хотя пользователь считает, что вышел. На общем устройстве это позволяет вернуться в приложение (переход на `/list` пройдёт guard). Комментарий утверждает, что сессия «локально считается завершённой», но фактически ничего не очищено. Дополнительно `isPending` не сбрасывается и `router.refresh()` не вызывается на этом пути.
**Fix:** На сбое сообщить об ошибке и не имитировать успешный выход, либо ретраить `signOut`. Минимум — добавить `router.refresh()` и вернуть кнопку в активное состояние:
```typescript
} catch {
  setIsPending(false);
  setError("Не удалось выйти. Попробуйте ещё раз.");
  return;
}
```

### WR-04: `DATABASE_URL` через non-null assertion — тихая ошибка конфигурации

**File:** `src/server/db/client.ts:10`, `drizzle.config.ts:18`
**Issue:** `postgres(process.env.DATABASE_URL!)` и `url: process.env.DATABASE_URL!`. Non-null-assertion — только компайл-тайм фикция: если переменная не задана, в `postgres()` уйдёт `undefined`, и драйвер postgres.js молча попытается подключиться к дефолту (localhost, текущий юзер), вместо явного отказа. Ошибка проявится поздно и неочевидно. Валидации окружения на старте нет.
**Fix:** Проверять переменную явно и падать с внятным сообщением:
```typescript
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан");
const client = postgres(url);
```

## Info

### IN-01: Столбцы `updated_at` в `session`/`account` не имеют `defaultNow()`

**File:** `src/server/db/schema.ts:38-40, 67-69`
**Issue:** В таблице `user` `updatedAt` объявлен как `.defaultNow().$onUpdate(...)`, но в `session` и `account` — только `.$onUpdate(...).notNull()` без `.defaultNow()`. `$onUpdate` не срабатывает на INSERT, поэтому строка без явного `updatedAt` нарушила бы `NOT NULL`. На практике Better Auth всегда проставляет это поле при вставке, так что рантайм-сбоя нет, но это несогласованность схемы и скрытая зависимость от поведения адаптера. Файл генерируется `@better-auth/cli`, поэтому правку нужно вносить как часть регенерации, а не вручную.
**Fix:** При следующей регенерации схемы привести `updated_at` к единому виду (`.defaultNow().$onUpdate(...)`), либо задокументировать, что значение всегда поставляет адаптер.

### IN-02: Парсер `.env.local` не учитывает `export`-префикс и inline-комментарии

**File:** `tests/helpers/load-env.ts:12-28`
**Issue:** Ручной парсер разбивает строку по первому `=` и снимает кавычки, но не обрабатывает строки вида `export KEY=val` (ключ станет `export KEY`) и не отсекает inline-комментарии (`KEY=val # comment` попадёт в значение целиком). Для типового `.env.local` это работает, но при нестандартном формате переменная тихо получит неверное значение — что для `DATABASE_URL_TEST`/`BETTER_AUTH_SECRET` даёт трудноуловимые сбои тестов.
**Fix:** Либо задокументировать поддерживаемый формат (`KEY=value`, без `export`, без inline-комментариев), либо использовать проверенную библиотеку (`dotenv`) для разбора.

---

_Проверено: 2026-07-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Глубина: standard_
