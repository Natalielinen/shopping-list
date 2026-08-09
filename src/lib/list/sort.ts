// Чистая детерминированная логика сортировки и партиционирования списка покупок.
//
// Инварианты (CONTEXT D-02/D-03/D-07, RESEARCH §Code Examples / Pitfalls 1,4,5):
//   - Только примитивы на входе (total, createdAtMs, purchasedAtMs, title, id).
//     Никаких Date/Date.now() в рантайме — «сейчас» и getTime() посчитаны в RSC
//     до передачи клиенту (детерминизм, отсутствие hydration-mismatch, §Pitfall 4).
//   - Все функции чисты и не мутируют вход ([...items].sort).
//   - Активный список сортируется выбранным ключом (Select); секция «Куплено»
//     ВСЕГДА по purchasedAt убыв., независимо от sortKey (§Pitfall 1).

/** Ключ сортировки активного списка (LIST-01/02/03). */
export type SortKey = "priority" | "createdAt" | "title";

/** Минимальная форма элемента, которую RSC отдаёт клиенту (только примитивы). */
export interface ListItem {
  id: string;
  /** computeTotal(item, now), посчитан в RSC. */
  total: number;
  /** item.createdAt.getTime(), посчитан в RSC. */
  createdAtMs: number;
  /** item.purchasedAt?.getTime() ?? null; null = активна (D-07). */
  purchasedAtMs: number | null;
  title: string;
}

/**
 * Делит элементы на активные (purchasedAtMs === null) и купленные (non-null,
 * включая 0). Исходный порядок входа сохраняется — сортировка применяется отдельно.
 */
export function partitionByPurchased(items: ListItem[]): {
  active: ListItem[];
  purchased: ListItem[];
} {
  const active: ListItem[] = [];
  const purchased: ListItem[] = [];
  for (const it of items) {
    (it.purchasedAtMs === null ? active : purchased).push(it);
  }
  return { active, purchased };
}

// Приватные компараторы с детерминированными tiebreakers (D-02). Финальный
// tiebreaker — a.id.localeCompare(b.id) — гарантирует стабильный полный порядок.

const byPriority = (a: ListItem, b: ListItem): number =>
  b.total - a.total || b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id);

const byCreatedAt = (a: ListItem, b: ListItem): number =>
  b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id);

const byTitle = (a: ListItem, b: ListItem): number =>
  a.title.localeCompare(b.title, "ru", { sensitivity: "base" }) ||
  b.createdAtMs - a.createdAtMs ||
  a.id.localeCompare(b.id);

// Архив всегда по purchasedAt убыв. (§Pitfall 1), tiebreak id. `?? 0` — защита
// типов: в отсортированную секцию попадают только non-null purchasedAtMs.
const byPurchasedAtDesc = (a: ListItem, b: ListItem): number =>
  (b.purchasedAtMs ?? 0) - (a.purchasedAtMs ?? 0) || a.id.localeCompare(b.id);

const COMPARATORS: Record<SortKey, (a: ListItem, b: ListItem) => number> = {
  priority: byPriority,
  createdAt: byCreatedAt,
  title: byTitle,
};

/** Сортирует активный список выбранным ключом. Не мутирует вход. */
export function sortActive(items: ListItem[], key: SortKey): ListItem[] {
  return [...items].sort(COMPARATORS[key]);
}

/** Сортирует архив всегда по purchasedAt убыв. (независимо от sortKey). Не мутирует вход. */
export function sortPurchased(items: ListItem[]): ListItem[] {
  return [...items].sort(byPurchasedAtDesc);
}
