import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

// Разрешение серверной сессии в userId. Значение берётся ТОЛЬКО из серверной
// сессии (заголовки запроса), НИКОГДА из тела/query/params запроса
// (Pitfall 3/5). Это единственный источник userId для user-scoped слоя данных.
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

// Для Server Actions / route handlers: бросает при отсутствии сессии.
// Защищённые страницы/layout используют redirect вместо исключения (D-07).
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
