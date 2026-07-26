import { expect, test } from "@playwright/test";

// Criterion 2 / AUTH-02 / D-10: возвращающийся пользователь входит, и сессия
// сохраняется между перезагрузками страницы (persistent-сессия, без «запомнить
// меня»). Пользователь готовится через API Better Auth (sign-up), затем сессия
// сбрасывается очисткой cookie, после чего проверяется полноценный вход.
test("вход сохраняет сессию между перезагрузками", async ({ page, context }) => {
  const email = `login-${Date.now()}@example.com`;
  const password = "password123";

  // Готовим существующего пользователя через API регистрации.
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // Сбрасываем сессию, чтобы проверить именно вход (а не авто-вход регистрации).
  await context.clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/list$/);
  await expect(page.getByRole("heading", { name: "Список пуст" })).toBeVisible();

  // Перезагрузка — сессия persistent, остаёмся на /list (не редирект на /login).
  await page.reload();
  await expect(page).toHaveURL(/\/list$/);
  await expect(page.getByRole("heading", { name: "Список пуст" })).toBeVisible();
});
