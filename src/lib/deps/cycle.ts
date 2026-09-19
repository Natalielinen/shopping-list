// Авторитетная серверная защита от циклов при выборе зависимости (ITEM-06 / D-05).
//
// Инварианты (CONTEXT D-05, RESEARCH §Pattern 2):
//   - Только ReadonlyMap примитивов на входе (id → dependsOn, где загружены
//     ТОЛЬКО свои покупки пользователя в Server Action). Никаких I/O/импортов —
//     чистая детерминированная функция (образец src/lib/list/sort.ts).
//     Вход не мутируется (visited — локальный Set).
//   - sourceId === null (режим create): новой покупки ещё нет в графе, ни одна
//     цепочка не может её достичь → цикл невозможен → false.
//   - candidateId === sourceId → true (нельзя зависеть от себя, D-05).
//   - Обход цепочки depends_on от candidateId: цикл, если цепочка достигает
//     sourceId. visited-set ограничивает обход даже при уже испорченной
//     (циклической) БД — каждый узел посещается один раз, глубина ≤ числа
//     покупок пользователя (DoS-безопасно, break при повторном узле).

/** true, если назначение candidateId зависимостью для sourceId создаст цикл (D-05). */
export function wouldCreateCycle(
  map: ReadonlyMap<string, string | null>,
  sourceId: string | null,
  candidateId: string
): boolean {
  if (sourceId !== null && candidateId === sourceId) return true; // self (D-05)
  if (sourceId === null) return false; // create: цикл невозможен

  const visited = new Set<string>();
  let current: string | null = candidateId;
  while (current !== null) {
    if (current === sourceId) return true; // цепочка кандидата достигает source → цикл
    if (visited.has(current)) break; // защита от pre-existing corrupt cycle
    visited.add(current);
    current = map.get(current) ?? null;
  }
  return false;
}
