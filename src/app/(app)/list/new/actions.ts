"use server";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { wouldCreateCycle } from "@/lib/deps/cycle";
import { requireUser } from "@/server/auth/current-user";
import { createItemForUser, findItemsForUser } from "@/server/repos/items";

// Server Action создания покупки (ITEM-01 / RESEARCH Pattern 3).
//
// Безопасность:
//   - userId берётся ТОЛЬКО из серверной сессии через requireUser() (T-2-01/T-2-03),
//     НИКОГДА из payload формы — mass-assignment невозможен.
//   - Вход повторно валидируется itemInputSchema.safeParse на сервере
//     (never-trust-client V5 / T-2-04), несмотря на клиентский RHF-resolver.
//
// Навигация: action НЕ вызывает redirect() (Pitfall 7 — NEXT_REDIRECT кинулся бы
// и был пойман try/catch). Возвращает результат-объект; переход на /list делает
// клиент (router.push).
const SAVE_ERROR = "Не удалось сохранить покупку. Попробуйте ещё раз.";
// Дословно из UI-SPEC §Copywriting — единый текст ошибки для владения (чужой id)
// и цикла: клиенту не раскрываем, чужая ли это покупка (не утекает существование
// чужих id), обе ветки — недопустимый выбор зависимости под полем dependsOn.
const CYCLE_ERROR = "Нельзя выбрать эту покупку — получится цикл зависимостей.";

export type CreateItemResult =
  | { ok: true }
  | { ok: false; error: string; field?: "dependsOn" };

export async function createItem(input: ItemInput): Promise<CreateItemResult> {
  // userId — из сессии; при отсутствии сессии бросает до любой записи (T-2-03).
  const user = await requireUser();

  // Серверная ре-валидация недоверенного payload (V5).
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: SAVE_ERROR };
  }

  // Владение + цикл (never-trust-client / T-05-01, T-05-03): dependsOn — чужой
  // недоверенный ввод. FK гарантирует лишь целостность к таблице, НЕ владельца,
  // поэтому кандидат обязан принадлежать пользователю (candidate ∈ findItemsForUser)
  // и не создавать цикл (D-05). Клиентская фильтрация кандидатов — лишь UX; авторитет
  // здесь. editedId = null (create: покупки ещё нет в графе → цикл невозможен, но
  // владение проверяем всегда).
  if (parsed.data.dependsOn != null) {
    const own = await findItemsForUser(user.id);
    const map = new Map(own.map((r) => [r.id, r.dependsOn]));
    // Владение (IDOR / ASVS V4): чужой/несуществующий id → отклоняем под полем.
    if (!map.has(parsed.data.dependsOn)) {
      return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
    }
    // Цикл (D-05): для create sourceId=null → wouldCreateCycle всегда false, но
    // вызов сохранён для симметрии с update (единый шов проверки).
    if (wouldCreateCycle(map, null, parsed.data.dependsOn)) {
      return { ok: false, error: CYCLE_ERROR, field: "dependsOn" };
    }
  }

  // Перевод рубли→копейки РОВНО ЗДЕСЬ (единственный write-путь, BL-01). Схема
  // валидирует рубли с ≤2 знаками, а колонки price/monthly_payment — integer-
  // копейки. Делать это в общей схеме нельзя: RHF-resolver и серверный safeParse
  // применили бы transform дважды (×10000).
  const { price, monthlyPayment, ...rest } = parsed.data;
  const toKopecks = (rubles: number | undefined): number | undefined =>
    rubles === undefined ? undefined : Math.round(rubles * 100);

  try {
    // В write идут ТОЛЬКО parsed.data (с деньгами в копейках); userId
    // подмешивается репозиторием.
    await createItemForUser(user.id, {
      ...rest,
      price: toKopecks(price),
      monthlyPayment: toKopecks(monthlyPayment),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}
