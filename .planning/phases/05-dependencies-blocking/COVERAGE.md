# Phase 5 — API Coverage

No external API integration: фаза добавляет self-referencing FK `depends_on` в таблице `items`, чистую логику блокировки/циклов (`src/lib/deps/`) и серверный guard — всё поверх локального Postgres и существующих Server Actions; ни одного внешнего API / SDK / сервиса не вызывается.
