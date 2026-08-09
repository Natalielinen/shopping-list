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

// Добавляет покупку через существующий поток /list/new с заданными очковыми
// выборами (для детерминированного приоритета в тесте сортировки).
async function addItem(
  page: import("@playwright/test").Page,
  title: string,
  opts: { category: string; urgency: string; need: string; benefit: string }
) {
  await page.goto("/list/new");
  await expect(
    page.getByRole("heading", { name: "Новая покупка" })
  ).toBeVisible();

  await page.getByLabel("Название").fill(title);
  await selectOption(page, "Категория", opts.category);
  await selectOption(page, "Срочность", opts.urgency);
  await selectOption(page, "Необходимость", opts.need);
  await selectOption(page, "Выгода", opts.benefit);

  await page.getByRole("button", { name: "Добавить покупку" }).click();
  await expect(page).toHaveURL(/\/list$/, { timeout: 20000 });
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

// Управляемый список Фазы 4 (LIST-01/02/03/05/08, план 04-04): фильтр
// «показывать купленные» раскрывает секцию «Куплено» с приглушёнными
// (line-through) карточками; снятие чекбокса в архиве возвращает покупку в
// активные; переключение Select сортировки меняет порядок активного списка.
// Приоритеты подобраны детерминированно (Яблоки > Молоко > Апельсины), поэтому
// priority-порядок [Яблоки, Молоко, Апельсины] отличается от алфавитного
// [Апельсины, Молоко, Яблоки].
test("фильтр раскрывает секцию «Куплено», undo из архива, переключение сортировки меняет порядок", async ({
  page,
}) => {
  const email = `sort-filter-${Date.now()}@example.com`;
  const password = "password123";

  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: email },
  });
  expect(res.ok()).toBeTruthy();

  // Яблоки — высший приоритет; Молоко — средний; Апельсины — низший.
  await addItem(page, "Яблоки", {
    category: "Здоровье",
    urgency: "Жизненно важно",
    need: "И нужно и хочется",
    benefit: "Приносит доход",
  });
  await addItem(page, "Молоко", {
    category: "Здоровье",
    urgency: "Срочно",
    need: "Нужно",
    benefit: "Экономит время/деньги/силы",
  });
  await addItem(page, "Апельсины", {
    category: "Развлечения",
    urgency: "Не срочно",
    need: "Хочется",
    benefit: "Тратит больше, чем стоит",
  });

  // Дефолт: сортировка по приоритету, фильтр ВЫКЛ → порядок по убыванию total.
  await expect(page.locator("ul > li")).toHaveText([
    /Яблоки/,
    /Молоко/,
    /Апельсины/,
  ]);

  // Отметить «Молоко» купленной → при фильтре ВЫКЛ уходит из активного списка.
  const milk = page.locator("ul > li").filter({ hasText: "Молоко" });
  await milk.getByRole("checkbox", { name: "Отметить купленной" }).click();
  await expect(page.locator("ul > li")).toHaveText([/Яблоки/, /Апельсины/], {
    timeout: 20000,
  });

  // Включить «Показывать купленные» → секция «Куплено» с приглушённой карточкой.
  await page.getByRole("checkbox", { name: "Показывать купленные" }).check();
  const archive = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Куплено/ }) });
  await expect(archive).toBeVisible();

  // Купленная карточка приглушена: title зачёркнут (line-through) — избыточный
  // канал статуса, не только цвет (§Color / §UI-SPEC).
  const archivedMilkTitle = archive.getByText("Молоко");
  await expect(archivedMilkTitle).toBeVisible();
  await expect(archivedMilkTitle).toHaveClass(/line-through/);

  // Снять чекбокс в архиве («Вернуть в активные») → покупка вернулась в активные,
  // секция «Куплено» исчезла (0 купленных).
  await archive.getByRole("checkbox", { name: "Вернуть в активные" }).click();
  await expect(
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Куплено/ }) })
  ).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator("ul > li")).toHaveText([
    /Яблоки/,
    /Молоко/,
    /Апельсины/,
  ]);

  // Переключить сортировку на «По алфавиту» → порядок активных меняется.
  await selectOption(page, "Сортировка", "По алфавиту");
  await expect(page.locator("ul > li")).toHaveText([
    /Апельсины/,
    /Молоко/,
    /Яблоки/,
  ]);
});
