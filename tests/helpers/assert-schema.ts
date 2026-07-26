import postgres from "postgres";

import { loadEnvLocal } from "./load-env";

// [BLOCKING] проба схемы (используется в verify Task 2). TypeScript-сборка
// проходит и без применённой БД — эта проба подтверждает, что миграции реально
// применены: таблицы `user` (Better Auth) и `items` (D-13) существуют в БД по
// DATABASE_URL. При отсутствии любой из них — выход с ненулевым кодом.
loadEnvLocal();

const REQUIRED_TABLES = ["user", "items"] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL не задан (проверьте .env.local)");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const [{ reg }] = await sql<{ reg: string | null }[]>`
        SELECT to_regclass(${`public.${table}`}) AS reg
      `;
      if (reg === null) missing.push(table);
    }

    if (missing.length > 0) {
      console.error(`Отсутствуют таблицы в БД: ${missing.join(", ")}`);
      process.exit(1);
    }

    console.log(`Схема применена: таблицы ${REQUIRED_TABLES.join(", ")} присутствуют.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
