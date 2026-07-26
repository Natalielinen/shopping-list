// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { findItemsForUser } from "@/server/repos/items";

import { closeTestDb, resetDb, seedItem, seedUser } from "../../../tests/helpers/db";

// Якорь изоляции AUTH-04 / критерий успеха №4. Тест бьёт по РЕАЛЬНОЙ тестовой
// Postgres (DATABASE_URL_TEST), а не по замоканному ORM (Pitfall 2): только так
// проверяется, что WHERE user_id = ? действительно изолирует данные.
describe("findItemsForUser — изоляция данных по userId (AUTH-04)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

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
