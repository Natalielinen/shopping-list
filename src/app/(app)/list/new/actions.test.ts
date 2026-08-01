import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ItemInput } from "@/lib/validation/item";

// Мокаем оба серверных шва: источник userId (сессия) и write-репозиторий. Так
// тестируем ТОЛЬКО логику Server Action (ре-валидация + перевод рубли→копейки),
// не поднимая postgres-клиент.
vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn(),
}));
vi.mock("@/server/repos/items", () => ({
  createItemForUser: vi.fn(),
}));

import { createItem } from "./actions";
import { requireUser } from "@/server/auth/current-user";
import { createItemForUser } from "@/server/repos/items";

const validInput = {
  title: "Молоко",
  category: "home",
  urgency: "urgent",
  need: "needed",
  benefit: "savesResources",
  doubts: "sure",
  isCredit: false,
} as ItemInput;

describe("createItem — перевод рубли→копейки (BL-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(createItemForUser).mockResolvedValue({} as never);
  });

  it("199.99 ₽ сохраняется как 19999 копеек (перевод ровно один раз)", async () => {
    const res = await createItem({ ...validInput, price: 199.99 } as ItemInput);

    expect(res.ok).toBe(true);
    expect(createItemForUser).toHaveBeenCalledTimes(1);
    expect(createItemForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ price: 19999 })
    );
  });

  it("monthlyPayment в кредите тоже переводится в копейки", async () => {
    const res = await createItem({
      ...validInput,
      isCredit: true,
      monthlyPayment: 50,
    } as ItemInput);

    expect(res.ok).toBe(true);
    expect(createItemForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ monthlyPayment: 5000 })
    );
  });

  it("отсутствующая цена остаётся undefined (в БД → NULL, не 0)", async () => {
    const res = await createItem({ ...validInput } as ItemInput);

    expect(res.ok).toBe(true);
    const [, data] = vi.mocked(createItemForUser).mock.calls[0]!;
    expect(data.price).toBeUndefined();
    expect(data.monthlyPayment).toBeUndefined();
  });

  it("невалидный дробный ввод (1.999) отклоняется до записи", async () => {
    const res = await createItem({ ...validInput, price: 1.999 } as ItemInput);

    expect(res.ok).toBe(false);
    expect(createItemForUser).not.toHaveBeenCalled();
  });
});
