import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { findItemForUser } from "@/server/repos/items";
import { AddItemForm } from "@/components/items/AddItemForm";

// Страница редактирования покупки (/list/[id]/edit) — RSC-обёртка (аналог
// new/page.tsx + list/page.tsx). userId проверяется на сервере (getCurrentUser);
// при отсутствии сессии — redirect на /login. Покупка читается через шов изоляции
// findItemForUser(userId, id): чужая/несуществующая → notFound() (404, D-09) —
// открыть на редактирование чужую покупку нельзя (SC-3).
//
// Prefill (D-02): price/monthlyPayment хранятся в копейках → делятся на 100
// (рубли, строкой) для формы; deadline (Date) → строка YYYY-MM-DD для
// <input type="date">; nullable link/description → "". monthlyPayment виден при
// isCredit (form.watch). Интерактивность живёт в client-leaf <AddItemForm />.
export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  // Подстраховка на случай гонки истечения сессии между layout и страницей.
  if (!user) redirect("/login");

  const item = await findItemForUser(user.id, id);
  if (!item) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Редактировать покупку</h1>
      <AddItemForm
        mode="edit"
        itemId={item.id}
        initialValues={{
          title: item.title,
          category: item.category,
          urgency: item.urgency,
          need: item.need,
          benefit: item.benefit,
          doubts: item.doubts,
          isCredit: item.isCredit,
          link: item.link ?? "",
          description: item.description ?? "",
          price: item.price == null ? "" : String(item.price / 100),
          monthlyPayment:
            item.monthlyPayment == null ? "" : String(item.monthlyPayment / 100),
          deadline: item.deadline
            ? item.deadline.toISOString().slice(0, 10)
            : "",
        }}
      />
    </div>
  );
}
