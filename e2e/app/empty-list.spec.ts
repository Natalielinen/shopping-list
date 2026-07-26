import { expect, test } from "@playwright/test";

// D-06: авторизованный пользователь видит пустой стейт списка без формы
// добавления. Тексты — ровно из UI-SPEC Copywriting Contract. Пользователь
// готовится через API регистрации (авто-вход создаёт сессию).
test("авторизованный видит пустой стейт без формы добавления", async ({
  page,
}) => {
  const email = `empty-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  await page.goto("/list");

  await expect(page.getByRole("heading", { name: "Список пуст" })).toBeVisible();
  await expect(
    page.getByText("Скоро здесь можно будет добавлять покупки.")
  ).toBeVisible();

  // Формы/кнопки добавления в Фазе 1 нет.
  await expect(
    page.getByRole("button", { name: /добав/i })
  ).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
