"use server";

import { itemInputSchema, type ItemInput } from "@/lib/validation/item";
import { requireUser } from "@/server/auth/current-user";
import { createItemForUser } from "@/server/repos/items";

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

export type CreateItemResult = { ok: true } | { ok: false; error: string };

export async function createItem(input: ItemInput): Promise<CreateItemResult> {
  // userId — из сессии; при отсутствии сессии бросает до любой записи (T-2-03).
  const user = await requireUser();

  // Серверная ре-валидация недоверенного payload (V5).
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: SAVE_ERROR };
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
