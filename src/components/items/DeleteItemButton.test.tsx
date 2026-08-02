import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Моки навигации и Server Action: компонентный тест изолирован от роутера Next и
// от сети. deleteItem управляем вручную, чтобы проверить успех/ошибку/pending
// (аналог AddItemForm.test.tsx). refresh — наблюдаемый эффект успешного удаления.
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const deleteItem = vi.fn();
vi.mock("@/app/(app)/list/[id]/edit/actions", () => ({
  deleteItem: (...args: unknown[]) => deleteItem(...args),
}));

import { DeleteItemButton } from "./DeleteItemButton";

const ITEM_ID = "item-1";

// pointerEventsCheck отключён: Radix AlertDialog навешивает pointer-events на
// портал (те же Radix-шимы в vitest.setup.ts, что и для Select — Pitfall 9).
function setup() {
  return userEvent.setup({ pointerEventsCheck: 0 });
}

describe("DeleteItemButton", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    deleteItem.mockReset();
    deleteItem.mockResolvedValue({ ok: true });
  });

  it("открывает диалог подтверждения по иконке «Удалить покупку»", async () => {
    const user = setup();
    render(<DeleteItemButton id={ITEM_ID} />);

    // До клика диалог не показан (тихого удаления нет — D-05).
    expect(
      screen.queryByRole("alertdialog", { name: "Удалить покупку?" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Удалить покупку" }));

    expect(
      await screen.findByRole("alertdialog", { name: "Удалить покупку?" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Действие необратимо — восстановить покупку будет нельзя.")
    ).toBeInTheDocument();
  });

  it("«Отмена» закрывает диалог, НЕ вызывая deleteItem", async () => {
    const user = setup();
    render(<DeleteItemButton id={ITEM_ID} />);

    await user.click(screen.getByRole("button", { name: "Удалить покупку" }));
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Отмена" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(deleteItem).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("подтверждение вызывает deleteItem(id) один раз и router.refresh() при успехе", async () => {
    const user = setup();
    render(<DeleteItemButton id={ITEM_ID} />);

    await user.click(screen.getByRole("button", { name: "Удалить покупку" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith(ITEM_ID);
    // Успех → диалог закрыт.
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
  });

  it("при { ok: false } диалог остаётся открыт и показывает текст ошибки", async () => {
    deleteItem.mockResolvedValue({
      ok: false,
      error: "Не удалось удалить покупку. Попробуйте ещё раз.",
    });
    const user = setup();
    render(<DeleteItemButton id={ITEM_ID} />);

    await user.click(screen.getByRole("button", { name: "Удалить покупку" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    // Диалог НЕ закрылся (e.preventDefault удержал Radix), ошибка видна, refresh нет.
    expect(
      await screen.findByText("Не удалось удалить покупку. Попробуйте ещё раз.")
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("во время pending кнопка «Удалить» disabled (защита от двойного клика)", async () => {
    // deleteItem зависает до ручного разрешения — состояние pending наблюдаемо.
    let resolve!: (v: { ok: true }) => void;
    deleteItem.mockReturnValue(
      new Promise<{ ok: true }>((r) => {
        resolve = r;
      })
    );
    const user = setup();
    render(<DeleteItemButton id={ITEM_ID} />);

    await user.click(screen.getByRole("button", { name: "Удалить покупку" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Удалить" }));

    const confirm = screen.getByRole("button", { name: "Удалить" });
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();

    resolve({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
