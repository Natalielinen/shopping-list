import { closeTestDb, resetDb } from "../tests/helpers/db";

// Playwright global-setup: один раз перед всем прогоном приводит тестовую БД
// (DATABASE_URL_TEST) в чистое состояние — применяет миграции и очищает
// таблицы. Каждая спека сама сеет нужных пользователей (через UI-регистрацию
// или API Better Auth), поэтому здесь только сброс, без общего seed.
async function globalSetup() {
  await resetDb();
  await closeTestDb();
}

export default globalSetup;
