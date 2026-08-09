import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SortKey } from "@/lib/list/sort";
import { ListControls } from "./ListControls";

// Панель управления (LIST-01/02/03/05, D-01/D-06/D-09). Компонент — чистый
// client-leaf: держит НЕ состояние, а получает текущие sortKey/showPurchased и
// колбэки onSortKeyChange/onShowPurchasedChange (состояние живёт в ListView).
// Поэтому тест конструирует пропсы вручную и наблюдает вызовы колбэков — без
// роутера, сети и БД.
//
// pointerEventsCheck отключён: Radix Select навешивает pointer-events на портал
// (те же jsdom-шимы Pitfall 9, что и для Select в AddItemForm.test.tsx).
function setup() {
  return userEvent.setup({ pointerEventsCheck: 0 });
}

function renderControls(overrides?: {
  sortKey?: SortKey;
  showPurchased?: boolean;
  onSortKeyChange?: (key: SortKey) => void;
  onShowPurchasedChange?: (value: boolean) => void;
}) {
  const onSortKeyChange = overrides?.onSortKeyChange ?? vi.fn();
  const onShowPurchasedChange = overrides?.onShowPurchasedChange ?? vi.fn();
  render(
    <ListControls
      sortKey={overrides?.sortKey ?? "priority"}
      showPurchased={overrides?.showPurchased ?? false}
      onSortKeyChange={onSortKeyChange}
      onShowPurchasedChange={onShowPurchasedChange}
    />
  );
  return { onSortKeyChange, onShowPurchasedChange };
}

describe("ListControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("рендерит Select сортировки (aria-label «Сортировка») с дефолтом «По приоритету»", () => {
    renderControls();

    const trigger = screen.getByRole("combobox", { name: "Сортировка" });
    expect(trigger).toBeInTheDocument();
    // Контролируемое значение priority → в триггере видна подпись дефолта.
    expect(trigger).toHaveTextContent("По приоритету");
  });

  it("открытый Select показывает ровно 3 опции в порядке D-01: приоритет → дата → алфавит", async () => {
    const user = setup();
    renderControls();

    await user.click(screen.getByRole("combobox", { name: "Сортировка" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "По приоритету",
      "По дате добавления",
      "По алфавиту",
    ]);
  });

  it("выбор опции «По алфавиту» вызывает onSortKeyChange('title')", async () => {
    const user = setup();
    const { onSortKeyChange } = renderControls();

    await user.click(screen.getByRole("combobox", { name: "Сортировка" }));
    await user.click(
      await screen.findByRole("option", { name: "По алфавиту" })
    );

    expect(onSortKeyChange).toHaveBeenCalledTimes(1);
    expect(onSortKeyChange).toHaveBeenCalledWith("title");
  });

  it("выбор опции «По дате добавления» вызывает onSortKeyChange('createdAt')", async () => {
    const user = setup();
    const { onSortKeyChange } = renderControls();

    await user.click(screen.getByRole("combobox", { name: "Сортировка" }));
    await user.click(
      await screen.findByRole("option", {
        name: "По дате добавления",
      })
    );

    expect(onSortKeyChange).toHaveBeenCalledWith("createdAt");
  });

  it("рендерит чекбокс фильтра «Показывать купленные», по умолчанию снят (default OFF)", () => {
    renderControls({ showPurchased: false });

    const checkbox = screen.getByRole("checkbox", {
      name: "Показывать купленные",
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("клик по чекбоксу фильтра вызывает onShowPurchasedChange(true)", async () => {
    const user = setup();
    const { onShowPurchasedChange } = renderControls({ showPurchased: false });

    await user.click(
      screen.getByRole("checkbox", { name: "Показывать купленные" })
    );

    expect(onShowPurchasedChange).toHaveBeenCalledTimes(1);
    expect(onShowPurchasedChange).toHaveBeenCalledWith(true);
  });

  it("при showPurchased=true чекбокс отмечен, клик вызывает onShowPurchasedChange(false)", async () => {
    const user = setup();
    const { onShowPurchasedChange } = renderControls({ showPurchased: true });

    const checkbox = screen.getByRole("checkbox", {
      name: "Показывать купленные",
    });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(onShowPurchasedChange).toHaveBeenCalledWith(false);
  });
});
