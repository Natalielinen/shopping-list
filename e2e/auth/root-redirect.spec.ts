import { expect, test } from "@playwright/test";

// D-05: неавторизованный посетитель на корневом `/` редиректится на `/login`.
// Отдельного лендинга нет — приложение = личный список за авторизацией.
test("неавторизованный на / редиректится на /login", async ({ page, context }) => {
  await context.clearCookies();

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
});
