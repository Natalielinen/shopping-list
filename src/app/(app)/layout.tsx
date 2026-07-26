import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/app/AppHeader";

// СЕРВЕРНЫЙ guard группы `(app)` — граница безопасности (Pattern 3): реальная
// проверка сессии выполняется на сервере через `auth.api.getSession`, а не
// оптимистичной проверкой cookie в proxy/middleware (Next 16 переименовал
// middleware в proxy; оптимистичная проверка небезопасна). При отсутствии или
// истечении сессии — редирект на `/login` (D-07). Layout остаётся RSC, поэтому
// секрет BETTER_AUTH_SECRET не попадает в клиентский бандл.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={session.user.email} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
