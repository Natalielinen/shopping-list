"use server";

import { requireUser } from "@/server/auth/current-user";
import { isBlocked } from "@/lib/deps/blocked";
import { findItemForUser, setItemPurchasedForUser } from "@/server/repos/items";

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

// Серверный guard блокировки (D-03 / T-05-02, UI-SPEC §Copywriting Contract).
// Дословный текст отклонения — тот же, что подпись «Заблокировано: …»; сервер
// возвращает его в ответе, чтобы обойдённый disabled-UI объяснил причину в тосте.
const BLOCKED_ERROR = "Сначала купите товар, от которого зависит эта покупка.";

export type SetPurchasedResult = { ok: true } | { ok: false; error: string };

export async function setItemPurchased(
  id: string,
  purchased: boolean
): Promise<SetPurchasedResult> {
  // userId — из сессии; при отсутствии сессии бросает до любой записи (T-4-01).
  const user = await requireUser();

  // V5: приводим недоверенный аргумент к строгому boolean (T-4-05).
  const next = purchased === true;

  // Guard блокировки (D-03 / T-05-02, Tampering) — defense-in-depth к disabled-
  // чекбоксу (never-trust-client): при отметке «куплено» заблокированной покупки
  // отклоняем ДО записи. Срабатывает ТОЛЬКО при next === true — снятие «куплено»
  // (next === false) всегда обратимо и guard не касается. Читаем саму покупку и её
  // зависимость через userId-scoped findItemForUser (IDOR-безопасно, T-05-01),
  // применяем чистый isBlocked (план 05-01); blocked нигде не хранится/не кэшируется.
  if (next) {
    try {
      const item = await findItemForUser(user.id, id);
      if (item?.dependsOn) {
        const dep = await findItemForUser(user.id, item.dependsOn);
        if (isBlocked(item.dependsOn, dep?.purchasedAt ?? null)) {
          return { ok: false, error: BLOCKED_ERROR };
        }
      }
    } catch {
      return { ok: false, error: STATUS_ERROR };
    }
  }

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
