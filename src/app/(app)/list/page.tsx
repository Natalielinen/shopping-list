import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemsForUser } from "@/server/repos/items";

// Защищённый личный список — RSC. userId берётся ТОЛЬКО из серверной сессии
// (getCurrentUser), затем данные читаются через единственный шов изоляции
// findItemsForUser(userId) (AUTH-04). В Фазе 1 список всегда пуст (D-06):
// формы/кнопки добавления нет, рендерится только empty state с текстами из
// UI-SPEC. Запись покупок появится в Фазе 2.
export default async function ListPage() {
  const user = await getCurrentUser();
  // Подстраховка на случай гонки истечения сессии между layout и страницей.
  if (!user) redirect("/login");

  const items = await findItemsForUser(user.id);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Список пуст</h1>
        <p className="text-base text-muted-foreground">
          Скоро здесь можно будет добавлять покупки.
        </p>
      </div>
    );
  }

  // В Фазе 1 сюда попасть нельзя (записи не создаются) — заготовка на Фазу 2.
  return (
    <ul className="flex flex-col gap-2 px-4 py-6">
      {items.map((item) => (
        <li key={item.id} className="text-base">
          {item.title}
        </li>
      ))}
    </ul>
  );
}
