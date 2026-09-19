"use server";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { wouldCreateCycle } from "@/lib/deps/cycle";
import { requireUser } from "@/server/auth/current-user";
import {
  deleteItemForUser,
  findItemsForUser,
  updateItemForUser,
} from "@/server/repos/items";

// Server Action обновления покупки (ITEM-07 / D-03) — зеркалит createItem.
//
// Безопасность:
//   - userId берётся ТОЛЬКО из серверной сессии через requireUser() (T-3-01/T-3-03),
//     НИКОГДА из аргумента `input` — mass-assignment владельца невозможен.
//   - Вход повторно валидируется itemInputSchema.safeParse на сервере
//     (never-trust-client V5 / T-3-04), несмотря на клиентский RHF-resolver.
//   - updateItemForUser скоупит UPDATE по userId → чужую покупку изменить нельзя.
//
// Навигация: action НЕ вызывает redirect() (Pitfall 7 — NEXT_REDIRECT кинулся бы
// и был пойман try/catch). Возвращает результат-объект; переход на /list делает
// клиент (router.refresh + push).
const SAVE_ERROR = "Не удалось сохранить изменения. Попробуйте ещё раз.";
// Дословно из UI-SPEC §Copywriting — единый текст для владения (чужой id) и цикла
// (D-05); клиенту не раскрываем, чужая ли покупка. См. new/actions.ts.
const CYCLE_ERROR = "Нельзя выбрать эту покупку — получится цикл зависимостей.";

export type UpdateItemResult =
  | { ok: true }
  | { ok: false; error: string; field?: "dependsOn" };

export async function updateItem(
  id: string,
  input: ItemInput
): Promise<UpdateItemResult> {
  // userId — из сессии; при отсутствии сессии бросает до любой записи (T-3-03).
  const user = await requireUser();

  // Серверная ре-валидация недоверенного payload (V5).
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: SAVE_ERROR };
  }

  // Владение + цикл (never-trust-client / T-05-01, T-05-03), зеркалит createItem, но
  // editedId = id: цепочка кандидата, достигающая редактируемой покупки, — цикл (D-05).
  if (parsed.data.dependsOn != null) {
    const own = await findItemsForUser(user.id);
    const map = new Map(own.map((r) => [r.id, r.dependsOn]));
    // Владение (IDOR / ASVS V4): чужой/несуществующий id → отклоняем под полем.
    if (!map.has(parsed.data.dependsOn)) {
      return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
    }
    // Цикл (D-05): self или цепочка кандидата, достигающая id → отклоняем под полем.
    if (wouldCreateCycle(map, id, parsed.data.dependsOn)) {
      return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
    }
  }

  // Перевод рубли→копейки РОВНО ЗДЕСЬ (единственный write-путь, BL-01) — как в
  // create. Схема валидирует рубли, а колонки price/monthly_payment — integer-
  // копейки. Делать это в общей схеме нельзя: RHF-resolver и серверный safeParse
  // применили бы transform дважды (×10000).
  const { price, monthlyPayment, ...rest } = parsed.data;
  const toKopecks = (rubles: number | undefined): number | undefined =>
    rubles === undefined ? undefined : Math.round(rubles * 100);

  try {
    // В write идут ТОЛЬКО parsed.data (с деньгами в копейках); userId и id
    // скоупят UPDATE в репозитории (изоляция D-09).
    const row = await updateItemForUser(user.id, id, {
      ...rest,
      price: toKopecks(price),
      monthlyPayment: toKopecks(monthlyPayment),
    });
    // WR-01: репозиторий возвращает null, если WHERE не нашёл строку (чужая или
    // несуществующая покупка — no-op). Не рапортуем об успехе: клиент не должен
    // навигировать на /list, если ничего не изменилось. Scoping по userId цел.
    if (!row) return { ok: false, error: SAVE_ERROR };
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}

// Server Action удаления покупки (ITEM-08 / D-06) — зеркалит updateItem, но БЕЗ
// payload-валидации: удаление принимает только `id`, единственная защита — scoping
// по userId из сессии (D-06). Hard delete (D-05). Навигацию (router.refresh) делает
// клиент после { ok: true }; здесь redirect() не вызывается (Pitfall 7).
const DELETE_ERROR = "Не удалось удалить покупку. Попробуйте ещё раз.";

export type DeleteItemResult = { ok: true } | { ok: false; error: string };

export async function deleteItem(id: string): Promise<DeleteItemResult> {
  // userId — из сессии (T-3-05); deleteItemForUser скоупит DELETE, чужую покупку
  // удалить нельзя. id никогда не определяет владельца.
  const user = await requireUser();

  try {
    const row = await deleteItemForUser(user.id, id);
    // WR-01: null означает, что WHERE не нашёл строку (чужая/несуществующая
    // покупка — no-op). Не рапортуем об успехе удаления того, чего не удалили.
    if (!row) return { ok: false, error: DELETE_ERROR };
    return { ok: true };
  } catch {
    return { ok: false, error: DELETE_ERROR };
  }
}
