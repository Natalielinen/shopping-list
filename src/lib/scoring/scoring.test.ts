import { describe, expect, it } from "vitest";

import {
  BENEFIT_POINTS,
  CATEGORY_POINTS,
  DOUBTS_POINTS,
  NEED_POINTS,
  URGENCY_POINTS,
} from "@/lib/scoring/scales";
import {
  computeBreakdown,
  computeTotal,
  deadlinePoints,
  priorityLevel,
  PRIORITY_THRESHOLDS,
  type ScoredFields,
} from "@/lib/scoring/scoring";

// Фиксированный «сейчас» — локальная дата через числовые аргументы (не ISO-строка,
// RESEARCH Pitfall 4). 1 августа 2026. Все дедлайны в тестах строятся как
// new Date(2026, 7, 1 + N) — JS нормализует переполнение дня, оставаясь в
// локальном времени и детерминированным.
const NOW = new Date(2026, 7, 1);
const dayOffset = (n: number) => new Date(2026, 7, 1 + n);

describe("deadlinePoints (D-04, SCORE-02)", () => {
  it("без дедлайна возвращает 0", () => {
    expect(deadlinePoints(null, NOW)).toBe(0);
  });

  it.each([
    ["сегодня (0 дней)", 0, 28],
    ["+1 день", 1, 27],
    ["+28 дней", 28, 0],
    ["+40 дней", 40, -12],
    ["+128 дней (нижний clamp)", 128, -100],
  ])("дедлайн %s → %i очков", (_label, offset, expected) => {
    expect(deadlinePoints(dayOffset(offset as number), NOW)).toBe(expected);
  });

  it("любая просрочка (дни < 0) даёт фиксированные +100 ДО clamp (D-04)", () => {
    expect(deadlinePoints(dayOffset(-1), NOW)).toBe(100); // вчера
    expect(deadlinePoints(dayOffset(-80), NOW)).toBe(100); // давняя просрочка
  });

  it("нижняя граница clamp — не ниже -100 при очень далёком дедлайне", () => {
    expect(deadlinePoints(dayOffset(500), NOW)).toBe(-100);
  });

  // WR-01: `deadline` из <input type="date"> приходит через z.coerce.date() как
  // UTC-полночь (new Date("2026-08-15")). Разница должна считаться в едином UTC-
  // кадре, а не в локальной зоне рантайма — иначе для отрицательных смещений UTC
  // возникает сдвиг на день. Даты ниже — фиксированные UTC-инстанты, поэтому
  // результат детерминирован независимо от TZ машины, где идут тесты.
  describe("устойчивость к таймзоне (WR-01)", () => {
    const utcDate = (iso: string) => new Date(iso); // "YYYY-MM-DD" → UTC-полночь

    it("дедлайн +14 дней (UTC-полночь) → 28 − 14 = 14 в любой TZ", () => {
      expect(deadlinePoints(utcDate("2026-08-15"), utcDate("2026-08-01"))).toBe(14);
    });

    it("дедлайн сегодня (обе даты UTC-полночь) → +28", () => {
      expect(deadlinePoints(utcDate("2026-08-01"), utcDate("2026-08-01"))).toBe(28);
    });

    it("просроченный на день дедлайн (UTC) → фиксированные +100", () => {
      expect(deadlinePoints(utcDate("2026-07-31"), utcDate("2026-08-01"))).toBe(100);
    });
  });
});

describe("CATEGORY_POINTS (SCORE-06, SUMMARY.md)", () => {
  it.each([
    ["health", 10],
    ["study", 8],
    ["work", 7],
    ["clothing", 5],
    ["home", 4],
    ["repair", 3],
    ["hobby", 1],
    ["entertainment", 0],
    ["unnecessary", -10],
    ["hygiene", 6],
    ["beauty", 2],
    ["misc", 1],
    ["toys", -1],
    ["pets", 2],
  ])("%s = %i", (key, points) => {
    expect(CATEGORY_POINTS[key as keyof typeof CATEGORY_POINTS]).toBe(points);
  });
});

describe("URGENCY_POINTS (SCORE-06, D-03)", () => {
  it.each([
    ["vital", 12],
    ["extra", 10],
    ["veryUrgent", 4],
    ["urgent", 3],
    ["notVeryUrgent", 2],
    ["notUrgent", 1],
  ])("%s = %i", (key, points) => {
    expect(URGENCY_POINTS[key as keyof typeof URGENCY_POINTS]).toBe(points);
  });

  it("«Жизненно важно» (vital) === 12 и это максимум шкалы (выше extra=10, D-03)", () => {
    expect(URGENCY_POINTS.vital).toBe(12);
    expect(URGENCY_POINTS.vital).toBeGreaterThan(URGENCY_POINTS.extra);
    expect(Math.max(...Object.values(URGENCY_POINTS))).toBe(URGENCY_POINTS.vital);
  });
});

describe("NEED_POINTS (SCORE-06, SUMMARY.md)", () => {
  it.each([
    ["needed", 1],
    ["wanted", 0],
    ["neededAndWanted", 2],
  ])("%s = %i", (key, points) => {
    expect(NEED_POINTS[key as keyof typeof NEED_POINTS]).toBe(points);
  });
});

