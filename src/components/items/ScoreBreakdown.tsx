"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { Contribution } from "@/lib/scoring/scoring";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Разбивка очков (LIST-07, D-11) — client-leaf на shadcn `Collapsible` (паттерн
// "use client"-листа при серверном родителе, см. LogoutButton.tsx). Свёрнута по
// умолчанию → компактность на мобильном; раскрывается ТОЛЬКО по тапу, никогда не
// показывается постоянно (D-11).
//
// Проп `breakdown` — результат computeBreakdown(item, now), вычисленный
// родителем-RSC (list/page.tsx) тем же единственным `now`, что и computeTotal на
// этой строке. Компонент НЕ читает дату сам (нет new Date) → сумма знаковых строк
// провабельно равна total badge. `total` приходит отдельным пропом (тот же расчёт).
//
// Каналы направления: знак ± — ОСНОВНОЙ (текст), цвет — вторичный (D-11 / UI-SPEC
// §Разбивка очков). Тач-зона триггера — h-11 (44px), минимальная мобильная цель.

// Знаковое представление очков: «+N» для положительных, «-N» для отрицательных,
// «0» для нуля. Знак — первичный канал, поэтому плюс проставляется явно.
function formatSigned(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

// Цвет — вторичный канал (не перегружаем): зелёный/красный/нейтральный.
function signClass(points: number): string {
  if (points > 0) return "text-emerald-700";
  if (points < 0) return "text-red-700";
  return "text-muted-foreground";
}

function BreakdownRow({
  contributionKey,
  label,
  value,
  valueClassName,
}: {
  contributionKey: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div
      data-testid={`breakdown-${contributionKey}`}
      className="flex items-center justify-between gap-2 text-sm"
    >
      {/* Label 14/600 — подпись поля (UI-SPEC). */}
      <span className="font-semibold text-foreground">{label}</span>
      <span className={cn("tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

export function ScoreBreakdown({
  breakdown,
  total,
}: {
  breakdown: Contribution[];
  total: number;
}) {
  const [open, setOpen] = useState(false);

  const byKey = new Map(breakdown.map((c) => [c.key, c]));
  const deadline = byKey.get("deadline");
  const doubts = byKey.get("doubts");
  const credit = byKey.get("credit");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-md px-1",
          "text-sm font-medium text-muted-foreground"
        )}
      >
        <span>{open ? "Скрыть разбивку" : "Показать разбивку"}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="flex flex-col gap-2 px-1 pt-1 pb-2">
          {/* Всегда присутствующие очковые поля — в каноническом порядке UI-SPEC. */}
          {["category", "urgency", "need", "benefit"].map((key) => {
            const c = byKey.get(key);
            if (!c) return null;
            return (
              <BreakdownRow
                key={key}
                contributionKey={key}
                label={c.label}
                value={formatSigned(c.points)}
                valueClassName={signClass(c.points)}
              />
            );
          })}

          {/* Срок: знаковые очки при дедлайне, иначе «—» (вклад отсутствует → 0). */}
          <BreakdownRow
            contributionKey="deadline"
            label="Срок"
            value={deadline ? formatSigned(deadline.points) : "—"}
            valueClassName={
              deadline ? signClass(deadline.points) : "text-muted-foreground"
            }
          />

          {/* Сомнения: «нет» при «Уверен(а)» (0), иначе знаковый штраф. */}
          {doubts ? (
            <BreakdownRow
              contributionKey="doubts"
              label={doubts.label}
              value={doubts.points === 0 ? "нет" : formatSigned(doubts.points)}
              valueClassName={
                doubts.points === 0
                  ? "text-muted-foreground"
                  : signClass(doubts.points)
              }
            />
          ) : null}

          {/* Кредит: строка только при isCredit (вклад присутствует в breakdown). */}
          {credit ? (
            <BreakdownRow
              contributionKey="credit"
              label={credit.label}
              value={formatSigned(credit.points)}
              valueClassName={signClass(credit.points)}
            />
          ) : null}

          {/* Итог — согласован с badge (LIST-06/LIST-07). */}
          <div className="mt-1 flex items-center justify-between gap-2 border-t pt-2 text-sm font-semibold">
            <span>Итого: {total}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
