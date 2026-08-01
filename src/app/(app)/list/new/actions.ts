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

  try {
    // В write идут ТОЛЬКО parsed.data; userId подмешивается репозиторием.
    await createItemForUser(user.id, parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: SAVE_ERROR };
  }
}
