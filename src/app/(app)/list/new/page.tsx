import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { AddItemForm } from "@/components/items/AddItemForm";

// Страница формы добавления покупки (/list/new) — RSC-обёртка (аналог list/page).
// userId проверяется на сервере (getCurrentUser); при отсутствии сессии —
// redirect на /login (D-07). Заголовок «Новая покупка» (Display 24/600).
// Интерактивность живёт в client-leaf <AddItemForm />, сама страница — RSC.
export default async function NewItemPage() {
  const user = await getCurrentUser();
  // Подстраховка на случай гонки истечения сессии между layout и страницей.
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Новая покупка</h1>
      <AddItemForm />
    </div>
  );
}
