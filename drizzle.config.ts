import { defineConfig } from "drizzle-kit";

import { loadEnvLocal } from "./tests/helpers/load-env";

// drizzle-kit не читает `.env.local` автоматически — подгружаем его вручную,
// чтобы `DATABASE_URL` был доступен для generate/migrate.
loadEnvLocal();

// Конфигурация drizzle-kit для генерации и применения SQL-миграций.
// `schema` указывает на forward-путь `schema.ts` — сам файл создаётся в плане 02
// (Better Auth CLI + таблица items). Миграции складываются в `./drizzle` и
// коммитятся в git как детерминированный SQL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
