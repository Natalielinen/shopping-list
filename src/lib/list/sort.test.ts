import { describe, expect, it } from "vitest";

import {
  partitionByPurchased,
  sortActive,
  sortPurchased,
  type ListItem,
} from "@/lib/list/sort";

// Фабрика тестовых элементов. Все входы — примитивы (total/createdAtMs/
// purchasedAtMs), как их отдаёт RSC (§Pitfall 4): никаких Date внутри модуля.
const makeItem = (overrides: Partial<ListItem> = {}): ListItem => ({
  id: "a",
  title: "item",
  total: 0,
  createdAtMs: 0,
  purchasedAtMs: null,
  ...overrides,
});

const ids = (items: ListItem[]) => items.map((it) => it.id);

describe("sortActive — priority (LIST-01, D-02)", () => {
  it("при разных total: больший total выше", () => {
    const items = [
      makeItem({ id: "low", total: 5 }),
      makeItem({ id: "high", total: 40 }),
      makeItem({ id: "mid", total: 20 }),
    ];
    expect(ids(sortActive(items, "priority"))).toEqual(["high", "mid", "low"]);
  });

  it("при равном total: больший createdAtMs выше (tiebreaker 1)", () => {
    const items = [
      makeItem({ id: "old", total: 10, createdAtMs: 100 }),
      makeItem({ id: "new", total: 10, createdAtMs: 300 }),
      makeItem({ id: "mid", total: 10, createdAtMs: 200 }),
    ];
    expect(ids(sortActive(items, "priority"))).toEqual(["new", "mid", "old"]);
  });

  it("при равных total и createdAtMs: финальный tiebreaker по id (localeCompare возр.)", () => {
    const items = [
      makeItem({ id: "c", total: 10, createdAtMs: 100 }),
      makeItem({ id: "a", total: 10, createdAtMs: 100 }),
      makeItem({ id: "b", total: 10, createdAtMs: 100 }),
    ];
    expect(ids(sortActive(items, "priority"))).toEqual(["a", "b", "c"]);
  });

  it("корректно упорядочивает отрицательные total", () => {
    const items = [
      makeItem({ id: "neg", total: -10 }),
      makeItem({ id: "zero", total: 0 }),
      makeItem({ id: "pos", total: 3 }),
    ];
    expect(ids(sortActive(items, "priority"))).toEqual(["pos", "zero", "neg"]);
  });
});

describe("sortActive — createdAt (LIST-02, D-02)", () => {
  it("новые сверху: больший createdAtMs выше", () => {
    const items = [
      makeItem({ id: "old", createdAtMs: 100 }),
      makeItem({ id: "new", createdAtMs: 300 }),
      makeItem({ id: "mid", createdAtMs: 200 }),
    ];
    expect(ids(sortActive(items, "createdAt"))).toEqual(["new", "mid", "old"]);
  });

  it("при равном createdAtMs: tiebreaker по id", () => {
    const items = [
      makeItem({ id: "b", createdAtMs: 100 }),
      makeItem({ id: "a", createdAtMs: 100 }),
    ];
    expect(ids(sortActive(items, "createdAt"))).toEqual(["a", "b"]);
  });

  it("порядок createdAt не зависит от total", () => {
    const items = [
      makeItem({ id: "old", createdAtMs: 100, total: 999 }),
      makeItem({ id: "new", createdAtMs: 300, total: -50 }),
    ];
    expect(ids(sortActive(items, "createdAt"))).toEqual(["new", "old"]);
  });
});

