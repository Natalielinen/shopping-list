import { expect, test } from "@playwright/test";

// Criterion 1 / AUTH-01 / D-04: новый посетитель регистрируется по email +
// паролю (≥8 символов), автоматически авторизуется и попадает на защищённый
// пустой список. Проверяет весь сквозной путь: форма → authClient → Better Auth
// → сессия → серверный guard в layout → getCurrentUser → findItemsForUser →
// рендер пустого стейта.
test("регистрация авто-входит и ведёт на пустой список", async ({ page }) => {
  const email = `reg-${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/register");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  // Авто-вход → редирект на защищённый список.
  await expect(page).toHaveURL(/\/list$/);
  await expect(
    page.getByRole("heading", { name: "Список пуст" })
  ).toBeVisible();
  await expect(
    page.getByText("Скоро здесь можно будет добавлять покупки.")
  ).toBeVisible();

  // Шапка показывает email авторизованного пользователя (D-08).
  await expect(page.getByText(email)).toBeVisible();
});
