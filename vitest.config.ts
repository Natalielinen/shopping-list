import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Конфигурация Vitest 4 для Next.js (проверена против мажорного апгрейда v4 —
// снимает риск A4 из RESEARCH). `vite-tsconfig-paths` резолвит alias `@/*`, так
// что тесты импортируют модули через `@/...`; окружение `jsdom` нужно для
// будущих компонентных тестов (React Testing Library).
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
