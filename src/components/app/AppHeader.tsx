// Шапка приложения (D-08). Рендерится сервером внутри защищённого layout —
// отдельного клиентского состояния загрузки нет. Слева — название приложения
// (роль Heading 20/600), справа — email авторизованного пользователя (роль Body
// 16/400), который обрезается ellipsis в одну строку и никогда не переносит
// шапку и не выталкивает будущий контрол выхода (UI-SPEC backstop).
//
// Кнопка «Выйти» (D-09) занимает слот справа — завершает D-08 (имя + email +
// выход). LogoutButton — client-leaf; сама шапка остаётся серверной.
import { LogoutButton } from "./LogoutButton";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border px-4 lg:px-6">
      <span className="shrink-0 text-xl font-semibold">Список покупок</span>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="min-w-0 truncate text-base text-muted-foreground"
          title={email}
        >
          {email}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
