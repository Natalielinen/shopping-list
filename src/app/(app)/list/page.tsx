import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemsForUser } from "@/server/repos/items";
import { computeTotal } from "@/lib/scoring/scoring";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/items/ItemCard";

// Защищённый личный список — RSC. userId берётся ТОЛЬКО из серверной сессии
// (getCurrentUser), данные читаются через единственный шов изоляции
// findItemsForUser(userId) (AUTH-04).
//
// Приоритет вычисляется НА ЧТЕНИИ (SCORE-05): `now` создаётся один раз, каждая
// покупка отображается в { item, total } через computeTotal, список сортируется
// по убыванию total (tiebreak по createdAt) — сортировка В JS, НЕ через SQL
// ORDER BY по вычисляемому приоритету (Pitfall 8, D-12).
export default async function ListPage() {
  const user = await getCurrentUser();
  // Подстраховка на случай гонки истечения сессии между layout и страницей.
  if (!user) redirect("/login");

  const rows = await findItemsForUser(user.id);

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Список пуст</h1>
        <p className="text-base text-muted-foreground">
          Добавьте первую покупку — она сразу получит приоритет.
        </p>
        <Button asChild className="h-11 text-base">
          <Link href="/list/new">Добавить покупку</Link>
        </Button>
      </div>
    );
  }

  const now = new Date();
  const scored = rows
    .map((item) => ({ item, total: computeTotal(item, now) }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.item.createdAt.getTime() - a.item.createdAt.getTime()
    );

  return (
    <ul className="flex flex-col gap-4 px-4 py-6">
      {scored.map(({ item, total }) => (
        <li key={item.id}>
          <ItemCard title={item.title} total={total} />
        </li>
      ))}
    </ul>
  );
}
