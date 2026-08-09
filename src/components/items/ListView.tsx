"use client";

import { useState } from "react";

import type { Contribution } from "@/lib/scoring/scoring";
import {
  partitionByPurchased,
  sortActive,
  sortPurchased,
  type ListItem,
  type SortKey,
} from "@/lib/list/sort";
import { ItemCard } from "@/components/items/ItemCard";
import { ListControls } from "@/components/items/ListControls";

// Клиентский слой списка (D-09/D-10) — первый 'use client'-контейнер поверх
// RSC-данных. Держит эфемерное состояние сортировки/фильтра (useState, D-09 —
// НЕ URL/localStorage/nuqs; перезагрузка сбрасывает к дефолту priority + OFF) и
// рендерит панель ListControls, активный список, секцию «Куплено» и все empty-
// варианты (§Pitfall 2). Полностью пустой список (0 покупок) обрабатывает
// page.tsx (RSC), поэтому сюда items всегда приходит с ≥1 элементом.
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
  // Эфемерное клиентское состояние (D-09): дефолт — приоритет + купленные скрыты.
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [showPurchased, setShowPurchased] = useState(false);

  // §Pitfall 1: сначала партиция по статусу «куплено», затем сортировка. Активный
  // список управляется Select (sortKey); секция «Куплено» ВСЕГДА по purchasedAt
  // убыв. (sortPurchased), независимо от Select. partitionByPurchased/sortActive/
  // sortPurchased лишь переупорядочивают ссылки на исходные объекты (не копируют),
  // поэтому поле breakdown уцелело — сужаем тип обратно к ListViewItem.
  const { active, purchased } = partitionByPurchased(items);
  const activeSorted = sortActive(active, sortKey) as ListViewItem[];
  const purchasedSorted = sortPurchased(purchased) as ListViewItem[];

  // Секция «Куплено» рендерится ТОЛЬКО при включённом фильтре И ≥1 купленной —
  // пустого заголовка «Куплено» не бывает (§UI-SPEC / §Pitfall 2).
  const showPurchasedSection = showPurchased && purchasedSorted.length > 0;

  return (
    <div className="flex flex-col">
      <ListControls
        sortKey={sortKey}
        showPurchased={showPurchased}
        onSortKeyChange={setSortKey}
        onShowPurchasedChange={setShowPurchased}
      />

      {activeSorted.length > 0 ? (
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
      ) : showPurchased ? (
        // Все куплены + фильтр ВКЛ: короткий текст на месте активного списка;
        // секция «Куплено» показана ниже (§Pitfall 2 / §Copywriting Contract).
        <p className="px-4 py-6 text-center text-base text-muted-foreground">
          Активных покупок нет.
        </p>
      ) : (
        // Все куплены + фильтр ВЫКЛ: heading + подсказка включить фильтр.
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">Активных покупок нет</h2>
          <p className="text-base text-muted-foreground">
            Все покупки отмечены купленными. Включите «Показывать купленные»,
            чтобы увидеть архив.
          </p>
        </div>
      )}

      {showPurchasedSection && (
        // Разделитель border-t + отступ mt-8 (xl) отделяют архив от активного
        // списка; заголовок приглушён (text-muted-foreground) как второстепенный.
        <section className="mt-8 border-t px-4 py-6">
          <h2 className="mb-4 text-xl font-semibold text-muted-foreground">
            Куплено · {purchasedSorted.length}
          </h2>
          <ul className="flex flex-col gap-4">
            {purchasedSorted.map((item) => (
              <li key={item.id}>
                <ItemCard
                  id={item.id}
                  title={item.title}
                  total={item.total}
                  breakdown={item.breakdown}
                  purchased={true}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
