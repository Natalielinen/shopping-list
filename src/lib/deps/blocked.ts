// Чистое производное прямой блокировки покупки (DEP-01 / D-02).
//
// Инварианты (CONTEXT D-02, RESEARCH §Pattern 3):
//   - Только примитивы на входе (dependsOn: id или null; dependencyPurchasedAt:
//     Date/число epoch-ms/null/undefined). Никаких Date.now()/I/O — «сейчас»
//     не нужен: блокировка зависит лишь от факта покупки зависимости.
//   - Чистая функция без побочных эффектов и внешних импортов (образец
//     src/lib/list/sort.ts). Вход не мутируется.
//   - Блокировка ПРЯМАЯ, не транзитивная — без рекурсии/обхода графа (D-02):
//     заблокирована ⇔ есть зависимость И она ещё не куплена.
//   - dependencyPurchasedAt нормализуется: null/undefined → «не куплена»;
//     любое non-null значение (Date или число, включая 0) → «куплена».

/** Покупка заблокирована ⇔ есть зависимость И зависимость ещё не куплена (DEP-01 / D-02). */
export function isBlocked(
  dependsOn: string | null,
  dependencyPurchasedAt: Date | number | null | undefined
): boolean {
  return dependsOn !== null && (dependencyPurchasedAt ?? null) === null;
}
