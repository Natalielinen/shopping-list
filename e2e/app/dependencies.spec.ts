import { expect, test } from "@playwright/test";

// Сквозной срез зависимостей и блокировки Фазы 5 (TRACER, ITEM-06 / DEP-01 / DEP-02,
// D-02/D-05). Доказывает весь путь за один проход:
//   выбор своей покупки зависимостью в форме → Server Action (владение + цикл) →
//   persist depends_on → список выводит производные blocked/dependencyTitle
//   примитивами → ItemCard рисует строку Lock + disabled-чекбокс → покупка
//   зависимости → router.refresh() (Фаза 4) → RSC пересчёт → авто-разблокировка.
//
// Прошивает главный архитектурный риск фазы: границу RSC→client для производного
// blocked (только примитивы, §Pitfall 4) и авто-разблокировку на существующем
// router.refresh() (Фаза 4).
//
// Пользователь готовится через API регистрации (авто-вход создаёт сессионную
// cookie в контексте страницы), как в purchase-archive.spec / add-item.spec.

async function selectOption(
  page: import("@playwright/test").Page,
  label: string,
  option: string
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function signUp(page: import("@playwright/test").Page) {
  const email = `deps-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "password123";
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();
}

// Добавляет покупку через существующий поток /list/new; при dependsOn выбирает
// покупку-зависимость в новом Select «Зависит от покупки».
async function addItem(
  page: import("@playwright/test").Page,
  title: string,
  opts: { dependsOn?: string } = {}
) {
  await page.goto("/list/new");
  await expect(
    page.getByRole("heading", { name: "Новая покупка" })
  ).toBeVisible();

  await page.getByLabel("Название").fill(title);
  await selectOption(page, "Категория", "Здоровье");
  await selectOption(page, "Срочность", "Срочно");
  await selectOption(page, "Необходимость", "Нужно");
  await selectOption(page, "Выгода", "Экономит время/деньги/силы");
  if (opts.dependsOn) {
    await selectOption(page, "Зависит от покупки", opts.dependsOn);
  }

  await page.getByRole("button", { name: "Добавить покупку" }).click();
  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });
}

test("зависимость блокирует покупку; покупка зависимости авто-разблокирует её", async ({
  page,
}) => {
  await signUp(page);

  // A (Молоко) — без зависимости; B (Сыр) зависит от A.
  await addItem(page, "Молоко");
  await addItem(page, "Сыр", { dependsOn: "Молоко" });

  // На /list карточка B заблокирована (Молоко ещё не куплено): строка «Заблокировано:
  // Молоко» + disabled-чекбокс (DEP-02 / DEP-01).
  const cardB = page
    .locator("ul > li")
    .filter({ has: page.getByText("Сыр", { exact: true }) });
  await expect(cardB.getByText("Заблокировано: Молоко")).toBeVisible();
  await expect(cardB.getByRole("checkbox")).toBeDisabled();

  // Отмечаем зависимость (Молоко) купленной — её чекбокс активен (нет своей
  // зависимости). exact: true обязателен — иначе подстрочное совпадение имени
  // задело бы aria-label чекбокса B «Нельзя отметить купленной, пока не куплено…».
  await page
    .getByRole("checkbox", { name: "Отметить купленной", exact: true })
    .click();

  // Авто-разблокировка (D-02): router.refresh() → RSC пересчёт → строка блокировки
  // B исчезает, её чекбокс становится активным. Ничего не хранится/не инвалидируется.
  await expect(cardB.getByText("Заблокировано: Молоко")).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(
    cardB.getByRole("checkbox", { name: "Отметить купленной", exact: true })
  ).toBeEnabled();
});

test("цикл создать нельзя: cycle-небезопасная покупка отсутствует в опциях зависимости (D-05)", async ({
  page,
}) => {
  await signUp(page);

  // Граф: B (Сыр) → A (Молоко). C (Хлеб) — независимая, безопасный кандидат.
  await addItem(page, "Молоко"); // A
  await addItem(page, "Хлеб"); // C (без зависимости)
  await addItem(page, "Сыр", { dependsOn: "Молоко" }); // B → A

  // Идём в edit A (Молоко) — у карточки есть иконка-ссылка «Редактировать покупку».
  const cardA = page
    .locator("ul > li")
    .filter({ has: page.getByText("Молоко", { exact: true }) });
  await cardA.getByRole("link", { name: "Редактировать покупку" }).click();
  await expect(
    page.getByRole("heading", { name: "Редактировать покупку" })
  ).toBeVisible();

  // Открываем Select зависимости A и проверяем состав опций.
  await page.getByRole("combobox", { name: "Зависит от покупки" }).click();

  // «Без зависимости» и безопасный кандидат «Хлеб» (C) доступны, а «Сыр» (B, уже
  // зависит от A) отфильтрован как cycle-небезопасный — цикл A↔B через UI создать
  // нельзя. Клиентская фильтрация прячет небезопасные; серверный wouldCreateCycle —
  // авторитетный never-trust-client backstop (покрыт cycle.test.ts).
  await expect(
    page.getByRole("option", { name: "Без зависимости" })
  ).toBeVisible();
  await expect(page.getByRole("option", { name: "Хлеб" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Сыр" })).toHaveCount(0);
});
