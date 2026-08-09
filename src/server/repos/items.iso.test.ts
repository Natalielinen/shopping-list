// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createItemForUser,
  deleteItemForUser,
  findItemForUser,
  findItemsForUser,
  setItemPurchasedForUser,
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

// Очистка nullable-полей на UPDATE (CR-01). Проверяется на РЕАЛЬНОЙ тестовой
// Postgres: Drizzle `.set()` ИСКЛЮЧАЕТ ключи со значением `undefined` из
// сгенерированного SQL UPDATE, поэтому ранее заданные nullable-колонки
// (link/description/deadline/price/monthlyPayment) невозможно было очистить через
// форму — старое значение оставалось. updateItemForUser обязан нормализовать
// `undefined → null`, чтобы UPDATE явно писал `SET col = NULL`.
describe("updateItemForUser — очистка nullable-полей на UPDATE (CR-01)", () => {
  const filledData = {
    title: "A-filled",
    category: "home",
    urgency: "urgent",
    need: "needed",
    benefit: "savesResources",
    doubts: "sure",
    isCredit: true,
    link: "https://example.com",
    description: "заметка",
    deadline: new Date("2026-12-31"),
    price: 19999, // копейки
    monthlyPayment: 5000, // копейки
  } as const;

  const clearedData = {
    title: "A-cleared",
    category: "home",
    urgency: "urgent",
    need: "needed",
    benefit: "savesResources",
    doubts: "sure",
    isCredit: false,
    // Все nullable-поля очищены (форма шлёт undefined для пустых значений).
    link: undefined,
    description: undefined,
    deadline: undefined,
    price: undefined,
    monthlyPayment: undefined,
  } as const;

  it("очищает link/description/deadline/price при обновлении пустыми значениями", async () => {
    const a = await seedUser("a@test.dev");
    const created = await createItemForUser(a.id, { ...filledData });

    // Санити: nullable-поля действительно заданы после create.
    expect(created!.link).toBe("https://example.com");
    expect(created!.description).toBe("заметка");
    expect(created!.price).toBe(19999);

    const updated = await updateItemForUser(a.id, created!.id, {
      ...clearedData,
    });

    expect(updated).not.toBeNull();

    // Ре-чтение из БД: колонки обнулены (а не сохранили старое значение).
    const [row] = await findItemsForUser(a.id);
    expect(row!.link).toBeNull();
    expect(row!.description).toBeNull();
    expect(row!.deadline).toBeNull();
    expect(row!.price).toBeNull();
  });

  it("снятие «в кредит» (isCredit:false + monthlyPayment undefined) обнуляет monthly_payment", async () => {
    const a = await seedUser("a@test.dev");
    const created = await createItemForUser(a.id, { ...filledData });
    expect(created!.monthlyPayment).toBe(5000);

    await updateItemForUser(a.id, created!.id, { ...clearedData });

    const [row] = await findItemsForUser(a.id);
    expect(row!.isCredit).toBe(false);
    expect(row!.monthlyPayment).toBeNull();
  });

  it("легитимный ноль (price:0) сохраняется, а не превращается в null", async () => {
    const a = await seedUser("a@test.dev");
    const created = await createItemForUser(a.id, { ...filledData });

    await updateItemForUser(a.id, created!.id, { ...clearedData, price: 0 });

    const [row] = await findItemsForUser(a.id);
    expect(row!.price).toBe(0);
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

// Изоляция ЗАПИСИ статуса «куплено» по userId (LIST-04 / T-4-01, IDOR на статус) +
// обратимость (D-05). Проверяется на РЕАЛЬНОЙ тестовой Postgres:
// setItemPurchasedForUser скоупит UPDATE `and(eq(id), eq(userId))`, поэтому
// пользователь B не может изменить статус покупки A (WHERE не находит строку →
// .returning() пуст → null, строка A не тронута), а владелец A — может, причём
// обратимо: true → purchasedAt=non-null Date, false → purchasedAt=null (D-07).
describe("setItemPurchasedForUser — изоляция записи по userId (LIST-04 / D-08)", () => {
  it("пользователь B не может изменить статус покупки A (возврат null, purchasedAt A остался null)", async () => {
    const a = await seedUser("a@test.dev");
    const b = await seedUser("b@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await setItemPurchasedForUser(b.id, itemA.id, true);

    expect(result).toBeNull();

    // Строка A цела: статус не изменился (purchasedAt null), title прежний.
    const row = await findItemForUser(a.id, itemA.id);
    expect(row).not.toBeNull();
    expect(row!.purchasedAt).toBeNull();
    expect(row!.title).toBe("A-private");
  });

  it("владелец A отмечает покупку купленной → purchasedAt становится non-null Date (persist)", async () => {
    const a = await seedUser("a@test.dev");
    const itemA = await seedItem(a.id, { title: "A-private" });

    const result = await setItemPurchasedForUser(a.id, itemA.id, true);

    expect(result).not.toBeNull();
    expect(result!.purchasedAt).toBeInstanceOf(Date);

    // Ре-чтение из БД подтверждает персист.
    const row = await findItemForUser(a.id, itemA.id);
    expect(row!.purchasedAt).toBeInstanceOf(Date);
  });

  it("владелец A снимает отметку купленного → purchasedAt снова null (обратимость D-05)", async () => {
    const a = await seedUser("a@test.dev");
    // Засеиваем уже купленную покупку.
    const itemA = await seedItem(a.id, {
      title: "A-purchased",
      purchasedAt: new Date(),
    });

    const result = await setItemPurchasedForUser(a.id, itemA.id, false);

    expect(result).not.toBeNull();
    expect(result!.purchasedAt).toBeNull();

    // Ре-чтение из БД подтверждает обнуление.
    const row = await findItemForUser(a.id, itemA.id);
    expect(row!.purchasedAt).toBeNull();
  });
});
