// Маппинг ответов об ошибках Better Auth на тексты из UI-SPEC Copywriting
// Contract. Единая точка, чтобы формы никогда не показывали сырые серверные
// детали (T-04-ERRLEAK) и чтобы вход не раскрывал существование аккаунта
// (T-04-ENUM, V7, prohibition).

// Тексты — дословно из UI-SPEC (§ Copywriting Contract). Не менять без правки
// контракта.
export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: "Неверный email или пароль",
  emailTaken: "Этот email уже занят",
  network: "Что-то пошло не так. Попробуйте ещё раз.",
} as const;

export type AuthErrorContext = "login" | "register";

// Минимальная форма ошибки Better Auth (authClient возвращает { error }).
export interface AuthErrorLike {
  status?: number;
  statusText?: string;
  code?: string;
  message?: string;
}

// Возвращает готовую к показу строку ошибки для form-level Alert.
//
// login: любая ошибка неверных учётных данных (401/403 или
// INVALID_EMAIL_OR_PASSWORD) ВСЕГДА сводится к одной обобщённой строке —
// «нет такого аккаунта» и «неверный пароль» неотличимы (enumeration-guard).
// Всё остальное (сеть/сервер) -> общий сетевой текст.
//
// register: конфликт занятого email (422 или USER_ALREADY_EXISTS) ->
// «Этот email уже занят». Всё остальное -> общий сетевой текст.
export function mapAuthError(
  error: AuthErrorLike | null | undefined,
  context: AuthErrorContext
): string {
  if (context === "login") {
    if (
      error &&
      (error.status === 401 ||
        error.status === 403 ||
        error.code === "INVALID_EMAIL_OR_PASSWORD")
    ) {
      return AUTH_ERROR_MESSAGES.invalidCredentials;
    }
    return AUTH_ERROR_MESSAGES.network;
  }

  if (
    error &&
    (error.status === 422 || error.code === "USER_ALREADY_EXISTS")
  ) {
    return AUTH_ERROR_MESSAGES.emailTaken;
  }
  return AUTH_ERROR_MESSAGES.network;
}
