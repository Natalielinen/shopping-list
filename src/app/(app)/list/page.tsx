import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemsForUser } from "@/server/repos/items";
import { isBlocked } from "@/lib/deps/blocked";
import { computeBreakdown, computeTotal } from "@/lib/scoring/scoring";
import { Button } from "@/components/ui/button";
import { ListView, type ListViewItem } from "@/components/items/ListView";

// Защищённый личный список — RSC. userId берётся ТОЛЬКО из серверной сессии
// (getCurrentUser), данные читаются через единственный шов изоляции
// findItemsForUser(userId) (AUTH-04).
//
// Приоритет вычисляется НА ЧТЕНИИ (SCORE-05): `now` создаётся один раз, каждая
// покупка приводится к примитивам (total/createdAtMs/purchasedAtMs) через
// computeTotal — сортировка/партиция выполняются В JS, НЕ через SQL ORDER BY по
// вычисляемому приоритету (Pitfall 8, D-12).
//
// Граница RSC→client (D-03/D-10 / §Pitfall 4): findItemsForUser возвращает ВСЕ
// покупки (активные + купленные, WHERE по purchasedAt НЕТ). RSC считает total
// единым `now` и отдаёт ТОЛЬКО примитивы (числа/null, никаких Date) клиентскому
// ListView, который держит эфемерное состояние сортировки/фильтра (D-09) и
// рендерит группы. `.sort` из RSC удалён — переехал в ListView.
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

  // Единый `now` на прогон: и total, и разбивка считаются ОДНОЙ датой, поэтому
  // сумма знаковых строк разбивки (LIST-07) провабельно равна total в badge
  // (LIST-06). Второй new Date() ниже по дереву запрещён (см. ItemCard/ScoreBreakdown).
  const now = new Date();
  // byId — lookup покупки-зависимости в уже загруженном наборе (D-02): производное
  // blocked считается без доп. запроса к БД.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items: ListViewItem[] = rows.map((item) => {
    // Зависимость (если есть) ищется в том же наборе; blocked — ПРЯМОЕ производное
    // (DEP-01 / D-02): есть незакрытая зависимость. `&& purchasedAt === null` — не
    // рисуем замок у уже купленной покупки (Pitfall 3). dependencyTitle/blocked —
    // ТОЛЬКО примитивы через границу RSC→client (Pitfall 4), никакого Date.
    const dep = item.dependsOn ? byId.get(item.dependsOn) : undefined;
    const blocked =
      isBlocked(item.dependsOn, dep?.purchasedAt ?? null) &&
      item.purchasedAt === null;
    return {
      id: item.id,
      title: item.title,
      total: computeTotal(item, now),
      // §Pitfall 4: Date → epoch ms в RSC; клиент сравнивает только числа/null.
      createdAtMs: item.createdAt.getTime(),
      purchasedAtMs: item.purchasedAt?.getTime() ?? null,
      blocked,
      dependencyTitle: blocked ? (dep?.title ?? null) : null,
      breakdown: computeBreakdown(item, now),
    };
  });

  return <ListView items={items} />;
}
