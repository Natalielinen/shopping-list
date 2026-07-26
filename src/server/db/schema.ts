import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Схема БД Фазы 1.
//
// Таблицы Better Auth (user / session / account / verification) генерируются
// в задаче Task 2 командой `@better-auth/cli generate` и заменяют временное
// определение `user` ниже каноническим. Таблица `items` определяется здесь
// вручную (D-13) и должна сохраняться при регенерации.
//
// Таблица `user` объявлена здесь заранее, чтобы внешний ключ `items.userId`
// компилировался уже в Task 1 (verify = `tsc --noEmit`). После генерации CLI
// это определение будет заменено сгенерированным.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

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
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("items_user_id_idx").on(table.userId)]
);

export type User = typeof user.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
