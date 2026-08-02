import { expect, test } from "@playwright/test";

// Сквозной срез удаления Фазы 3 (ITEM-08, D-05/D-06/D-07): доказывает весь путь за
// один проход — карточка на /list → иконка «корзина» (aria-label «Удалить покупку»)
// → AlertDialog подтверждения («Удалить покупку?») → Server Action deleteItem
// (userId из сессии + scoping) → deleteItemForUser → router.refresh() → покупка
// исчезает из RSC-списка, остаёмся на /list.
//
// Дополнительно проверяет D-05: «Отмена» закрывает диалог, НЕ удаляя покупку
// (тихого удаления нет — только через явное подтверждение).
//
// Пользователь готовится через API регистрации (авто-вход создаёт сессионную
// cookie в контексте страницы), как в add-item.spec / edit-item.spec.

async function selectOption(
  page: import("@playwright/test").Page,
  label: string,
  option: string
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("удаление покупки: карточка → подтверждение AlertDialog → покупка исчезает; «Отмена» не удаляет", async ({
  page,
}) => {
  const email = `delete-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // --- Добавляем покупку через существующий поток /list/new. ---
  await page.goto("/list/new");
  await expect(
    page.getByRole("heading", { name: "Новая покупка" })
  ).toBeVisible();

  await page.getByLabel("Название").fill("Молоко");
  await selectOption(page, "Категория", "Здоровье");
  await selectOption(page, "Срочность", "Срочно");
  await selectOption(page, "Необходимость", "Нужно");
  await selectOption(page, "Выгода", "Экономит время/деньги/силы");

  await page.getByRole("button", { name: "Добавить покупку" }).click();

  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });
  const card = page.locator("ul > li").filter({ hasText: "Молоко" });
  await expect(card).toBeVisible();

  // --- D-05: «Отмена» закрывает диалог, покупка остаётся. ---
  await card.getByRole("button", { name: "Удалить покупку" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Удалить покупку?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toBeVisible();

  // --- Подтверждение: диалог → «Удалить» → покупка исчезает из списка. ---
  await card.getByRole("button", { name: "Удалить покупку" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Удалить", exact: true }).click();

  // Остаёмся на /list (D-07), карточка исчезла, список пуст.
  await expect(page).toHaveURL(/\/list$/);
  await expect(card).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator("ul > li")).toHaveCount(0);
});
