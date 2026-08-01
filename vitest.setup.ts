// Подключает матчеры jest-dom (`toBeInTheDocument`, `toHaveValue` и т.п.) для
// компонентных тестов на React Testing Library. Для чистых unit-тестов Zod-схем
// матчеры не требуются, но setup общий для всего прогонщика.
import "@testing-library/jest-dom/vitest";

// jsdom-шимы для Radix-примитивов (Pitfall 9). jsdom не реализует
// `Element.hasPointerCapture`/`scrollIntoView` и глобальный `ResizeObserver`,
// на которые опираются Radix Select/Collapsible при взаимодействии. Без этих
// заглушек RTL-тесты дропдаунов/раскрытий в планах 04/05 падают при клике.
// Шимы применяются только в jsdom-окружении: node-тесты (`@vitest-environment
// node`) не имеют `Element` и не нуждаются в них.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
