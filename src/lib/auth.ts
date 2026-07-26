import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { hash, verify } from "@node-rs/argon2";

import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

// Серверная конфигурация Better Auth. `import "server-only"` первой строкой
// гарантирует, что модуль (и секрет BETTER_AUTH_SECRET) никогда не попадёт в
// клиентский бандл. Все ключевые решения фазы зафиксированы явно:
//  - D-02: верификация email не требуется (requireEmailVerification: false);
//  - D-03: минимальная длина пароля 8 символов;
//  - D-04: autoSignIn остаётся дефолтным true — сессия создаётся при регистрации;
//  - D-11: срок жизни сессии задан ЯВНО в 30 дней (дефолт Better Auth — 7 дней);
//  - D-12: хеширование паролей — Argon2id через @node-rs/argon2 (переопределяет
//          дефолтный scrypt Better Auth).
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8, // D-03
    requireEmailVerification: false, // D-02
    // autoSignIn по умолчанию true (D-04, RESEARCH A1) — сессия при регистрации.
    password: {
      // @node-rs/argon2 по умолчанию использует алгоритм Argon2id (D-12);
      // результат имеет префикс "$argon2id$".
      hash: (password) => hash(password),
      verify: ({ hash: h, password }) => verify(h, password),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // D-11: 30 дней ЯВНО (дефолт 7)
    updateAge: 60 * 60 * 24, // ежедневное продление при активности
  },
  plugins: [nextCookies()], // ОБЯЗАТЕЛЬНО последним — auto-set httpOnly cookie
});
