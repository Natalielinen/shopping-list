import { expect, test } from "@playwright/test";

// TRACER-срез Фазы 3 (ITEM-07, D-01/D-02/D-07/D-08/D-09): доказывает весь
// вертикальный путь редактирования за один проход — карточка на /list → иконка
// «карандаш» (Pencil) → страница /list/[id]/edit с предзаполненной формой →
// изменение поля приоритета (Срочность) → Server Action updateItem (userId из
// сессии + серверная ре-валидация) → updateItemForUser (update со scoping) →
// редирект на /list → RSC-список рендерит карточку с ПЕРЕСЧИТАННЫМ на чтении badge
// (SCORE-05, D-08).
//
// Пользователь готовится через API регистрации (авто-вход создаёт сессионную
// cookie в контексте страницы), как в add-item.spec.

async function selectOption(
  page: import("@playwright/test").Page,
  label: string,
  option: string
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("редактирование покупки: карточка → prefill → смена срочности → пересчитанный badge", async ({
  page,
}) => {
  const email = `edit-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // --- Добавляем покупку через существующий поток /list/new.
  //     health 10 + urgent 3 + needed 1 + savesResources 1 = 15. ---
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
  await expect(card).toContainText("15");

  // --- Открываем покупку на редактирование по иконке «карандаш». ---
  await card.getByRole("link", { name: "Редактировать покупку" }).click();

  await expect(page).toHaveURL(/\/list\/[^/]+\/edit$/, { timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "Редактировать покупку" })
  ).toBeVisible();
  // Форма предзаполнена текущими значениями покупки (D-02).
  await expect(page.getByLabel("Название")).toHaveValue("Молоко");

  // --- Меняем поле, влияющее на приоритет: Срочность «Срочно» → «Жизненно важно»
  //     (urgent 3 → vital 12). Новый total: 10 + 12 + 1 + 1 = 24. ---
  await selectOption(page, "Срочность", "Жизненно важно");
  await page.getByRole("button", { name: "Сохранить" }).click();

  // Успех → клиентский редирект на /list, badge пересчитан на чтении (D-08).
  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });
  const updated = page.locator("ul > li").filter({ hasText: "Молоко" });
  await expect(updated).toBeVisible();
  await expect(updated).toContainText("24");
});
