"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { SortKey } from "@/lib/list/sort";

// Закреплённая панель управления списком (D-01/D-06/D-09/D-10, §UI-SPEC «Панель
// управления»). Чистый client-leaf: НЕ держит состояние, а получает текущие
// sortKey/showPurchased и колбэки — эфемерный useState живёт в ListView (D-09,
// НЕ URL/localStorage/nuqs). Перезагрузка сбрасывает к дефолту (priority + OFF).
//
// Раскладка на 375px (§UI-SPEC): вертикальный стек в два ряда, а НЕ один —
// длинный русский label «Показывать купленные» рядом с Select сжал бы обе тач-
// цели ниже 44px. Ряд A — полноширинный Select (h-11), ряд B — строка фильтра
// (min-h-11), клик по label-обёртке переключает чекбокс. sticky top-0 + bg-
// background + border-b: панель закреплена и НЕ просвечивает под карточками.

// Ровно 3 опции сортировки в порядке D-01: приоритет (default) → дата → алфавит.
const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "priority", label: "По приоритету" },
  { value: "createdAt", label: "По дате добавления" },
  { value: "title", label: "По алфавиту" },
];

export function ListControls({
  sortKey,
  showPurchased,
  onSortKeyChange,
  onShowPurchasedChange,
}: {
  sortKey: SortKey;
  showPurchased: boolean;
  onSortKeyChange: (key: SortKey) => void;
  onShowPurchasedChange: (value: boolean) => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-4 py-3">
      {/* Ряд A: Select сортировки во всю ширину строки, тач-цель ≥44px (h-11). */}
      <Select
        value={sortKey}
        onValueChange={(value) => onSortKeyChange(value as SortKey)}
      >
        <SelectTrigger aria-label="Сортировка" className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Ряд B: строка фильтра «показывать купленные» (D-06). label-обёртка даёт
          тач-зону ≥44px (min-h-11) и переключает чекбокс кликом по всей строке. */}
      <label className="flex min-h-11 cursor-pointer items-center gap-2">
        <Checkbox
          checked={showPurchased}
          onCheckedChange={(value) => onShowPurchasedChange(value === true)}
        />
        <span className="text-base">Показывать купленные</span>
      </label>
    </div>
  );
}
