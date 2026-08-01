import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Моки навигации и Server Action: компонентный тест изолирован от роутера Next и
// от сети. createItem управляем вручную, чтобы проверить pending-состояние кнопки
// (аналог RegisterForm.test.tsx, где так же мокался серверный вызов).
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const createItem = vi.fn();
vi.mock("@/app/(app)/list/new/actions", () => ({
  createItem: (...args: unknown[]) => createItem(...args),
}));

import { AddItemForm } from "./AddItemForm";

// Хелпер выбора значения в Radix Select: клик по триггеру (ассоциирован с
// FormLabel через htmlFor) → клик по пункту. pointerEventsCheck отключён, т.к.
// Radix навешивает pointer-events на портал (Pitfall 9 — шимы уже в setup).
async function selectValue(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionText: string
) {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole("option", { name: optionText }));
}

describe("AddItemForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    createItem.mockReset();
  });

  it("рендерит лейблы всех полей формы", () => {
    render(<AddItemForm />);
    for (const label of [
      "Название",
      "Категория",
      "Срочность",
      "Необходимость",
      "Выгода",
      "Ссылка",
      "Описание",
      "Цена",
      "Срок",
      "Сомнения",
      "Покупка в кредит",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("doubts по умолчанию «Уверен(а)»", () => {
    render(<AddItemForm />);
    // Триггер Select «Сомнения» отображает выбранное значение по умолчанию.
    expect(screen.getByLabelText("Сомнения")).toHaveTextContent("Уверен(а)");
  });

  it("поле «Ежемесячный платёж» появляется только при isCredit и скрывается при снятии", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AddItemForm />);

    expect(screen.queryByText("Ежемесячный платёж")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Покупка в кредит"));
    expect(screen.getByText("Ежемесячный платёж")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Покупка в кредит"));
    expect(screen.queryByText("Ежемесячный платёж")).not.toBeInTheDocument();
  });

  it("очищает monthlyPayment при снятии isCredit (скрытое поле не сохраняет старое число)", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AddItemForm />);

    await user.click(screen.getByLabelText("Покупка в кредит"));
    const payment = screen.getByLabelText("Ежемесячный платёж");
    await user.type(payment, "5000");
    expect(payment).toHaveValue("5000");

    // Снятие → повторное включение: поле должно быть пустым (setValue undefined).
    await user.click(screen.getByLabelText("Покупка в кредит"));
    await user.click(screen.getByLabelText("Покупка в кредит"));
    expect(screen.getByLabelText("Ежемесячный платёж")).toHaveValue("");
  });

  it("не вызывает createItem и показывает «Заполните это поле» при пустом title", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<AddItemForm />);

    await user.click(screen.getByRole("button", { name: "Добавить покупку" }));

    expect(await screen.findByText("Заполните это поле")).toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("успешный submit вызывает createItem один раз, блокирует кнопку и делает push на /list", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let resolve!: (v: { ok: true }) => void;
    createItem.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    render(<AddItemForm />);

    await user.type(screen.getByLabelText("Название"), "Молоко");
    await selectValue(user, "Категория", "Здоровье");
    await selectValue(user, "Срочность", "Срочно");
    await selectValue(user, "Необходимость", "Нужно");
    await selectValue(user, "Выгода", "Приносит доход");

    const button = screen.getByRole("button", { name: "Добавить покупку" });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(createItem).toHaveBeenCalledTimes(1);

    resolve({ ok: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/list"));
  });
});
