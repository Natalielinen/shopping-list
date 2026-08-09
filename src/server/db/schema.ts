import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type {
  BenefitType,
  CategoryType,
  DoubtsType,
  NeedType,
  UrgencyType,
} from "@/lib/scoring/scales";

// Схема БД Фазы 1.
//
// Таблицы Better Auth (user / session / account / verification) и их relations
// сгенерированы командой `@better-auth/cli generate` (Task 2) — не редактировать
// вручную, регенерировать после любого изменения auth-конфига (Pitfall 8).
// Таблица `items` определена ниже вручную (D-13) и должна сохраняться при
// регенерации.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// --- Таблица приложения (не редактируется CLI) ---

// Таблица покупок (D-13). В Фазе 1 создаётся только таблица + read-seam
// (без формы/записи/UI — соблюдает пустой стейт D-06). Столбец `userId` —
// внешний ключ на `user.id` и ОБЯЗАТЕЛЬНО индексирован (Pitfall 1: без индекса
// user-scoped выборки деградируют с ростом данных).
export const items = pgTable(
  "items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Очковые enum-поля (Фаза 2). Ключи английские (scales.ts — единый источник),
    // русские подписи живут в label-мапе UI-слоя. `$type` привязывает колонку к
    // union-типу шкалы: компилятор ловит невалидные ключи на вставке.
    category: text("category").$type<CategoryType>().notNull(),
    urgency: text("urgency").$type<UrgencyType>().notNull(),
    need: text("need").$type<NeedType>().notNull(),
    benefit: text("benefit").$type<BenefitType>().notNull(),
    // ITEM-05 / D-01: по умолчанию «нет сомнений».
    doubts: text("doubts").$type<DoubtsType>().notNull().default("sure"),
    // ITEM-04: покупка в кредит; условная лишь видимость monthlyPayment в UI.
    isCredit: boolean("is_credit").notNull().default(false),
    // Необязательные поля покупки (nullable — не ломают существующие строки).
    link: text("link"),
    description: text("description"),
    // Pitfall 4: дата без времени/TZ, чтобы вклад срока не сдвигался на день.
    deadline: date("deadline", { mode: "date" }),
    // Pitfall 10: деньги как integer-копейки (без float-ошибок, numeric→string).
    // Display-only, на очки не влияют.
    price: integer("price"),
    monthlyPayment: integer("monthly_payment"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    // Статус «куплено» (D-07, Фаза 4). Одна nullable-колонка кодирует и статус,
    // и ключ сортировки архива: `null` = покупка активна, non-null timestamp =
    // куплена/в архиве (секция «Куплено» сортируется по purchasedAt убыв.).
    // Без default → аддитивная миграция, существующие строки → NULL = активны.
    // На очки НЕ влияет (не входит в ScoredFields/scoring.ts).
    purchasedAt: timestamp("purchased_at"),
    // ПРИМЕЧАНИЕ: вычисляемые очки (сумма и вклад дедлайна) НЕ хранятся
    // (SCORE-05) — считаются на чтении из текущей даты.
  },
  (table) => [index("items_user_id_idx").on(table.userId)]
);

export type User = typeof user.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

// Данные для вставки покупки: поля покупки без серверно-управляемых id/userId/
// createdAt. `userId` подмешивается репозиторием из сессии (никогда из payload —
// mass-assignment, Security V4).
export type ItemInsertData = Omit<NewItem, "id" | "userId" | "createdAt">;
