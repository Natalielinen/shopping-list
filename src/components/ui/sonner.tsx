"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Упрощённая обёртка sonner (UI-SPEC §Про sonner): тёмной темы в проекте нет,
// поэтому фиксируем `theme="light"` и НЕ тянем зависимость `next-themes`
// (дефолтная обёртка shadcn импортирует `useTheme` — здесь она убрана,
// §Anti-Patterns RESEARCH). `<Toaster>` — client-leaf, монтируется один раз в
// `(app)/layout.tsx`.
function Toaster(props: ToasterProps) {
  return <Sonner theme="light" className="toaster group" {...props} />;
}

export { Toaster };
