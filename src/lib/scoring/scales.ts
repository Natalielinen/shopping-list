// Фиксированные шкалы очков приоритета покупки.
//
// ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ: SUMMARY.md (item schema + CategoryType/UrgencyType/
// NeedType/BenefitType) с учётом закрытых решений фазы:
//   D-01 — DoubtsType: sure 0 / doubt −1 / strongDoubt −3
//   D-02 — BenefitType: 5 пунктов ровно как в SUMMARY
//   D-03 — UrgencyType «Жизненно важно» (vital) = 12 (вершина шкалы, выше extra=10)
//
// Ключи enum — английские (устойчивы к переименованию UI-текстов, RESEARCH Open Q1);
// отображаемые русские подписи живут отдельной label-мапой в UI-слое.
//
// Каждая шкала типизирована как exhaustive `Record<Тип, number>`: пропуск любого
// ключа enum ловится компилятором TypeScript (без `?? 0`).

export const CATEGORY_VALUES = [
  "health",
  "study",
  "work",
  "clothing",
  "home",
  "repair",
  "hobby",
  "entertainment",
  "unnecessary",
  "hygiene",
  "beauty",
  "misc",
  "toys",
  "pets",
] as const;
export type CategoryType = (typeof CATEGORY_VALUES)[number];

export const URGENCY_VALUES = [
  "vital",
  "extra",
  "veryUrgent",
  "urgent",
  "notVeryUrgent",
  "notUrgent",
] as const;
export type UrgencyType = (typeof URGENCY_VALUES)[number];

export const NEED_VALUES = ["needed", "wanted", "neededAndWanted"] as const;
export type NeedType = (typeof NEED_VALUES)[number];

export const BENEFIT_VALUES = [
  "savesResources",
  "spendsResources",
  "noBenefit",
  "income",
  "overpriced",
] as const;
export type BenefitType = (typeof BENEFIT_VALUES)[number];

export const DOUBTS_VALUES = ["sure", "doubt", "strongDoubt"] as const;
export type DoubtsType = (typeof DOUBTS_VALUES)[number];

// CategoryType (SUMMARY.md, 14 пунктов)
export const CATEGORY_POINTS: Record<CategoryType, number> = {
  health: 10, // Здоровье
  study: 8, // Учеба
  work: 7, // Работа
  clothing: 5, // Одежда, обувь, аксессуары
  home: 4, // Дом
  repair: 3, // ремонт
  hobby: 1, // Хобби
  entertainment: 0, // Развлечения
  unnecessary: -10, // Не нужные хотелки
  hygiene: 6, // Гигиена
  beauty: 2, // Красота
  misc: 1, // Разное
  toys: -1, // игрушки
  pets: 2, // животные
};

// UrgencyType (SUMMARY.md + D-03)
export const URGENCY_POINTS: Record<UrgencyType, number> = {
  vital: 12, // Жизненно важно (D-03 — вершина шкалы)
  extra: 10, // экстра срочность
  veryUrgent: 4, // Очень срочно
  urgent: 3, // Срочно
  notVeryUrgent: 2, // Не очень срочно
  notUrgent: 1, // Не срочно
};

// NeedType (SUMMARY.md)
export const NEED_POINTS: Record<NeedType, number> = {
  needed: 1, // нужно
  wanted: 0, // хочется
  neededAndWanted: 2, // и нужно и хочется
};

// BenefitType (SUMMARY.md + D-02)
export const BENEFIT_POINTS: Record<BenefitType, number> = {
  savesResources: 1, // Экономит время/деньги/силы
  spendsResources: -1, // Расходует время/деньги/силы
  noBenefit: 0, // Никаких выгод
  income: 2, // Приносит доход
  overpriced: -2, // Тратит больше, чем стоит
};

// DoubtsType (D-01)
export const DOUBTS_POINTS: Record<DoubtsType, number> = {
  sure: 0, // Уверен(а)
  doubt: -1, // Сомневаюсь
  strongDoubt: -3, // Сильно сомневаюсь
};
