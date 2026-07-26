// @vitest-environment node
import { describe, expect, it } from "vitest";

import { auth } from "@/lib/auth";

// Юнит-ассерты по зафиксированным решениям конфигурации Better Auth.
describe("Конфигурация Better Auth", () => {
  it("session.expiresIn задан явно в 30 дней (D-11), а не дефолтные 7", () => {
    expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 30);
    expect(auth.options.session?.expiresIn).toBe(2592000);
  });

  it("пароли хешируются Argon2id (D-12) — хеш начинается с $argon2id$", async () => {
    const hasher = auth.options.emailAndPassword?.password?.hash;
    expect(typeof hasher).toBe("function");

    const hashed = await hasher!("password123");
    expect(hashed.startsWith("$argon2id$")).toBe(true);
  });
});
