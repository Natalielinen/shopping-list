import { defineConfig } from "@playwright/test";

// Конфигурация Playwright для e2e-сценариев аутентификации (register / login /
// logout / изоляция), которые появятся в следующих планах. `webServer` сам
// поднимает Next в dev-режиме и ждёт готовности по baseURL. Seeding двух
// пользователей (global-setup) сюда НЕ добавляется — он появится в плане 02/03
// после создания schema и seed-хелперов.
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
