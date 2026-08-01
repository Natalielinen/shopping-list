import { expect, test } from "@playwright/test";

// TRACER-срез Фазы 2 (ITEM-01/02, SCORE-05, LIST-06, D-09/D-12): доказывает весь
// вертикальный путь за один проход — форма (обязательные поля) → Server Action
// createItem (userId из сессии + серверная ре-валидация) → createItemForUser
// (insert со scoping) → редирект на /list → RSC-список рендерит карточку с
// вычисленным на чтении badge приоритета, отсортированный по убыванию total.
//
// Пользователь готовится через API регистрации (авто-вход создаёт сессионную
// cookie в контексте страницы), как в empty-list.spec.

async function selectOption(
  page: import("@playwright/test").Page,
  label: string,
  option: string
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("добавление покупки: форма → редирект → badge → сортировка по убыванию total", async ({
  page,
}) => {
  const email = `add-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // --- Первая покупка: высокий вклад (health 10 + vital 12 + neededAndWanted 2
  //     + income 2 = 26 → «Средний»). ---
  await page.goto("/list/new");
  await expect(
    page.getByRole("heading", { name: "Новая покупка" })
  ).toBeVisible();

  await page.getByLabel("Название").fill("Витамины");
  await selectOption(page, "Категория", "Здоровье");
  await selectOption(page, "Срочность", "Жизненно важно");
  await selectOption(page, "Необходимость", "И нужно и хочется");
  await selectOption(page, "Выгода", "Приносит доход");

  await page.getByRole("button", { name: "Добавить покупку" }).click();

  // Успех → клиентский редирект на /list, покупка сразу видна с badge.
  // Таймаут увеличен: dev-сервер компилирует Server Action и маршрут /list при
  // первой навигации, что может превышать дефолтные 5s.
  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });
  const firstCard = page.locator("ul > li").filter({ hasText: "Витамины" });
  await expect(firstCard).toBeVisible();
  // Badge: текстовая метка уровня + число total (4 избыточных канала LIST-06).
  await expect(firstCard).toContainText("Средний");
  await expect(firstCard).toContainText("26");

  // --- Вторая покупка: низкий вклад (unnecessary −10 + notUrgent 1 + wanted 0
  //     + overpriced −2 = −11 → «Низкий»). ---
  await page.goto("/list/new");
  await page.getByLabel("Название").fill("Игрушка");
  await selectOption(page, "Категория", "Не нужные хотелки");
  await selectOption(page, "Срочность", "Не срочно");
  await selectOption(page, "Необходимость", "Хочется");
  await selectOption(page, "Выгода", "Тратит больше, чем стоит");
  await page.getByRole("button", { name: "Добавить покупку" }).click();

  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });

  // Обе карточки видны, отсортированы по убыванию total: «Витамины» (26) выше
  // «Игрушка» (−11).
  const cards = page.locator("ul > li");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Витамины");
  await expect(cards.nth(1)).toContainText("Игрушка");
  await expect(cards.nth(1)).toContainText("Низкий");
});
