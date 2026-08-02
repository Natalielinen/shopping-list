import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { type ItemInsertData, items } from "@/server/db/schema";

// Единственная точка доступа к данным покупок (AUTH-04 / шов изоляции).
// `userId` обязателен в сигнатуре и попадает в каждый WHERE, поэтому изоляцию
// нельзя забыть в вызывающем коде (Anti-Pattern 3).
export async function findItemsForUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}

// Write-seam создания покупки (ITEM-01 / T-2-01). `userId` — отдельный параметр
// из серверной сессии; подмешивается в .values() ПОСЛЕ `data`, поэтому любой
// userId в payload не может подменить владельца (mass-assignment, Security V4).
// Вставка через Drizzle `.values()` параметризована (нет SQL-инъекции, T-2-10).
export async function createItemForUser(userId: string, data: ItemInsertData) {
  const [row] = await db
    .insert(items)
    .values({ ...data, userId })
    .returning();
  return row;
}

// Read-seam одной покупки (ITEM-07 / T-3-02). Тот же шов изоляции: `userId` —
// обязательный параметр из серверной сессии, попадает в WHERE вместе с `id`.
// Чужая/несуществующая покупка недостижима → null (RSC-обёртка вызовет
// notFound(), D-09). WHERE `and(eq(id), eq(userId))` — IDOR на чтение невозможен.
export async function findItemForUser(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)));
  return row ?? null;
}

// Write-seam обновления покупки (ITEM-07 / T-3-01). `userId` из сессии скоупит
// UPDATE, поэтому чужую покупку изменить нельзя: при несовпадении владельца WHERE
// не находит строку → .returning() пуст → null (no-op, IDOR на запись невозможен).
// Тип `data` — тот же ItemInsertData, что у createItemForUser (id/userId/createdAt
// исключены, mass-assignment владельца невозможен, Security V4).
export async function updateItemForUser(
  userId: string,
  id: string,
  data: ItemInsertData
) {
  const [row] = await db
    .update(items)
    .set(data)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}

// Write-seam удаления покупки (ITEM-08 / T-3-05, IDOR на удаление). Тот же шов
// изоляции: `userId` из серверной сессии скоупит DELETE вместе с `id`. Hard delete
// (D-05 — без архива/undo, восстановление — Фаза 4). При несовпадении владельца
// WHERE не находит строку → .returning() пуст → null (no-op, чужую покупку удалить
// нельзя). При успехе возвращает удалённую строку (владелец подтверждён).
export async function deleteItemForUser(userId: string, id: string) {
  const [row] = await db
    .delete(items)
    .where(and(eq(items.id, id), eq(items.userId, userId)))
    .returning();
  return row ?? null;
}
