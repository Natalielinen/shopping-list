"use client";

// Route-level граница ошибок группы `(app)` (UI-SPEC — error state для сбоя
// слоя данных). Показывает общее сообщение (без технических деталей) и
// affordance повторной попытки. Обязана быть client-компонентом (контракт
// Next.js для `error.tsx`) — но это лист без доступа к серверным секретам.
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-base text-muted-foreground">
        Что-то пошло не так. Попробуйте ещё раз.
      </p>
      <Button onClick={reset} className="h-11">
        Повторить
      </Button>
    </div>
  );
}
