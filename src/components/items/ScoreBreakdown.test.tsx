import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Contribution } from "@/lib/scoring/scoring";
import { ScoreBreakdown } from "./ScoreBreakdown";

// Разбивка очков (LIST-07, D-11). Компонент — чистый client-leaf: принимает
// массив вкладов (результат computeBreakdown(item, now), вычислен родителем-RSC)
// и total прямо как пропсы, поэтому тест конструирует вклады вручную и не зависит
// ни от даты, ни от движка подсчёта.

// Полный набор вкладов (все поля + дедлайн + кредит). Сумма points = total.
const fullBreakdown: Contribution[] = [
  { key: "category", label: "Категория", points: 10 },
  { key: "urgency", label: "Срочность", points: 12 },
  { key: "need", label: "Необходимость", points: 2 },
  { key: "benefit", label: "Выгода", points: 2 },
  { key: "doubts", label: "Сомнения", points: -1 },
  { key: "deadline", label: "Срок", points: 28 },
  { key: "credit", label: "Кредит", points: -2 },
];
const FULL_TOTAL = 51; // 10 + 12 + 2 + 2 − 1 + 28 − 2

// Минимальный набор: без дедлайна, без кредита, «Уверен(а)» (doubts = 0).
const minimalBreakdown: Contribution[] = [
  { key: "category", label: "Категория", points: 5 },
  { key: "urgency", label: "Срочность", points: 3 },
  { key: "need", label: "Необходимость", points: 1 },
  { key: "benefit", label: "Выгода", points: 0 },
  { key: "doubts", label: "Сомнения", points: 0 },
];
const MINIMAL_TOTAL = 9; // 5 + 3 + 1 + 0 + 0

describe("ScoreBreakdown", () => {
  it("свёрнут по умолчанию: строки скрыты, виден аффорданс «Показать разбивку»", () => {
    render(<ScoreBreakdown breakdown={fullBreakdown} total={FULL_TOTAL} />);

    expect(
      screen.getByRole("button", { name: "Показать разбивку" })
    ).toBeInTheDocument();
    // Свёрнутая панель не рендерит содержимое (Radix Collapsible).
    expect(screen.queryByText(`Итого: ${FULL_TOTAL}`)).not.toBeInTheDocument();
    expect(screen.queryByText("Категория")).not.toBeInTheDocument();
  });

  it("раскрывается по тапу: строки видны, аффорданс становится «Скрыть разбивку»", async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown breakdown={fullBreakdown} total={FULL_TOTAL} />);

    await user.click(screen.getByRole("button", { name: "Показать разбивку" }));

    expect(
      screen.getByRole("button", { name: "Скрыть разбивку" })
    ).toBeInTheDocument();
    expect(screen.getByText(`Итого: ${FULL_TOTAL}`)).toBeInTheDocument();
    expect(screen.getByText("Категория")).toBeInTheDocument();
  });

  it("для полной покупки с кредитом показывает строку на каждый вклад + «Итого»", async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown breakdown={fullBreakdown} total={FULL_TOTAL} />);
    await user.click(screen.getByRole("button", { name: "Показать разбивку" }));

    for (const label of [
      "Категория",
      "Срочность",
      "Необходимость",
      "Выгода",
      "Срок",
      "Сомнения",
      "Кредит",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Знак ± — основной канал направления: плюс у положительных, минус у кредита.
    expect(
      within(screen.getByTestId("breakdown-category")).getByText("+10")
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("breakdown-credit")).getByText("-2")
    ).toBeInTheDocument();
    expect(screen.getByText(`Итого: ${FULL_TOTAL}`)).toBeInTheDocument();
  });

  it("без дедлайна показывает «Срок: —», без кредита не рендерит строку «Кредит», при «Уверен(а)» — «Сомнения: нет»", async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown breakdown={minimalBreakdown} total={MINIMAL_TOTAL} />);
    await user.click(screen.getByRole("button", { name: "Показать разбивку" }));

    expect(
      within(screen.getByTestId("breakdown-deadline")).getByText("—")
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("breakdown-doubts")).getByText("нет")
    ).toBeInTheDocument();
    expect(screen.queryByText("Кредит")).not.toBeInTheDocument();
    expect(screen.getByText(`Итого: ${MINIMAL_TOTAL}`)).toBeInTheDocument();
  });

  it("сумма знаковых строк равна total (согласованность с badge)", async () => {
    const user = userEvent.setup();
    render(<ScoreBreakdown breakdown={fullBreakdown} total={FULL_TOTAL} />);
    await user.click(screen.getByRole("button", { name: "Показать разбивку" }));

    const sum = fullBreakdown.reduce((acc, c) => acc + c.points, 0);
    expect(sum).toBe(FULL_TOTAL);
    expect(screen.getByText(`Итого: ${sum}`)).toBeInTheDocument();
  });
});
