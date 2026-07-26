"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

// Кнопка «Выйти» (D-09). Client-leaf: вызывает authClient.signOut() — это
// инвалидирует серверную DB-сессию и снимает httpOnly cookie, — затем ведёт на
// /login (router.push + refresh, чтобы серверный guard пересчитал сессию).
// Выход не деструктивен -> без диалога подтверждения (UI-SPEC). Вариант
// outline (нейтральный, не accent — UI-SPEC Color); высота h-11 (44px) —
// минимальный touch target для мобильной доступности.
export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      // Выход должен увести на /login даже при сбое сети — сессия локально
      // всё равно должна считаться завершённой пользователем.
      router.push("/login");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={isPending}
      className="h-11 shrink-0 text-base"
    >
      Выйти
    </Button>
  );
}
