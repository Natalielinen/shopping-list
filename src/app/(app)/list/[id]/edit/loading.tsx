import { Loader2 } from "lucide-react";

// Route-level loading-состояние маршрута /list/[id]/edit (UI-SPEC S4 backstop):
// показывается, пока RSC-обёртка грузит покупку и готовит предзаполненную форму —
// без пустого кадра до готовности. Заголовок совпадает со страницей, чтобы
// переход читался непрерывно.
export default function EditItemLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Редактировать покупку</h1>
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Загрузка" />
      </div>
    </div>
  );
}
