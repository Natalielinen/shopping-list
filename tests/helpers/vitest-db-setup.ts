import { loadEnvLocal } from "./load-env";

// Setup-файл Vitest: выполняется до импорта тестовых модулей. Загружает
// `.env.local` и направляет слой данных на ОДНОРАЗОВУЮ тестовую БД —
// `DATABASE_URL` подменяется на `DATABASE_URL_TEST`, чтобы клиент из
// `@/server/db/client` (читает DATABASE_URL при импорте) и сид-хелперы
// (пишут в DATABASE_URL_TEST) работали с одной и той же базой.
loadEnvLocal();

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
