import { expect, test } from "@playwright/test";

import { seedItem, seedUser } from "../../tests/helpers/db";

// AUTH-04 (e2e-слой): браузерная проверка изоляции данных на двух пользователях.
// Пользователь A с покупкой засевается напрямую в тестовую БД; пользователь B
// регистрируется через API (авто-вход) и открывает свой список в браузере —
// данные A не видны, показан пустой стейт. Дополняет интеграционный якорь плана
// 02 (findItemsForUser) на уровне реального браузерного пути.
test("пользователь B не видит данные пользователя A (изоляция через браузер)", async ({
  page,
}) => {
  const stamp = Date.now();

  // Пользователь A с секретной покупкой — засеян напрямую в тестовую БД.
  const secretTitle = `secret-A-${stamp}`;
  const { id: userAId } = await seedUser(`iso-a-${stamp}@example.com`);
  await seedItem(userAId, { title: secretTitle });

  // Пользователь B регистрируется через API — авто-вход создаёт сессию B.
  const bEmail = `iso-b-${stamp}@example.com`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email: bEmail, password: "password123", name: bEmail },
  });
  expect(res.ok()).toBeTruthy();

  // B открывает свой список.
  await page.goto("/list");

  // Данные A не видны — B видит только свой (пустой) стейт.
  await expect(page.getByText(secretTitle)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Список пуст" })).toBeVisible();
});
