import Link from "next/link";
import { Pencil } from "lucide-react";

import type { Contribution } from "@/lib/scoring/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteItemButton } from "@/components/items/DeleteItemButton";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { PurchaseCheckbox } from "@/components/items/PurchaseCheckbox";
import { ScoreBreakdown } from "@/components/items/ScoreBreakdown";

// Карточка покупки в списке (LIST-06 / ITEM-07) — RSC. Показывает название
// (Heading 20/600) + badge приоритета, а под ними — ряд действий: раскрываемый по
// тапу триггер разбивки очков (LIST-07) и иконка «карандаш» edit (D-04).
//
// `breakdown` (результат computeBreakdown(item, now)) и `total` приходят из
// родителя-RSC (list/page.tsx), вычисленные ОДНИМ `now` → карточка форвардит их в
// ScoreBreakdown без повторного вычисления даты (нет new Date здесь).
//
// Иконки edit/delete — отдельные Button в ряду триггера разбивки (ScoreBreakdown
// `actions`-слот, gap-1): тап по ним НЕ переключает Collapsible (D-04, коллизия с
// LIST-07). Порядок: разбивка → edit → delete (деструктивное действие крайнее
// справа, дальше от основного потока — ниже риск случайного тапа). Тач-цель 44px
// (h-11 w-11). Длинное название усекается (`truncate`/`min-w-0`) и не выталкивает
// badge (UI-SPEC backstop). delete-иконка нейтральна в покое → text-destructive на
// hover/focus (D-04); удаление — только через подтверждение AlertDialog (D-05).
export function ItemCard({
  id,
  title,
  total,
  breakdown,
  purchased,
}: {
  id: string;
  title: string;
  total: number;
  breakdown: Contribution[];
  purchased: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        {/* Ряд заголовка: ведущий чекбокс «куплено» (h-11 w-11) → title
            (min-w-0 truncate) → badge (shrink-0) — три независимых тач-цели
            ≥44px, ряд не ломается длинным названием (§Pitfall 7 / UI-SPEC). */}
        <div className="flex items-center gap-2">
          <PurchaseCheckbox id={id} purchased={purchased} />
          <span className="min-w-0 flex-1 truncate text-xl font-semibold">
            {title}
          </span>
          <PriorityBadge total={total} />
        </div>
        <ScoreBreakdown
          breakdown={breakdown}
          total={total}
          actions={
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Редактировать покупку"
                className="h-11 w-11 shrink-0 text-muted-foreground"
              >
                <Link href={`/list/${id}/edit`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <DeleteItemButton id={id} />
            </>
          }
        />
      </CardContent>
    </Card>
  );
}
