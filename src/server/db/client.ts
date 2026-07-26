import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Единый долгоживущий клиент postgres.js для обычного (не serverless) сервера.
// НЕ создаём pg.Pool и не используем запрещённые драйверы (см. CLAUDE.md).
// `import "server-only"` первой строкой гарантирует, что импорт из клиентского
// бандла упадёт на сборке и секрет DATABASE_URL никогда не утечёт на клиент.
const client = postgres(process.env.DATABASE_URL!);

// Схема (`schema.ts`) появится в плане 02 — здесь клиент намеренно без привязки
// схемы, чтобы владение этим файлом оставалось за планом 01-01.
export const db = drizzle(client);
