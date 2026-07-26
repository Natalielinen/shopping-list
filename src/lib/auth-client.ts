import { createAuthClient } from "better-auth/react";

// Браузерный клиент Better Auth для форм регистрации/входа/выхода
// (signUp / signIn / signOut). baseURL не задаём — same-origin по умолчанию.
export const authClient = createAuthClient();
