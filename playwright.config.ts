import { defineConfig } from "@playwright/test";

import { loadEnvLocal } from "./tests/helpers/load-env";

// Загружаем `.env.local` в process.env: Playwright (в отличие от Next.js) не
// читает его сам, а нам нужен DATABASE_URL_TEST, чтобы направить приложение на
// одноразовую тестовую БД.
loadEnvLocal();

// Отдельный порт для e2e, чтобы не конфликтовать с возможным dev-сервером на
// 3000 и гарантировать, что поднятый Playwright сервер использует тестовую БД.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

const testDbUrl = process.env.DATABASE_URL_TEST;
if (!testDbUrl) {
  throw new Error(
    "DATABASE_URL_TEST не задан (см. .env.local) — обязателен для e2e-тестов аутентификации"
  );
}

export default defineConfig({
  testDir: "./e2e",
  // global-setup сбрасывает и мигрирует тестовую БД один раз перед прогоном.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  use: {
    baseURL,
  },
  webServer: {
    // `next dev` на выделенном порту; приложение получает DATABASE_URL тестовой
    // БД — Next не перезапишет уже заданную в окружении переменную значением из
    // .env.local, поэтому приложение и тесты работают с одной базой.
    command: `npm run dev -- -p ${PORT}`,
    // Проверяем готовность по `/register` (прямой 200 без редиректа): корневой
    // `/` отдаёт 307-редирект и не вызывает getSession, что делает readiness-
    // пробу однозначной.
    url: `${baseURL}/register`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      PORT: String(PORT),
    },
  },
});
