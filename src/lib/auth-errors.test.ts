import { describe, expect, it } from "vitest";

import { AUTH_ERROR_MESSAGES, mapAuthError } from "./auth-errors";

// Юнит-тесты маппинга ошибок аутентификации на тексты UI-SPEC.
// Ключевое требование безопасности (V7, enumeration-guard): для входа любая
// ошибка неверных учётных данных сводится к ОДНОЙ обобщённой строке — источник
// (нет аккаунта / неверный пароль) не различается.
describe("mapAuthError — контекст login", () => {
  it("401 (неверные учётные данные) -> обобщённая строка входа", () => {
    expect(mapAuthError({ status: 401 }, "login")).toBe(
      AUTH_ERROR_MESSAGES.invalidCredentials
    );
    expect(mapAuthError({ status: 401 }, "login")).toBe(
      "Неверный email или пароль"
    );
  });

  it("403 -> та же обобщённая строка входа", () => {
    expect(mapAuthError({ status: 403 }, "login")).toBe(
      AUTH_ERROR_MESSAGES.invalidCredentials
    );
  });

  it("код INVALID_EMAIL_OR_PASSWORD -> обобщённая строка входа", () => {
    expect(
      mapAuthError({ code: "INVALID_EMAIL_OR_PASSWORD" }, "login")
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);
  });

  it("не раскрывает существование аккаунта: несуществующий email и неверный пароль дают ОДНУ строку", () => {
    const noAccount = mapAuthError({ status: 401 }, "login");
    const wrongPassword = mapAuthError({ status: 401 }, "login");
    expect(noAccount).toBe(wrongPassword);
    expect(noAccount).toBe("Неверный email или пароль");
  });

  it("сетевая/серверная ошибка (500) при входе -> общий сетевой текст", () => {
    expect(mapAuthError({ status: 500 }, "login")).toBe(
      AUTH_ERROR_MESSAGES.network
    );
  });

  it("ошибка без статуса (сетевой сбой) при входе -> общий сетевой текст", () => {
    expect(mapAuthError({}, "login")).toBe(AUTH_ERROR_MESSAGES.network);
    expect(mapAuthError(null, "login")).toBe(AUTH_ERROR_MESSAGES.network);
  });
});

describe("mapAuthError — контекст register", () => {
  it("422 (email занят) -> «Этот email уже занят»", () => {
    expect(mapAuthError({ status: 422 }, "register")).toBe(
      AUTH_ERROR_MESSAGES.emailTaken
    );
    expect(mapAuthError({ status: 422 }, "register")).toBe(
      "Этот email уже занят"
    );
  });

  it("код USER_ALREADY_EXISTS -> «Этот email уже занят»", () => {
    expect(
      mapAuthError({ code: "USER_ALREADY_EXISTS" }, "register")
    ).toBe(AUTH_ERROR_MESSAGES.emailTaken);
  });

  it("сетевая/серверная ошибка при регистрации -> общий сетевой текст", () => {
    expect(mapAuthError({ status: 500 }, "register")).toBe(
      AUTH_ERROR_MESSAGES.network
    );
    expect(mapAuthError({}, "register")).toBe(AUTH_ERROR_MESSAGES.network);
    expect(mapAuthError(null, "register")).toBe(AUTH_ERROR_MESSAGES.network);
  });
});

describe("AUTH_ERROR_MESSAGES — тексты ровно из UI-SPEC Copywriting Contract", () => {
  it("совпадают дословно", () => {
    expect(AUTH_ERROR_MESSAGES.invalidCredentials).toBe(
      "Неверный email или пароль"
    );
    expect(AUTH_ERROR_MESSAGES.emailTaken).toBe("Этот email уже занят");
    expect(AUTH_ERROR_MESSAGES.network).toBe(
      "Что-то пошло не так. Попробуйте ещё раз."
    );
  });
});