describe("sortActive — title (LIST-03, D-02, Pitfall 5)", () => {
  it("сортирует по алфавиту для локали 'ru'", () => {
    const items = [
      makeItem({ id: "3", title: "Яблоко" }),
      makeItem({ id: "1", title: "Арбуз" }),
      makeItem({ id: "2", title: "Банан" }),
    ];
    expect(ids(sortActive(items, "title"))).toEqual(["1", "2", "3"]);
  });

  it("case-insensitive (sensitivity: base): «Молоко»/«молоко» не расходятся по регистру — решает tiebreaker createdAtMs убыв.", () => {
    const items = [
      makeItem({ id: "lower-old", title: "молоко", createdAtMs: 100 }),
      makeItem({ id: "upper-new", title: "Молоко", createdAtMs: 300 }),
    ];
    // Заголовки base-равны → порядок определяет createdAtMs убыв.: new выше.
    expect(ids(sortActive(items, "title"))).toEqual(["upper-new", "lower-old"]);
  });

  it("Ё и регистр: «Ёлка»/«ёлка» base-равны — регистр не разбивает порядок, решает createdAtMs", () => {
    const items = [
      makeItem({ id: "e-old", title: "ёлка", createdAtMs: 100 }),
      makeItem({ id: "E-new", title: "Ёлка", createdAtMs: 300 }),
    ];
    expect(ids(sortActive(items, "title"))).toEqual(["E-new", "e-old"]);
  });

  it("при равных заголовках: createdAtMs убыв. → id", () => {
    const items = [
      makeItem({ id: "z", title: "Хлеб", createdAtMs: 100 }),
      makeItem({ id: "a", title: "Хлеб", createdAtMs: 100 }),
      makeItem({ id: "m", title: "Хлеб", createdAtMs: 200 }),
    ];
    expect(ids(sortActive(items, "title"))).toEqual(["m", "a", "z"]);
  });
});

describe("partitionByPurchased (LIST-04, D-07)", () => {
  it("делит по purchasedAtMs === null (active) против non-null (purchased)", () => {
    const items = [
      makeItem({ id: "a1", purchasedAtMs: null }),
      makeItem({ id: "p1", purchasedAtMs: 500 }),
      makeItem({ id: "a2", purchasedAtMs: null }),
      makeItem({ id: "p2", purchasedAtMs: 600 }),
    ];
    const { active, purchased } = partitionByPurchased(items);
    expect(ids(active)).toEqual(["a1", "a2"]);
    expect(ids(purchased)).toEqual(["p1", "p2"]);
  });

  it("purchasedAtMs === 0 считается купленной (non-null), не активной", () => {
    const items = [makeItem({ id: "zero", purchasedAtMs: 0 })];
    const { active, purchased } = partitionByPurchased(items);
    expect(ids(active)).toEqual([]);
    expect(ids(purchased)).toEqual(["zero"]);
  });

  it("сохраняет исходный порядок входа до сортировки", () => {
    const items = [
      makeItem({ id: "b", purchasedAtMs: null }),
      makeItem({ id: "a", purchasedAtMs: null }),
    ];
    expect(ids(partitionByPurchased(items).active)).toEqual(["b", "a"]);
  });
});

describe("sortPurchased (LIST-05, Pitfall 1)", () => {
  it("всегда сортирует по purchasedAt убыв. (больший purchasedAtMs выше)", () => {
    const items = [
      makeItem({ id: "early", purchasedAtMs: 100 }),
      makeItem({ id: "late", purchasedAtMs: 300 }),
      makeItem({ id: "mid", purchasedAtMs: 200 }),
    ];
    expect(ids(sortPurchased(items))).toEqual(["late", "mid", "early"]);
  });

  it("при равном purchasedAtMs: tiebreaker по id", () => {
    const items = [
      makeItem({ id: "b", purchasedAtMs: 500 }),
      makeItem({ id: "a", purchasedAtMs: 500 }),
    ];
    expect(ids(sortPurchased(items))).toEqual(["a", "b"]);
  });

  it("порядок архива НЕ зависит от total/title (независимость от sortKey активного списка)", () => {
    const items = [
      makeItem({ id: "early", purchasedAtMs: 100, total: 999, title: "Аaa" }),
      makeItem({ id: "late", purchasedAtMs: 300, total: -50, title: "Яяя" }),
    ];
    expect(ids(sortPurchased(items))).toEqual(["late", "early"]);
  });
});

describe("иммутабельность (не мутируют вход)", () => {
  it("sortActive возвращает новый массив, исходный порядок входа сохранён", () => {
    const items = [
      makeItem({ id: "low", total: 5 }),
      makeItem({ id: "high", total: 40 }),
    ];
    const before = ids(items);
    const sorted = sortActive(items, "priority");
    expect(sorted).not.toBe(items);
    expect(ids(items)).toEqual(before); // вход не тронут
  });

  it("sortPurchased возвращает новый массив, вход не мутируется", () => {
    const items = [
      makeItem({ id: "early", purchasedAtMs: 100 }),
      makeItem({ id: "late", purchasedAtMs: 300 }),
    ];
    const before = ids(items);
    const sorted = sortPurchased(items);
    expect(sorted).not.toBe(items);
    expect(ids(items)).toEqual(before);
  });
});
