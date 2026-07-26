import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Единый catch-all маршрут Better Auth: все эндпоинты аутентификации
// (регистрация, вход, выход, сессия) обслуживаются одним хендлером.
export const { GET, POST } = toNextJsHandler(auth);
