import type { Contribution } from "@/lib/scoring/scoring";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { ScoreBreakdown } from "@/components/items/ScoreBreakdown";

// Карточка покупки в списке (LIST-06) — RSC. Показывает название (Heading
// 20/600) + badge приоритета, а под ними — раскрываемую по тапу разбивку очков
// (LIST-07). Длинное название усекается (`truncate`/`min-w-0`) и не выталкивает
// badge приоритета из карточки (UI-SPEC backstop E4).
//
// `breakdown` (результат computeBreakdown(item, now)) и `total` приходят из
// родителя-RSC (list/page.tsx), вычисленные ОДНИМ `now` → карточка форвардит их в
// ScoreBreakdown без повторного вычисления даты (нет new Date здесь).
export function ItemCard({
  title,
  total,
  breakdown,
}: {
  title: string;
  total: number;
  breakdown: Contribution[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xl font-semibold">
            {title}
          </span>
          <PriorityBadge total={total} />
        </div>
        <ScoreBreakdown breakdown={breakdown} total={total} />
      </CardContent>
    </Card>
  );
}
