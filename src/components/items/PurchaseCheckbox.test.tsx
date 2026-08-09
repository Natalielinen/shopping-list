import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Моки навигации, Server Action и sonner: компонентный тест изолирован от роутера
// Next, от сети и от тост-рантайма (каркас DeleteItemButton.test.tsx). refresh —
// наблюдаемый эффект успешного переключения; setItemPurchased управляем вручную.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const setItemPurchased = vi.fn();
vi.mock("@/app/(app)/list/actions", () => ({
  setItemPurchased: (...args: unknown[]) => setItemPurchased(...args),
}));

// toast вызывается и как функция (toast(...)), и как toast.error(...).
const toastFn = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toastFn(...args), {
    error: (...args: unknown[]) => toastError(...args),
  }),
}));

import { PurchaseCheckbox } from "./PurchaseCheckbox";

const ITEM_ID = "item-1";

// pointerEventsCheck отключён для консистентности с Radix-шимами проекта (Pitfall 9).
function setup() {
  return userEvent.setup({ pointerEventsCheck: 0 });
}

describe("PurchaseCheckbox", () => {
  beforeEach(() => {
    refresh.mockReset();
    setItemPurchased.mockReset();
    setItemPurchased.mockResolvedValue({ ok: true });
    toastFn.mockReset();
    toastError.mockReset();
  });

  it("A: видимый глиф чекбокса нормального размера (size-5, без h-11/w-11)", () => {
    render(<PurchaseCheckbox id={ITEM_ID} purchased={false} />);

    const checkbox = screen.getByRole("checkbox");
    const className = checkbox.className;
    // Сам глиф не 44px: класса h-11/w-11 на элементе-чекбоксе нет.
    expect(className).not.toMatch(/\bh-11\b/);
    expect(className).not.toMatch(/\bw-11\b/);
    // Глиф обычного размера — size-5 (20px).
    expect(className).toContain("size-5");
  });

  it("B: тач-зона ≥44px — обёртка-родитель несёт h-11 w-11 shrink-0", () => {
    render(<PurchaseCheckbox id={ITEM_ID} purchased={false} />);

    const checkbox = screen.getByRole("checkbox");
    const zone = checkbox.parentElement;
    expect(zone).not.toBeNull();
    expect(zone).toHaveClass("h-11", "w-11", "shrink-0");
  });

  it("C: тап по тач-зоне вызывает setItemPurchased(id, true) один раз", async () => {
    const user = setup();
    render(<PurchaseCheckbox id={ITEM_ID} purchased={false} />);

    const checkbox = screen.getByRole("checkbox");
    // Клик по обёртке-тач-зоне (родителю): label форвардит клик на вложенный
    // labelable button чекбокса.
    await user.click(checkbox.parentElement as HTMLElement);

    await waitFor(() =>
      expect(setItemPurchased).toHaveBeenCalledWith(ITEM_ID, true)
    );
    expect(setItemPurchased).toHaveBeenCalledTimes(1);
  });

  it("D: aria-labels без регрессий (Отметить купленной / Вернуть в активные)", () => {
    const { unmount } = render(
      <PurchaseCheckbox id={ITEM_ID} purchased={false} />
    );
    expect(
      screen.getByRole("checkbox", { name: "Отметить купленной" })
    ).toBeInTheDocument();
    unmount();

    render(<PurchaseCheckbox id={ITEM_ID} purchased={true} />);
    expect(
      screen.getByRole("checkbox", { name: "Вернуть в активные" })
    ).toBeInTheDocument();
  });
});
