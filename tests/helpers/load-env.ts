import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Загружает переменные из untracked `.env.local` в `process.env` для инструментов,
// которые — в отличие от Next.js — не читают `.env.local` автоматически:
// drizzle-kit (через drizzle.config.ts), tsx-скрипты и Vitest. Значения, уже
// присутствующие в реальном окружении процесса, не перезаписываются.
export function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}
