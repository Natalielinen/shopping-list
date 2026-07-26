// Подключает матчеры jest-dom (`toBeInTheDocument`, `toHaveValue` и т.п.) для
// компонентных тестов на React Testing Library. Для чистых unit-тестов Zod-схем
// матчеры не требуются, но setup общий для всего прогонщика.
import "@testing-library/jest-dom/vitest";
