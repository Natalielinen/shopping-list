"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { setItemPurchased } from "@/app/(app)/list/actions";

const STATUS_ERROR = "Не удалось обновить статус. Попробуйте ещё раз.";

// Ведущий чекбокс «куплено» в ряду заголовка карточки (LIST-04 / D-04/D-05/D-08)
// — client-leaf по каркасу DeleteItemButton, но БЕЗ модалки (действие
// недеструктивно и обратимо). Отличие от Фазы 3: вместо плоского useState-pending
// — useOptimistic + useTransition (§Pitfall 3).
//
// Реконсиляция (§Pitfall 3): базовое значение useOptimistic — проп `purchased` из
// RSC. Внутри одного startTransition: setOptimistic(next) даёт мгновенный флип →
// await setItemPurchased → router.refresh() подтягивает свежие RSC-данные ДО
// завершения транзакции, поэтому оптимистичное и реальное значения совпадают —
// отскока нет. `disabled={isPending}` — guard от двойного тапа.
//
// Тап по чекбоксу НЕ переключает Collapsible разбивки (другой ряд карточки,
// §Pitfall 7 / LIST-07): три независимых тач-цели ≥44px.
export function PurchaseCheckbox({
  id,
  purchased,
}: {
  id: string;
  purchased: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(purchased);

  function toggle(next: boolean) {
    startTransition(async () => {
      // Мгновенный оптимистичный флип (§Pitfall 3) — только внутри транзакции.
      setOptimistic(next);

      const res = await setItemPurchased(id, next);
      if (!res.ok) {
        // Ошибка: оптимистичное значение откатится по завершении транзакции.
        toast.error(STATUS_ERROR);
        return;
      }

      // Ресинк RSC-групп внутри той же транзакции (§Pitfall 3) — покупка меняет
      // группу (уходит из активного списка / возвращается).
      router.refresh();

      if (next) {
        toast("Покупка отмечена купленной", {
          action: { label: "Отменить", onClick: () => toggle(false) },
        });
      } else {
        // Возврат — сам по себе undo прямого действия; кнопки «Отменить» нет
        // (Open Question 1: меньше визуального шума).
        toast("Покупка возвращена в активные");
      }
    });
  }

  return (
    <Checkbox
      checked={optimistic}
      disabled={isPending}
      onCheckedChange={(v) => toggle(v === true)}
      aria-label={optimistic ? "Вернуть в активные" : "Отметить купленной"}
      className="h-11 w-11 shrink-0"
    />
  );
}
