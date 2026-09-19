import path from "node:path";

import { defaultExclude, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Конфигурация Vitest 4 для Next.js (проверена против мажорного апгрейда v4 —
// снимает риск A4 из RESEARCH). `vite-tsconfig-paths` резолвит alias `@/*`, так
// что тесты импортируют модули через `@/...`; окружение `jsdom` нужно для
// компонентных тестов (RTL). Интеграционные тесты БД помечены `@vitest-
// environment node` и получают server-only-заглушку + подмену DATABASE_URL на
// тестовую БД через setup-файл.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // В тестах серверные модули (server-only) импортируются напрямую.
      "server-only": path.resolve(
        process.cwd(),
        "tests/helpers/server-only-stub.ts"
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/helpers/vitest-db-setup.ts", "./vitest.setup.ts"],
    // Каталог `e2e/` — спеки Playwright (@playwright/test); Vitest не должен их
    // собирать, иначе падает на несовместимом runner-API.
    exclude: [...defaultExclude, "e2e/**"],
    // Интеграционные тесты БД (`@vitest-environment node`, напр. items.iso.test.ts и
    // actions.guard.test.ts) бьют по ОДНОЙ физической тестовой Postgres и в
    // beforeEach делают глобальный TRUNCATE + реseed фиксированных пользователей.
    // При параллельном прогоне файлов их TRUNCATE'ы гонятся (чужие строки исчезают
    // из-под теста; unique email конфликтует). Отключаем параллелизм на уровне
    // файлов, чтобы DB-тесты выполнялись последовательно на общей БД (suite мал).
    fileParallelism: false,
  },
});
