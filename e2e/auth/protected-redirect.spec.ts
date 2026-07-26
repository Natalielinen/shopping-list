import { expect, test } from "@playwright/test";

// D-07: запрос защищённой страницы без сессии редиректится на `/login`.
// Проверка — серверный guard в layout группы `(app)` (граница безопасности),
// а не оптимистичная проверка cookie.
test("защищённый /list без сессии редиректится на /login", async ({
  page,
  context,
}) => {
  await context.clearCookies();

  await page.goto("/list");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
});
