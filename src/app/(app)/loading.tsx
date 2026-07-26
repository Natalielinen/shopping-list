// Route-level загрузочный скелет группы `(app)` (UI-SPEC — loading state).
// Показывается, пока серверная страница списка резолвит сессию и данные.
export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
      <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
