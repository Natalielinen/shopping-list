"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import {
  deleteItem,
  type DeleteItemResult,
} from "@/app/(app)/list/[id]/edit/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DELETE_ERROR = "Не удалось удалить покупку. Попробуйте ещё раз.";

// Кнопка удаления покупки (ITEM-08 / D-04/D-05/D-06/D-07) — client-leaf по каркасу
// LogoutButton (useRouter + useState + async try/catch), обёрнутый в AlertDialog.
//
// Удаление НИКОГДА не происходит тихо (D-05): триггер-иконка «корзина» открывает
// модальное подтверждение (role="alertdialog" от Radix). Только подтверждение
// вызывает Server Action deleteItem(id) — userId берётся из сессии на сервере,
// чужую покупку удалить нельзя (D-06, T-3-05). При успехе — router.refresh()
// перерендерит RSC-список, покупка исчезает (D-07, остаёмся на /list).
//
// Отказоустойчивость (T-3-06): AlertDialogAction.onClick вызывает
// e.preventDefault() ДО handleDelete — иначе Radix закрыл бы диалог до завершения
// async, и при ошибке пользователь не увидел бы, что покупка не удалена. pending-
// guard (disabled при isPending) защищает от двойного клика.
export function DeleteItemButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsPending(true);
    setError(null);

    let res: DeleteItemResult;
    try {
      res = await deleteItem(id);
    } catch {
      setError(DELETE_ERROR);
      setIsPending(false);
      return;
    }

    if (!res.ok) {
      setError(res.error);
      setIsPending(false);
      return;
    }

    // Успех: закрываем диалог и обновляем серверный список — покупка исчезает.
    setOpen(false);
    router.refresh();
  }

  // Сброс ошибки при закрытии диалога (следующее открытие — чистое состояние).
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Удалить покупку"
          className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold">
            Удалить покупку?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Действие необратимо — восстановить покупку будет нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          {/* «Отмена» — безопасный выбор, начальный фокус (Radix фокусирует Cancel). */}
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          {/* «Удалить» — единственная filled-destructive кнопка фазы (UI-SPEC). */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
