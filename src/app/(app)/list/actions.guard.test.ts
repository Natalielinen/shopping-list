// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Action-уровневый интеграционный тест серверного guard'а блокировки (D-03 /
// T-05-02, Tampering). Бьёт по РЕАЛЬНОЙ тестовой Postgres (DATABASE_URL_TEST), а не
// по замоканному ORM (Pitfall 2): только так проверяется, что guard читает покупку
// и её зависимость через userId-scoped findItemForUser и отклоняет обойдённый
// запрос «куплено» ДО записи в БД.
//
// requireUser — единственная замоканная зависимость: подставляем засеянного
// пользователя через mutable-holder (vi.mock хойстится над импортами, поэтому id
// проставляется в каждом тесте ПОСЛЕ seedUser). Остальное — настоящий слой данных.
const currentUser: { id: string | null } = { id: null };

vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => {
    if (!currentUser.id) throw new Error("UNAUTHENTICATED");
    return { id: currentUser.id };
  },
}));

import { setItemPurchased } from "@/app/(app)/list/actions";
import { findItemForUser } from "@/server/repos/items";

import { closeTestDb, resetDb, seedItem, seedUser } from "../../../../tests/helpers/db";

// Дословный текст guard-отклонения (UI-SPEC §Copywriting Contract). Сервер обязан
// вернуть именно его, чтобы обойдённый disabled-UI объяснил причину в тосте.
const BLOCKED_ERROR = "Сначала купите товар, от которого зависит эта покупка.";

beforeEach(async () => {
  await resetDb();
  currentUser.id = null;
});

afterAll(async () => {
  await closeTestDb();
});

describe("setItemPurchased — серверный guard блокировки (D-03 / T-05-02)", () => {
  it("отклоняет отметку «куплено» заблокированной покупки (зависимость не куплена) → { ok:false, error: BLOCKED_ERROR }, статус не меняется", async () => {
    const a = await seedUser("a@test.dev");
    currentUser.id = a.id;
    // A — зависимость (не куплена); B зависит от A → B заблокирована.
    const depA = await seedItem(a.id, { title: "A-dependency", purchasedAt: null });
    const itemB = await seedItem(a.id, { title: "B-dependent", dependsOn: depA.id });

    const res = await setItemPurchased(itemB.id, true);

    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: BLOCKED_ERROR });

    // Статус B не изменился: guard отклонил ДО записи (purchasedAt остался null).
    const row = await findItemForUser(a.id, itemB.id);
    expect(row!.purchasedAt).toBeNull();
  });

  it("пропускает отметку «куплено» после покупки зависимости → { ok:true } (авто-разблокировка на сервере)", async () => {
    const a = await seedUser("a@test.dev");
    currentUser.id = a.id;
    // A уже куплена → B больше не заблокирована.
    const depA = await seedItem(a.id, { title: "A-dependency", purchasedAt: new Date() });
    const itemB = await seedItem(a.id, { title: "B-dependent", dependsOn: depA.id });

    const res = await setItemPurchased(itemB.id, true);

    expect(res).toEqual({ ok: true });

    // Персист: B действительно отмечена купленной.
    const row = await findItemForUser(a.id, itemB.id);
    expect(row!.purchasedAt).toBeInstanceOf(Date);
  });

  it("разрешает снятие «куплено» (next === false) заблокированной покупки → { ok:true } (обратимость, guard не мешает)", async () => {
    const a = await seedUser("a@test.dev");
    currentUser.id = a.id;
    // A не куплена → B заблокирована; но снятие всегда должно проходить.
    const depA = await seedItem(a.id, { title: "A-dependency", purchasedAt: null });
    const itemB = await seedItem(a.id, {
      title: "B-dependent",
      dependsOn: depA.id,
      purchasedAt: new Date(),
    });

    const res = await setItemPurchased(itemB.id, false);

    expect(res).toEqual({ ok: true });

    // Снятие персистнулось: purchasedAt снова null.
    const row = await findItemForUser(a.id, itemB.id);
    expect(row!.purchasedAt).toBeNull();
  });

  it("не срабатывает для покупки без зависимости → { ok:true }", async () => {
    const a = await seedUser("a@test.dev");
    currentUser.id = a.id;
    const item = await seedItem(a.id, { title: "standalone" });

    const res = await setItemPurchased(item.id, true);

    expect(res).toEqual({ ok: true });

    const row = await findItemForUser(a.id, item.id);
    expect(row!.purchasedAt).toBeInstanceOf(Date);
  });
});
