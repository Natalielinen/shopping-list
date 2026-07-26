import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validation/auth";

function messageFor(
  result: ReturnType<typeof registerSchema.safeParse>,
  field: string
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("registerSchema", () => {
  it("отклоняет пустой email с текстом из UI-SPEC", () => {
    const result = registerSchema.safeParse({ email: "", password: "12345678" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "email")).toBe("Введите корректный email");
  });

  it("отклоняет пароль из 7 символов (граница D-03)", () => {
    const result = registerSchema.safeParse({
      email: "a@test.dev",
      password: "1234567",
    });
    expect(result.success).toBe(false);
    expect(messageFor(result, "password")).toBe(
      "Пароль должен содержать минимум 8 символов"
    );
  });

  it("принимает валидный email и пароль ровно из 8 символов", () => {
    const result = registerSchema.safeParse({
      email: "a@test.dev",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("отклоняет пустой пароль с текстом «Заполните это поле»", () => {
    const result = loginSchema.safeParse({ email: "a@test.dev", password: "" });
    expect(result.success).toBe(false);
    expect(messageFor(result, "password")).toBe("Заполните это поле");
  });

  it("принимает валидную пару email + password", () => {
    const result = loginSchema.safeParse({
      email: "a@test.dev",
      password: "secret1",
    });
    expect(result.success).toBe(true);
  });
});
