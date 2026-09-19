import { describe, expect, it } from "vitest";

import { isBlocked } from "@/lib/deps/blocked";

// Прямая (не транзитивная) блокировка (DEP-01 / D-02): покупка заблокирована ⇔
// есть зависимость И зависимость ещё не куплена. Вход — только примитивы;
// dependencyPurchasedAt нормализуется как null при null/undefined.
describe("isBlocked (DEP-01 / D-02)", () => {
  it.each<[string, string | null, Date | number | null | undefined, boolean]>([
    ["нет зависимости (dependsOn null) → не заблокирована", null, null, false],
    ["нет зависимости даже при купленной dependency-дате", null, new Date(), false],
    ["есть зависимость, dependencyPurchasedAt null → заблокирована", "dep-1", null, true],
    ["есть зависимость, dependencyPurchasedAt undefined → заблокирована", "dep-1", undefined, true],
    ["есть зависимость, dependencyPurchasedAt = Date → разблокирована", "dep-1", new Date(), false],
    ["есть зависимость, dependencyPurchasedAt = 0 (epoch ms) → разблокирована", "dep-1", 0, false],
  ])("%s", (_label, dependsOn, dependencyPurchasedAt, expected) => {
    expect(isBlocked(dependsOn, dependencyPurchasedAt)).toBe(expected);
  });

  it("канонические примеры из acceptance_criteria", () => {
    expect(isBlocked(null, null)).toBe(false);
    expect(isBlocked("x", null)).toBe(true);
    expect(isBlocked("x", new Date())).toBe(false);
  });
});
