// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createItemForUser, findItemsForUser } from "@/server/repos/items";

import { closeTestDb, resetDb, seedItem, seedUser } from "../../../tests/helpers/db";

// Хуки уровня файла: тестовая БД разделяет один module-level postgres-клиент, поэтому
// закрывать его нужно РОВНО один раз после всех блоков (иначе первый afterAll рвёт
// соединение для последующих describe → CONNECTION_ENDED).
beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

// Якорь изоляции AUTH-04 / критерий успеха №4. Тест бьёт по РЕАЛЬНОЙ тестовой
// Postgres (DATABASE_URL_TEST), а не по замоканному ORM (Pitfall 2): только так
// проверяется, что WHERE user_id = ? действительно изолирует данные.
describe("findItemsForUser — изоляция чтения по userId (AUTH-04)", () => {
  it("пользователь B не видит покупки пользователя A", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");
    await seedItem(a.id, { title: "A-private" });

    const aItems = await findItemsForUser(a.id);
    const bItems = await findItemsForUser(b.id);

    expect(aItems).toHaveLength(1);
    expect(aItems[0]!.title).toBe("A-private");
    expect(bItems).toEqual([]);
  });
});

// Изоляция на ЗАПИСЬ (T-2-01 / T-2-02, AUTH-04 / Security V4). `createItemForUser`
// принимает userId отдельным параметром из серверной сессии и подмешивает его в
// .values() — чужой список недостижим, mass-assignment userId из payload не
// проходит.
describe("createItemForUser — изоляция записи по userId (AUTH-04 / Security V4)", () => {
  const baseData = {
    title: "A-created",
    category: "home",
    urgency: "urgent",
    need: "needed",
    benefit: "savesResources",
    doubts: "sure",
    isCredit: false,
  } as const;

  it("покупка A, созданная через createItemForUser, не видна пользователю B", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");

    const created = await createItemForUser(a.id, { ...baseData });

    expect(created).toBeDefined();
    expect(created!.userId).toBe(a.id);
    expect(created!.title).toBe("A-created");

    const aItems = await findItemsForUser(a.id);
    const bItems = await findItemsForUser(b.id);

    expect(aItems).toHaveLength(1);
    expect(aItems[0]!.title).toBe("A-created");
    expect(bItems).toEqual([]);
  });

  it("НЕ позволяет подменить владельца через userId в payload (mass-assignment T-2-01)", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");

    // Злоумышленник кладёт userId жертвы в payload — параметр сессии должен победить.
    await createItemForUser(a.id, {
      ...baseData,
      // @ts-expect-error — userId не входит в ItemInsertData; проверяем игнор на рантайме
      userId: b.id,
    });

    const aItems = await findItemsForUser(a.id);
    const bItems = await findItemsForUser(b.id);

    expect(aItems).toHaveLength(1);
    expect(bItems).toEqual([]);
  });

  // BL-01: колонки price/monthly_payment — integer-копейки. Проверяем на РЕАЛЬНОЙ
  // Postgres, что копеечное значение (199.99 ₽ = 19999 копеек), которое даёт
  // серверный перевод рубли→копейки, вставляется в int4 и точно читается обратно
  // (раньше дробный рубль ронял INSERT в integer-колонку).
  it("сохраняет цену в копейках (int4) и точно читает обратно", async () => {
    const a = await seedUser("a@test.dev");

    const created = await createItemForUser(a.id, {
      ...baseData,
      price: 19999, // 199.99 ₽ в копейках
      monthlyPayment: 5000, // 50.00 ₽ в копейках
    });

    expect(created!.price).toBe(19999);
    expect(created!.monthlyPayment).toBe(5000);

    const [row] = await findItemsForUser(a.id);
    expect(row!.price).toBe(19999);
    expect(row!.monthlyPayment).toBe(5000);
  });
});
