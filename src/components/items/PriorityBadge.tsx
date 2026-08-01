import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";

import { priorityLevel, type PriorityLevel } from "@/lib/scoring/scoring";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Badge приоритета (LIST-06 / D-10) — RSC-leaf. Кодирует уровень ЧЕТЫРЬМЯ
// избыточными каналами (не только цветом): число total + текстовая метка уровня
// + lucide-иконка направления + цвет подложки. Метки — фиксированные короткие
// слова (динамического длинного текста нет). Палитра/иконки — из UI-SPEC
// §Семантическая палитра приоритета. `whitespace-nowrap` держит badge в одну
// строку даже при трёхзначном total (напр. 126 при просрочке, backstop E2).
const PRIORITY_META: Record<
  PriorityLevel,
  { label: string; icon: LucideIcon; className: string }
> = {
  high: { label: "Высокий", icon: ArrowUp, className: "bg-red-100 text-red-700" },
  medium: {
    label: "Средний",
    icon: ArrowRight,
    className: "bg-amber-100 text-amber-700",
  },
  low: {
    label: "Низкий",
    icon: ArrowDown,
    className: "bg-neutral-100 text-neutral-600",
  },
};

export function PriorityBadge({ total }: { total: number }) {
  const level = priorityLevel(total);
  const { label, icon: Icon, className } = PRIORITY_META[level];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto shrink-0 gap-1 whitespace-nowrap border-transparent px-2 py-1 text-sm font-medium",
        className
      )}
    >
      <Icon aria-hidden />
      <span>{label}</span>
      <span aria-hidden>·</span>
      <span>{total}</span>
    </Badge>
  );
}
