// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createItemForUser,
  deleteItemForUser,
  findItemForUser,
  findItemsForUser,
  updateItemForUser,
} from "@/server/repos/items";

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

// Изоляция ОБНОВЛЕНИЯ по userId (ITEM-07 / T-3-01, IDOR на запись). Проверяется на
// РЕАЛЬНОЙ тестовой Postgres: updateItemForUser скоупит UPDATE
// `and(eq(id), eq(userId))`, поэтому пользователь B не может изменить покупку A
// (WHERE не находит строку → .returning() пуст → null, строка A не тронута), а
// владелец A — может.
describe("updateItemForUser — изоляция записи по userId (T-3-01 / AUTH-04)", () => {
  const baseData = {
    title: "A-updated",
    category: "study",
    urgency: "vital",
    need: "neededAndWanted",
    benefit: "income",
    doubts: "doubt",
    isCredit: false,
  } as const;

  it("пользователь B не может обновить покупку A (возврат null, строка A не изменилась)", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await updateItemForUser(b.id, itemA.id, { ...baseData });

    expect(result).toBeNull();

    // Покупка A осталась нетронутой (title прежний, не «A-updated»).
    const [row] = await findItemsForUser(a.id);
    expect(row!.title).toBe("A-private");
  });

  it("владелец A обновляет свою покупку и получает обновлённую строку", async () => {
    const a = await seedUser("a@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await updateItemForUser(a.id, itemA.id, { ...baseData });

    expect(result).not.toBeNull();
    expect(result!.title).toBe("A-updated");
    expect(result!.urgency).toBe("vital");
    expect(result!.userId).toBe(a.id);
  });
});

// Изоляция ЧТЕНИЯ одной покупки по userId (ITEM-07 / T-3-02, IDOR на чтение).
// findItemForUser скоупит SELECT по userId → чужая/несуществующая покупка → null
// (RSC-обёртка вызовет notFound(), форма не предзаполнится чужими данными).
describe("findItemForUser — изоляция чтения одной покупки по userId (T-3-02)", () => {
  it("пользователь B не может прочитать покупку A (null)", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const forB = await findItemForUser(b.id, itemA.id);
    expect(forB).toBeNull();
  });

  it("владелец A читает свою покупку", async () => {
    const a = await seedUser("a@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const forA = await findItemForUser(a.id, itemA.id);
    expect(forA).not.toBeNull();
    expect(forA!.title).toBe("A-private");
    expect(forA!.userId).toBe(a.id);
  });
});

// Изоляция УДАЛЕНИЯ по userId (ITEM-08 / T-3-05, IDOR на удаление). Якорь критерия
// успеха №3 (SC-3): deleteItemForUser скоупит DELETE `and(eq(id), eq(userId))`,
// поэтому пользователь B не может удалить покупку A (WHERE не находит строку →
// .returning() пуст → null, строка A остаётся в БД), а владелец A — может (строка
// удаляется, findItemsForUser(A) больше её не содержит). Hard delete (D-05).
describe("deleteItemForUser — изоляция удаления по userId (T-3-05 / AUTH-04)", () => {
  it("пользователь B не может удалить покупку A (возврат null, покупка A на месте)", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await deleteItemForUser(b.id, itemA.id);

    expect(result).toBeNull();

    // Покупка A не удалена — по-прежнему в списке владельца.
    const aItems = await findItemsForUser(a.id);
    expect(aItems).toHaveLength(1);
    expect(aItems[0]!.title).toBe("A-private");
  });

  it("владелец A удаляет свою покупку и получает удалённую строку", async () => {
    const a = await seedUser("a@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await deleteItemForUser(a.id, itemA.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(itemA.id);
    expect(result!.userId).toBe(a.id);

    // После удаления список владельца пуст.
    const aItems = await findItemsForUser(a.id);
    expect(aItems).toEqual([]);
  });
});
