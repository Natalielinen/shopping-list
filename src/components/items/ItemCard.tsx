import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/items/PriorityBadge";

// Карточка покупки в списке (LIST-06) — RSC. Показывает название (Heading
// 20/600) + badge приоритета. Длинное название усекается (`truncate`/`min-w-0`)
// и не выталкивает badge приоритета из карточки (UI-SPEC backstop E4).
//
// TRACER-срез: только title + badge. Раскрываемая разбивка очков (ScoreBreakdown,
// LIST-07) и необязательные поля добавляются в плане 05.
export function ItemCard({
  title,
  total,
}: {
  title: string;
  total: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xl font-semibold">{title}</span>
        <PriorityBadge total={total} />
      </CardContent>
    </Card>
  );
}
