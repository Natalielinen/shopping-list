import "server-only";

import { eq } from "drizzle-orm";

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
