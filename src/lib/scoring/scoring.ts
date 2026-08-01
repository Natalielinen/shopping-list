// Чистый движок подсчёта очков приоритета покупки.
//
// Инварианты (CONTEXT D-01…D-05, RESEARCH Pattern 1 / Pitfalls 1-3):
//   - Источник «сейчас» — ТОЛЬКО параметр `now: Date`; функции никогда не читают
//     системное время внутри себя (детерминизм тестов + вычисление на чтении, SCORE-05).
//   - Просрочка: любой `days < 0` даёт фиксированные +100 ДО применения clamp (D-04).
//   - `total`/`deadlinePoints` не кэшируются и не хранятся в БД — считаются заново
//     на каждый вызов (SCORE-05).

import { differenceInCalendarDays } from "date-fns";

import {
  BENEFIT_POINTS,
  CATEGORY_POINTS,
  DOUBTS_POINTS,
  NEED_POINTS,
  URGENCY_POINTS,
  type BenefitType,
  type CategoryType,
  type DoubtsType,
  type NeedType,
  type UrgencyType,
} from "@/lib/scoring/scales";

/** Поля покупки, участвующие в подсчёте очков (price/monthlyPayment исключены). */
export interface ScoredFields {
  category: CategoryType;
  urgency: UrgencyType;
  need: NeedType;
  benefit: BenefitType;
  doubts: DoubtsType;
  isCredit: boolean;
  deadline: Date | null;
}

/** Один знаковый вклад в итог для разбивки приоритета (LIST-07). */
export interface Contribution {
  /** Ключ поля (английский, для программного использования). */
  key: string;
  /** Русская подпись поля для UI. */
  label: string;
  /** Знаковое количество очков этого вклада. */
  points: number;
}

const CREDIT_PENALTY = 2;

const clamp = (value: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, value));

/**
 * Очки дедлайна (SCORE-02 + D-04).
 *   - без дедлайна → 0
 *   - просрочка (дни < 0) → фиксированные +100 (ДО clamp — просрочка = самый срочный случай)
 *   - иначе → clamp(28 − дни_до_дедлайна, −100, 100)
 * Дни считаются как целые КАЛЕНДАРНЫЕ дни (date-fns), а не ручной арифметикой мс.
 */
export function deadlinePoints(deadline: Date | null, now: Date): number {
  if (!deadline) return 0;
  const days = differenceInCalendarDays(deadline, now);
  if (days < 0) return 100;
  return clamp(28 - days, -100, 100);
}

/**
 * Итоговые очки приоритета (SCORE-01, D-05): простая знаковая сумма всех очковых
 * полей + deadlinePoints + doubts − штраф за кредит. Детерминирована через `now`.
 */
export function computeTotal(item: ScoredFields, now: Date): number {
  return (
    CATEGORY_POINTS[item.category] +
    URGENCY_POINTS[item.urgency] +
    NEED_POINTS[item.need] +
    BENEFIT_POINTS[item.benefit] +
    deadlinePoints(item.deadline, now) +
    DOUBTS_POINTS[item.doubts] -
    (item.isCredit ? CREDIT_PENALTY : 0)
  );
}

/**
 * Разбивка итога по полям (LIST-07): по одному знаковому вкладу на присутствующее
 * очковое поле. Сумма `points` всех вкладов равна `computeTotal(item, now)`.
 * Строка «Кредит» присутствует только при isCredit; «Срок» — только при заданном
 * дедлайне.
 */
export function computeBreakdown(item: ScoredFields, now: Date): Contribution[] {
  const breakdown: Contribution[] = [
    { key: "category", label: "Категория", points: CATEGORY_POINTS[item.category] },
    { key: "urgency", label: "Срочность", points: URGENCY_POINTS[item.urgency] },
    { key: "need", label: "Необходимость", points: NEED_POINTS[item.need] },
    { key: "benefit", label: "Выгода", points: BENEFIT_POINTS[item.benefit] },
    { key: "doubts", label: "Сомнения", points: DOUBTS_POINTS[item.doubts] },
  ];

  if (item.deadline) {
    breakdown.push({
      key: "deadline",
      label: "Срок",
      points: deadlinePoints(item.deadline, now),
    });
  }

  if (item.isCredit) {
    breakdown.push({ key: "credit", label: "Кредит", points: -CREDIT_PENALTY });
  }

  return breakdown;
}

/** Пороги уровней badge приоритета (LIST-06, D-10 / UI-SPEC). */
export const PRIORITY_THRESHOLDS = { high: 30, medium: 10 } as const;

export type PriorityLevel = "high" | "medium" | "low";

/**
 * Уровень приоритета по итогу (LIST-06, D-10):
 *   total ≥ 30 → high; 10 ≤ total < 30 → medium; total < 10 → low.
 */
export function priorityLevel(total: number): PriorityLevel {
  if (total >= PRIORITY_THRESHOLDS.high) return "high";
  if (total >= PRIORITY_THRESHOLDS.medium) return "medium";
  return "low";
}
