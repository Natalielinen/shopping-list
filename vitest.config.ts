import path from "node:path";

import { defineConfig } from "vitest/config";
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
  },
});
