import { expect, test } from "@playwright/test";

// Criterion 3 / AUTH-03 / D-07+D-09: авторизованный пользователь выходит с
// защищённой страницы через кнопку «Выйти» в шапке; сессия очищается (серверная
// DB-сессия + cookie), пользователь оказывается на /login и возвращается в
// неавторизованное состояние — повторный заход на /list снова редиректит на
// /login. Пользователь готовится через API Better Auth (авто-вход создаёт
// сессию).
test("выход с защищённой страницы очищает сессию и ведёт на /login", async ({
  page,
}) => {
  const email = `logout-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // На защищённой странице (шапка с кнопкой «Выйти» отрендерена).
  await page.goto("/list");
  await expect(page.getByRole("heading", { name: "Список пуст" })).toBeVisible();

  // Выход из шапки.
  await page.getByRole("button", { name: "Выйти" }).click();

  // Редирект на /login.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();

  // Сессия очищена: защищённый /list снова редиректит на /login.
  await page.goto("/list");
  await expect(page).toHaveURL(/\/login$/);
});
