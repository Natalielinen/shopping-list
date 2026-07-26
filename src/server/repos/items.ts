import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";

// Единственная точка доступа к данным покупок (AUTH-04 / шов изоляции).
// `userId` обязателен в сигнатуре и попадает в каждый WHERE, поэтому изоляцию
// нельзя забыть в вызывающем коде (Anti-Pattern 3). Запись (insert/update/
// delete) добавляется в Фазе 2 — всегда с `and(eq(id), eq(userId))`.
export async function findItemsForUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}
