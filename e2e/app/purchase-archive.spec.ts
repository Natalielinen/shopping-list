import { expect, test } from "@playwright/test";

// Сквозной срез отметки «куплено» Фазы 4 (TRACER, LIST-04 / D-03/D-04/D-08/D-10):
// доказывает весь путь за один проход — карточка на /list → ведущий чекбокс
// (aria-label «Отметить купленной») → Server Action setItemPurchased (userId из
// сессии + scoping) → setItemPurchasedForUser → router.refresh() → покупка
// исчезает из активного списка (дефолтный вид, купленные скрыты) + undo-тост
// «Покупка отмечена купленной» → «Отменить» возвращает покупку в активные.
//
// Прошивает границу RSC→client на примитивах (page.tsx → ListView →
// PurchaseCheckbox) и реконсиляцию useOptimistic после router.refresh().
//
// Пользователь готовится через API регистрации (авто-вход создаёт сессионную
// cookie в контексте страницы), как в delete-item.spec / add-item.spec.

async function selectOption(
  page: import("@playwright/test").Page,
  label: string,
  option: string
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("отметка «куплено»: карточка исчезает из активного списка + undo-тост → «Отменить» возвращает", async ({
  page,
}) => {
  const email = `purchase-${Date.now()}@example.com`;
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

  // --- Отметить купленной: чекбокс «Отметить купленной» → карточка исчезает. ---
  await card.getByRole("checkbox", { name: "Отметить купленной" }).click();

  // Дефолтный вид скрывает купленные → карточка уходит из активного списка.
  await expect(card).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator("ul > li")).toHaveCount(0);

  // Undo-тост «Покупка отмечена купленной» с действием «Отменить».
  await expect(page.getByText("Покупка отмечена купленной")).toBeVisible();

  // --- «Отменить» → покупка возвращается в активный список. ---
  await page.getByRole("button", { name: "Отменить" }).click();

  const restored = page.locator("ul > li").filter({ hasText: "Молоко" });
  await expect(restored).toBeVisible({ timeout: 20000 });
});
