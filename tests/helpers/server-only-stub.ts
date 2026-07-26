// Пустая заглушка для пакета `server-only` в тестовой среде Vitest.
// В рантайме Next.js `server-only` падает при импорте из клиентского бандла,
// но под Vitest (Node) серверные модули (auth.ts, db/client.ts, repos) нужно
// импортировать напрямую, поэтому `server-only` алиасится на этот no-op.
export {};