describe("BENEFIT_POINTS (SCORE-06, D-02)", () => {
  it.each([
    ["savesResources", 1],
    ["spendsResources", -1],
    ["noBenefit", 0],
    ["income", 2],
    ["overpriced", -2],
  ])("%s = %i", (key, points) => {
    expect(BENEFIT_POINTS[key as keyof typeof BENEFIT_POINTS]).toBe(points);
  });
});

describe("DOUBTS_POINTS (SCORE-04, D-01)", () => {
  it.each([
    ["sure", 0],
    ["doubt", -1],
    ["strongDoubt", -3],
  ])("%s = %i", (key, points) => {
    expect(DOUBTS_POINTS[key as keyof typeof DOUBTS_POINTS]).toBe(points);
  });
});

// Базовый пример из SUMMARY: здоровье 10 + vital 12 + «и нужно и хочется» 2 +
// income 2 + срок сегодня 28 + sure 0 − 0 = 54.
const baseItem: ScoredFields = {
  category: "health",
  urgency: "vital",
  need: "neededAndWanted",
  benefit: "income",
  doubts: "sure",
  isCredit: false,
  deadline: NOW,
};

describe("computeTotal (SCORE-01, D-05)", () => {
  it("суммирует все очковые поля + deadlinePoints (пример SUMMARY = 54)", () => {
    expect(computeTotal(baseItem, NOW)).toBe(54);
  });

  it("isCredit=true вычитает ровно 2 очка (SCORE-03)", () => {
    expect(computeTotal({ ...baseItem, isCredit: true }, NOW)).toBe(52);
  });

  it("doubts применяет свой штраф (strongDoubt = −3)", () => {
    expect(computeTotal({ ...baseItem, doubts: "strongDoubt" }, NOW)).toBe(51);
  });

  it("price/monthlyPayment НЕ участвуют в сумме (display-only)", () => {
    const withPrice = {
      ...baseItem,
      price: 999999,
      monthlyPayment: 50000,
    } as ScoredFields;
    expect(computeTotal(withPrice, NOW)).toBe(computeTotal(baseItem, NOW));
  });

  it("детерминирован: одинаковый item + одинаковый now дают одинаковый результат (SCORE-05)", () => {
    expect(computeTotal(baseItem, NOW)).toBe(computeTotal(baseItem, NOW));
  });

  it("смена now меняет только вклад дедлайна", () => {
    const later = dayOffset(1); // +1 день до дедлайна теперь -1 день = сегодня→завтра
    // deadline=NOW; при now=NOW дедлайн сегодня (+28); при now=NOW+1 дедлайн вчера (+100)
    const delta = computeTotal(baseItem, later) - computeTotal(baseItem, NOW);
    expect(delta).toBe(
      deadlinePoints(NOW, later) - deadlinePoints(NOW, NOW)
    );
  });
});

describe("priorityLevel (LIST-06, D-10)", () => {
  it("пороги high=30 / medium=10", () => {
    expect(PRIORITY_THRESHOLDS.high).toBe(30);
    expect(PRIORITY_THRESHOLDS.medium).toBe(10);
  });

  it.each([
    [30, "high"],
    [55, "high"],
    [29, "medium"],
    [10, "medium"],
    [9, "low"],
    [-5, "low"],
  ])("total %i → %s", (total, level) => {
    expect(priorityLevel(total as number)).toBe(level);
  });
});

describe("computeBreakdown (LIST-07)", () => {
  it("сумма знаковых вкладов === computeTotal", () => {
    const bd = computeBreakdown(baseItem, NOW);
    const sum = bd.reduce((acc, c) => acc + c.points, 0);
    expect(sum).toBe(computeTotal(baseItem, NOW));
  });

  it("строка «Кредит» присутствует только при isCredit", () => {
    const noCredit = computeBreakdown(baseItem, NOW);
    expect(noCredit.some((c) => c.label === "Кредит")).toBe(false);

    const credit = computeBreakdown({ ...baseItem, isCredit: true }, NOW);
    const creditRow = credit.find((c) => c.label === "Кредит");
    expect(creditRow?.points).toBe(-2);
    expect(
      credit.reduce((acc, c) => acc + c.points, 0)
    ).toBe(computeTotal({ ...baseItem, isCredit: true }, NOW));
  });

  it("вклад «Срок» отсутствует при deadline=null, сумма всё равно === total", () => {
    const item = { ...baseItem, deadline: null };
    const bd = computeBreakdown(item, NOW);
    expect(bd.some((c) => c.label === "Срок")).toBe(false);
    expect(bd.reduce((acc, c) => acc + c.points, 0)).toBe(
      computeTotal(item, NOW)
    );
  });

  it("каждый вклад имеет метку поля и знаковое число", () => {
    const bd = computeBreakdown(baseItem, NOW);
    expect(bd.length).toBeGreaterThan(0);
    for (const c of bd) {
      expect(typeof c.label).toBe("string");
      expect(c.label.length).toBeGreaterThan(0);
      expect(typeof c.points).toBe("number");
    }
  });
});
