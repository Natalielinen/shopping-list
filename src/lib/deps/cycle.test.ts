import { describe, expect, it } from "vitest";

import { wouldCreateCycle } from "@/lib/deps/cycle";

// Авторитетная серверная защита от циклов при выборе зависимости (ITEM-06 / D-05).
// map: id → dependsOn (только СВОИ покупки пользователя). Обход цепочки
// depends_on от кандидата к source; visited-set ограничивает обход даже при
// уже испорченной (циклической) БД — каждый узел посещается один раз.
describe("wouldCreateCycle (D-05)", () => {
  it("self: sourceId !== null и candidateId === sourceId → true", () => {
    expect(wouldCreateCycle(new Map([["A", null]]), "A", "A")).toBe(true);
  });

  it("create-режим: sourceId === null → false для любого кандидата", () => {
    expect(wouldCreateCycle(new Map([["A", null]]), null, "A")).toBe(false);
    expect(wouldCreateCycle(new Map(), null, "x")).toBe(false);
  });

  it("транзитивный цикл: {A→null, B→A}, source=A, candidate=B → true (A↔B)", () => {
    const map = new Map<string, string | null>([
      ["A", null],
      ["B", "A"],
    ]);
    expect(wouldCreateCycle(map, "A", "B")).toBe(true);
  });

  it("безопасно: {A→null, B→null}, source=A, candidate=B → false", () => {
    const map = new Map<string, string | null>([
      ["A", null],
      ["B", null],
    ]);
    expect(wouldCreateCycle(map, "A", "B")).toBe(false);
  });

  it("глубокая цепочка не достигает source: {A→B, B→C, C→null}, source=A, candidate=C → false", () => {
    const map = new Map<string, string | null>([
      ["A", "B"],
      ["B", "C"],
      ["C", null],
    ]);
    expect(wouldCreateCycle(map, "A", "C")).toBe(false);
  });

  it("испорченная БД: {B→C, C→B} (уже цикл), source=A, candidate=B → завершается, false", () => {
    const map = new Map<string, string | null>([
      ["B", "C"],
      ["C", "B"],
    ]);
    expect(wouldCreateCycle(map, "A", "B")).toBe(false);
  });
});
