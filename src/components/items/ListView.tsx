"use client";

import type { Contribution } from "@/lib/scoring/scoring";
import {
  partitionByPurchased,
  sortActive,
  type ListItem,
} from "@/lib/list/sort";
import { ItemCard } from "@/components/items/ItemCard";

// Клиентский слой списка (D-09/D-10) — первый 'use client'-контейнер поверх
// RSC-данных. В ПЛАНЕ 04-03 (TRACER) — минимальный скелет: партиция по статусу
// «куплено» + рендер только активных (купленные скрыты, дефолтный вид). Полные
// ListControls (Select сортировки + Checkbox фильтра), секция «Куплено» и
// empty-состояния «все куплены» добавит план 04-04.
//
// Граница RSC→client — на примитивах (§Pitfall 4): каждый элемент несёт
// total/createdAtMs/purchasedAtMs (числа/null) плюс breakdown для карточки.
// Никаких Date/Date.now() здесь — «сейчас» посчитан в page.tsx (RSC).

// Элемент, приходящий из RSC: примитивы сортировки (ListItem) + breakdown для
// рендера карточки. total/createdAtMs/purchasedAtMs уже внутри ListItem.
export type ListViewItem = ListItem & {
  breakdown: Contribution[];
};

export function ListView({ items }: { items: ListViewItem[] }) {
  // Сначала партиция (§Pitfall 1), затем сортировка активных. В 04-03 sortKey
  // фиксирован "priority" (дефолт) — Select появится в 04-04. partitionByPurchased
  // и sortActive лишь переупорядочивают ссылки на исходные объекты (не копируют),
  // поэтому поле breakdown уцелело — сужаем тип обратно к ListViewItem.
  const { active } = partitionByPurchased(items);
  const activeSorted = sortActive(active, "priority") as ListViewItem[];

  return (
    <ul className="flex flex-col gap-4 px-4 py-6">
      {activeSorted.map((item) => (
        <li key={item.id}>
          <ItemCard
            id={item.id}
            title={item.title}
            total={item.total}
            breakdown={item.breakdown}
            purchased={false}
          />
        </li>
      ))}
    </ul>
  );
}
