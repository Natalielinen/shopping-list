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
//
// Размер (G-04-2 / UI-SPEC §Spacing): видимый глиф — обычного размера (size-5),
// а требуемая тач-зона ≥44px обеспечивается обёрткой-<label> (h-11 w-11) вокруг
// чекбокса. Клик по всей зоне форвардится label'ом на вложенный labelable button
// чекбокса → onCheckedChange срабатывает по тапу в любой точке зоны. Обёртка
// оборачивает ТОЛЬКО чекбокс, поэтому Collapsible разбивки не затрагивается.
export function PurchaseCheckbox({
  id,
  purchased,
  blocked = false,
  dependencyTitle = null,
}: {
  id: string;
  purchased: boolean;
  // Блокировка (DEP-01 / D-03/D-04): при blocked чекбокс disabled и не переключается.
  // Опциональны с дефолтами — незаблокированные вызовы (и тесты) не обязаны их
  // передавать (обратная совместимость с Фазой 4).
  blocked?: boolean;
  dependencyTitle?: string | null;
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
    // Обёртка-тач-зона 44×44px (§Spacing / G-04-2): label форвардит тап на
    // вложенный чекбокс, поэтому клик по всей зоне переключает статус, а сам
    // глиф остаётся нормального размера (size-5).
    <label className="flex h-11 w-11 shrink-0 items-center justify-center">
      <Checkbox
        checked={optimistic}
        // Блокировка (DEP-01 / D-03): disabled при blocked — Radix-приглушение +
        // cursor-not-allowed, тап игнорируется (тач-зона-обёртка 44px сохранена).
        disabled={isPending || blocked}
        onCheckedChange={(v) => toggle(v === true)}
        aria-label={
          blocked
            ? `Нельзя отметить купленной, пока не куплено «${dependencyTitle}»`
            : optimistic
              ? "Вернуть в активные"
              : "Отметить купленной"
        }
        className="size-5"
      />
    </label>
  );
}
