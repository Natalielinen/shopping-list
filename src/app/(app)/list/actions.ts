"use server";

import { requireUser } from "@/server/auth/current-user";
import { setItemPurchasedForUser } from "@/server/repos/items";

// Server Action смены статуса «куплено» (LIST-04 / D-04/D-08) — зеркалит форму
// deleteItem (без payload-валидации; единственная защита — scoping по userId из
// сессии). Отметка недеструктивна и обратима (D-05): purchased=true уводит
// покупку в архив, false — возвращает в активные.
//
// Безопасность:
//   - userId берётся ТОЛЬКО из серверной сессии через requireUser() (T-4-01/T-4-06),
//     НИКОГДА из аргумента — mass-assignment владельца невозможен (T-4-04).
//   - `purchased` приводится к строгому boolean (never-trust-client V5 / T-4-05).
//   - setItemPurchasedForUser скоупит UPDATE по userId → чужой статус изменить нельзя.
//
// Навигация: action НЕ вызывает redirect() (Pitfall 6 — NEXT_REDIRECT кинулся бы и
// был пойман try/catch). Возвращает результат-объект; ресинк (router.refresh) —
// на клиенте.
const STATUS_ERROR = "Не удалось обновить статус. Попробуйте ещё раз.";

export type SetPurchasedResult = { ok: true } | { ok: false; error: string };

export async function setItemPurchased(
  id: string,
  purchased: boolean
): Promise<SetPurchasedResult> {
  // userId — из сессии; при отсутствии сессии бросает до любой записи (T-4-01).
  const user = await requireUser();

  // V5: приводим недоверенный аргумент к строгому boolean (T-4-05).
  const next = purchased === true;

  try {
    const row = await setItemPurchasedForUser(user.id, id, next);
    // WR-01: репозиторий возвращает null, если WHERE не нашёл строку (чужая или
    // несуществующая покупка — no-op). Не рапортуем об успехе: no-op ≠ успех.
    if (!row) return { ok: false, error: STATUS_ERROR };
    return { ok: true };
  } catch {
    return { ok: false, error: STATUS_ERROR };
  }
}
