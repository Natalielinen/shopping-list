import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemsForUser } from "@/server/repos/items";
import { wouldCreateCycle } from "@/lib/deps/cycle";
import { AddItemForm } from "@/components/items/AddItemForm";

// Страница формы добавления покупки (/list/new) — RSC-обёртка (аналог list/page).
// userId проверяется на сервере (getCurrentUser); при отсутствии сессии —
// redirect на /login (D-07). Заголовок «Новая покупка» (Display 24/600).
// Интерактивность живёт в client-leaf <AddItemForm />, сама страница — RSC.
export default async function NewItemPage() {
  const user = await getCurrentUser();
  // Подстраховка на случай гонки истечения сессии между layout и страницей.
  if (!user) redirect("/login");

  // Кандидаты зависимости (ITEM-06 / D-05): СВОИ покупки пользователя (изоляция
  // findItemsForUser), минус купленные (купленная зависимость никогда не блокирует
  // → выбор бесполезен). В create цикл невозможен (sourceId=null → wouldCreateCycle
  // всегда false), вызов сохранён для симметрии с edit. Кандидаты — только примитивы
  // { id, title } (граница RSC→client). Серверная валидация цикла/владения в
  // createItem — авторитет (клиентская фильтрация лишь UX).
  const own = await findItemsForUser(user.id);
  const map = new Map(own.map((r) => [r.id, r.dependsOn]));
  const candidates = own
    .filter((r) => r.purchasedAt === null && !wouldCreateCycle(map, null, r.id))
    .map((r) => ({ id: r.id, title: r.title }));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Новая покупка</h1>
      <AddItemForm candidates={candidates} />
    </div>
  );
}
