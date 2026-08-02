import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemInput } from "@/lib/validation/item";

// Мокаем оба серверных шва: источник userId (сессия) и update-репозиторий. Так
// тестируем ТОЛЬКО логику Server Action (ре-валидация + перевод рубли→копейки +
// проброс userId из сессии), не поднимая postgres-клиент.
vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn(),
}));
vi.mock("@/server/repos/items", () => ({
  updateItemForUser: vi.fn(),
  deleteItemForUser: vi.fn(),
}));

import { deleteItem, updateItem } from "./actions";
import { requireUser } from "@/server/auth/current-user";
import { deleteItemForUser, updateItemForUser } from "@/server/repos/items";

const ITEM_ID = "item-1";

const validInput = {
  title: "Молоко",
  category: "home",
  urgency: "urgent",
  need: "needed",
  benefit: "savesResources",
  doubts: "sure",
  isCredit: false,
} as ItemInput;

describe("updateItem — перевод рубли→копейки + изоляция (BL-01 / D-03 / T-3-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(updateItemForUser).mockResolvedValue({} as never);
  });

  it("199.99 ₽ сохраняется как 19999 копеек (перевод ровно один раз)", async () => {
    const res = await updateItem(ITEM_ID, {
      ...validInput,
      price: 199.99,
    } as ItemInput);

    expect(res.ok).toBe(true);
    expect(updateItemForUser).toHaveBeenCalledTimes(1);
    expect(updateItemForUser).toHaveBeenCalledWith(
      "u1",
      ITEM_ID,
      expect.objectContaining({ price: 19999 })
    );
  });

  it("monthlyPayment в кредите тоже переводится в копейки", async () => {
    const res = await updateItem(ITEM_ID, {
      ...validInput,
      isCredit: true,
      monthlyPayment: 50,
    } as ItemInput);

    expect(res.ok).toBe(true);
    expect(updateItemForUser).toHaveBeenCalledWith(
      "u1",
      ITEM_ID,
      expect.objectContaining({ monthlyPayment: 5000 })
    );
  });

  it("невалидный дробный ввод (1.999) отклоняется до записи", async () => {
    const res = await updateItem(ITEM_ID, {
      ...validInput,
      price: 1.999,
    } as ItemInput);

    expect(res.ok).toBe(false);
    expect(updateItemForUser).not.toHaveBeenCalled();
  });

  it("userId берётся из сессии (requireUser), а не из payload", async () => {
    // Злоумышленник кладёт чужой userId в payload — параметр сессии должен победить.
    const res = await updateItem(ITEM_ID, {
      ...validInput,
      userId: "attacker",
    } as unknown as ItemInput);

    expect(res.ok).toBe(true);
    // Первый аргумент updateItemForUser — userId из requireUser (u1), не «attacker».
    const [userId] = vi.mocked(updateItemForUser).mock.calls[0]!;
    expect(userId).toBe("u1");
  });

  // WR-01: репозиторий возвращает null, когда WHERE не нашёл строку (чужая или
  // несуществующая покупка — no-op). Экшен обязан отразить это как { ok: false },
  // а не рапортовать об успехе (иначе клиент навигирует на /list, хотя ничего не
  // изменилось). Scoping по userId при этом не ослабляется.
  it("возвращает { ok: false }, когда updateItemForUser вернул null (no-op/чужая покупка)", async () => {
    vi.mocked(updateItemForUser).mockResolvedValueOnce(null as never);

    const res = await updateItem(ITEM_ID, { ...validInput });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Не удалось сохранить изменения. Попробуйте ещё раз.");
    }
  });
});

// deleteItem — Server Action удаления (ITEM-08 / D-06). БЕЗ payload-валидации
// (только id + scoping по userId из сессии). Проверяем: проброс userId сессии + id
// в deleteItemForUser, возврат { ok } и обработку ошибки репозитория.
describe("deleteItem — изоляция по userId + обработка ошибок (D-06 / T-3-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(deleteItemForUser).mockResolvedValue({} as never);
  });

  it("вызывает deleteItemForUser с userId сессии и переданным id", async () => {
    const res = await deleteItem(ITEM_ID);

    expect(res.ok).toBe(true);
    expect(deleteItemForUser).toHaveBeenCalledTimes(1);
    expect(deleteItemForUser).toHaveBeenCalledWith("u1", ITEM_ID);
  });

  it("userId берётся из сессии (requireUser), а не из аргумента", async () => {
    await deleteItem(ITEM_ID);

    const [userId] = vi.mocked(deleteItemForUser).mock.calls[0]!;
    expect(userId).toBe("u1");
  });

  it("при исключении репозитория возвращает { ok: false } с delete-текстом", async () => {
    vi.mocked(deleteItemForUser).mockRejectedValueOnce(new Error("db down"));

    const res = await deleteItem(ITEM_ID);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Не удалось удалить покупку. Попробуйте ещё раз.");
    }
  });

  // WR-01: deleteItemForUser возвращает null, когда WHERE не нашёл строку (чужая
  // или несуществующая покупка — no-op). Экшен обязан вернуть { ok: false }, а не
  // рапортовать об успехе удаления того, чего не удалял.
  it("возвращает { ok: false }, когда deleteItemForUser вернул null (no-op/чужая покупка)", async () => {
    vi.mocked(deleteItemForUser).mockResolvedValueOnce(null as never);

    const res = await deleteItem(ITEM_ID);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Не удалось удалить покупку. Попробуйте ещё раз.");
    }
  });
});
