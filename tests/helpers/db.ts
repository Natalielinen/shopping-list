import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { items, user } from "@/server/db/schema";

import { loadEnvLocal } from "./load-env";

// Хелперы одноразовой тестовой БД для интеграционных тестов изоляции.
// Подключение — строго к `DATABASE_URL_TEST` (не к prod `DATABASE_URL`).
loadEnvLocal();

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST не задан (см. .env.local) — обязателен для тестов изоляции"
  );
}

const client = postgres(testUrl, { max: 1 });
const testDb = drizzle(client);

let migrated = false;

// Применяет миграции к тестовой БД один раз за прогон (идемпотентно).
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  await migrate(testDb, { migrationsFolder: "./drizzle" });
  migrated = true;
}

// Очищает таблицы перед каждым тестом (CASCADE снимает FK-зависимости).
export async function resetDb(): Promise<void> {
  await ensureMigrated();
  await client`TRUNCATE TABLE items, "session", "account", "verification", "user" RESTART IDENTITY CASCADE`;
}

// Вставляет строку в таблицу `user` Better Auth, возвращает её id.
export async function seedUser(email: string): Promise<{ id: string }> {
  const id = randomUUID();
  const now = new Date();
  await testDb.insert(user).values({
    id,
    name: email.split("@")[0]!,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

// Вставляет строку в таблицу `items` для указанного пользователя. Новые NOT NULL
// enum-колонки (Фаза 2) получают валидные ключи по умолчанию, чтобы существующий
// тест read-изоляции не сломался; вызывающий может переопределить любое поле.
export async function seedItem(
  userId: string,
  fields: {
    title: string;
    category?: string;
    urgency?: string;
    need?: string;
    benefit?: string;
    doubts?: string;
    isCredit?: boolean;
    // Статус «куплено» (D-07). По умолчанию не задаётся → NULL = покупка активна
    // (существующие тесты не ломаются). Задать Date, чтобы засеять купленную покупку.
    purchasedAt?: Date | null;
    // ITEM-06 / D-06: зависимость от другой своей покупки (self-ref FK). По умолчанию
    // NULL = без зависимости. Задать id, чтобы засеять граф зависимостей в iso-тестах.
    dependsOn?: string | null;
  }
): Promise<{ id: string }> {
  const id = randomUUID();
  await testDb.insert(items).values({
    id,
    userId,
    title: fields.title,
    category: (fields.category ?? "home") as never,
    urgency: (fields.urgency ?? "urgent") as never,
    need: (fields.need ?? "needed") as never,
    benefit: (fields.benefit ?? "savesResources") as never,
    doubts: (fields.doubts ?? "sure") as never,
    isCredit: fields.isCredit ?? false,
    createdAt: new Date(),
    purchasedAt: fields.purchasedAt ?? null,
    dependsOn: fields.dependsOn ?? null,
  });
  return { id };
}

// Закрывает подключение к тестовой БД (afterAll).
export async function closeTestDb(): Promise<void> {
  await client.end({ timeout: 5 });
}
