import { describe, expect, it } from "vitest";

import { itemInputSchema } from "@/lib/validation/item";

// Зеркалит auth.test.ts: хелпер извлекает текст ошибки по имени поля из результата
// safeParse. Тексты сверяются дословно с UI-SPEC §Copywriting Contract.
function messageFor(
  result: ReturnType<typeof itemInputSchema.safeParse>,
  field: string
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

// Минимальный валидный payload (только обязательные поля) — база для точечных
// проверок отдельных полей.
const validBase = {
  title: "Молоко",
  category: "home",
  urgency: "urgent",
  need: "needed",
  benefit: "savesResources",
};

describe("itemInputSchema — обязательные поля", () => {
  it("отклоняет пустой title с текстом «Заполните это поле» (ITEM-01)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, title: "" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "title")).toBe("Заполните это поле");
  });

  it("отклоняет title из одних пробелов (trim перед min, WR-02)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, title: "   " });
    expect(result.success).toBe(false);
    expect(messageFor(result, "title")).toBe("Заполните это поле");
  });

  it("тримит валидный title (обрезает крайние пробелы)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, title: "  Молоко  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Молоко");
  });

  it("отклоняет отсутствующую category с текстом «Выберите значение» (ITEM-02)", () => {
    const { category, ...rest } = validBase;
    void category;
    const result = itemInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(messageFor(result, "category")).toBe("Выберите значение");
  });

  it("отклоняет невалидное значение urgency с текстом «Выберите значение» (ITEM-02)", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      urgency: "not-a-valid-key",
    });
    expect(result.success).toBe(false);
    expect(messageFor(result, "urgency")).toBe("Выберите значение");
  });

  it("отклоняет отсутствующие need и benefit с текстом «Выберите значение» (ITEM-02)", () => {
    const result = itemInputSchema.safeParse({ title: "Молоко", category: "home" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "need")).toBe("Выберите значение");
    expect(messageFor(result, "benefit")).toBe("Выберите значение");
  });
});

describe("itemInputSchema — link (ITEM-03)", () => {
  it("отклоняет некорректную ссылку с текстом «Введите корректную ссылку»", () => {
    const result = itemInputSchema.safeParse({ ...validBase, link: "not-a-url" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "link")).toBe("Введите корректную ссылку");
  });

  it("принимает пустую строку link как undefined", () => {
    const result = itemInputSchema.safeParse({ ...validBase, link: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.link).toBeUndefined();
  });

  it("принимает корректный url", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      link: "https://shop.example/item",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.link).toBe("https://shop.example/item");
  });
});

describe("itemInputSchema — price (ITEM-03, Pitfall 5)", () => {
  it("превращает пустую строку в undefined (НЕ 0)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, price: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price).toBeUndefined();
  });

  it("отклоняет нечисловое значение с текстом «Введите число»", () => {
    const result = itemInputSchema.safeParse({ ...validBase, price: "abc" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "price")).toBe("Введите число");
  });

  it("отклоняет отрицательное значение с текстом «Значение не может быть отрицательным»", () => {
    const result = itemInputSchema.safeParse({ ...validBase, price: "-5" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "price")).toBe(
      "Значение не может быть отрицательным"
    );
  });

  it("coerce строкового числа в number", () => {
    const result = itemInputSchema.safeParse({ ...validBase, price: "12.5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price).toBe(12.5);
  });
});

describe("itemInputSchema — monthlyPayment (ITEM-04, Pitfall 6 — всегда optional)", () => {
  it("валиден при отсутствии поля и isCredit=false", () => {
    const result = itemInputSchema.safeParse({ ...validBase, isCredit: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.monthlyPayment).toBeUndefined();
  });

  it("валиден при isCredit=true без monthlyPayment (условна только видимость в UI)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, isCredit: true });
    expect(result.success).toBe(true);
  });

  it("отклоняет отрицательный monthlyPayment", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      monthlyPayment: "-1",
    });
    expect(result.success).toBe(false);
    expect(messageFor(result, "monthlyPayment")).toBe(
      "Значение не может быть отрицательным"
    );
  });
});

describe("itemInputSchema — deadline (ITEM-03)", () => {
  it("превращает пустую строку в undefined", () => {
    const result = itemInputSchema.safeParse({ ...validBase, deadline: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deadline).toBeUndefined();
  });

  it("coerce строковой даты в Date", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      deadline: "2026-08-05",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deadline).toBeInstanceOf(Date);
  });
});

describe("itemInputSchema — doubts (ITEM-05, D-01)", () => {
  it("подставляет default «sure» при отсутствии поля", () => {
    const result = itemInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.doubts).toBe("sure");
  });

  it("принимает валидный ключ doubts", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      doubts: "strongDoubt",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.doubts).toBe("strongDoubt");
  });
});

describe("itemInputSchema — description (IN-02)", () => {
  it("превращает пустую строку в undefined (в БД → NULL, не «»)", () => {
    const result = itemInputSchema.safeParse({ ...validBase, description: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it("превращает строку из одних пробелов в undefined", () => {
    const result = itemInputSchema.safeParse({ ...validBase, description: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBeUndefined();
  });

  it("сохраняет непустое описание", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      description: "Домашнее",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toBe("Домашнее");
  });
});

describe("itemInputSchema — полные payload'ы", () => {
  it("принимает payload только с обязательными полями", () => {
    const result = itemInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("принимает payload со всеми необязательными полями", () => {
    const result = itemInputSchema.safeParse({
      ...validBase,
      link: "https://shop.example/item",
      description: "Домашнее",
      price: "99.90",
      deadline: "2026-08-05",
      doubts: "doubt",
      isCredit: true,
      monthlyPayment: "10",
    });
    expect(result.success).toBe(true);
  });
});
