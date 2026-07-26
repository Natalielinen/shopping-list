import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Корневой маршрут `/` — RSC-редирект (D-05). Отдельного лендинга нет:
// приложение = личный список за авторизацией. Проверка сессии выполняется на
// сервере (граница безопасности), затем безусловный редирект:
//  - есть сессия  → `/list` (личный список);
//  - нет сессии   → `/login`.
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? "/list" : "/login");
}
