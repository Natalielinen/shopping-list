import { expect, test } from "@playwright/test";

// Пустой стейт списка (UI-SPEC §Copywriting): heading «Список пуст» + body +
// кнопка-ссылка «Добавить покупку» на /list/new (Фаза 2 D-09). Тексты — ровно из
// UI-SPEC. Пользователь готовится через API регистрации (авто-вход создаёт сессию).
test("авторизованный видит пустой стейт с кнопкой «Добавить покупку»", async ({
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
    page.getByText("Добавьте первую покупку — она сразу получит приоритет.")
  ).toBeVisible();

  // Пустой стейт содержит вход на форму добавления (ссылка-кнопка на /list/new).
  const addLink = page.getByRole("link", { name: "Добавить покупку" });
  await expect(addLink).toBeVisible();
  await expect(addLink).toHaveAttribute("href", "/list/new");

  // Самих полей формы на /list нет — форма живёт на отдельной странице /list/new.
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
