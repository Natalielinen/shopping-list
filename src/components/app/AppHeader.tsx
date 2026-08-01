// Шапка приложения (D-08). Рендерится сервером внутри защищённого layout —
// отдельного клиентского состояния загрузки нет. Слева — название приложения
// (роль Heading 20/600), справа — email авторизованного пользователя (роль Body
// 16/400), который обрезается ellipsis в одну строку и никогда не переносит
// шапку и не выталкивает будущий контрол выхода (UI-SPEC backstop).
//
// Кнопка «Выйти» (D-09) занимает слот справа — завершает D-08 (имя + email +
// выход). LogoutButton — client-leaf; сама шапка остаётся серверной.
//
// Кнопка «Добавить» (D-08) — постоянная точка входа на форму /list/new из любого
// экрана. Навигационная ссылка (next Link + shadcn Button asChild): интерактивное
// состояние не требует "use client", шапка остаётся серверным компонентом.
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        <Button asChild size="sm" className="h-9 shrink-0">
          <Link href="/list/new">
            <Plus />
            Добавить
          </Link>
        </Button>
        <LogoutButton />
      </div>
    </header>
  );
}
