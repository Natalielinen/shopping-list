---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-07-26T15:23:37.145Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | todo | src/components/app/AppHeader.tsx |  | Слот под кнопку «Выйти» не реализован (D-08 partial) — logout в плане 01-04 | open |  | 2026-07-26T15:23:36.681Z |  |
| 2 | 01 | stub | src/app/(app)/list/page.tsx |  | Ветка непустого списка (items.map) — заготовка на Фазу 2, в Фазе 1 недостижима (D-13 read-only) | open |  | 2026-07-26T15:23:37.145Z |  |

````json
[
  {
    "id": 1,
    "kind": "todo",
    "phase": "01",
    "file": "src/components/app/AppHeader.tsx",
    "line": null,
    "description": "Слот под кнопку «Выйти» не реализован (D-08 partial) — logout в плане 01-04",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-26T15:23:36.681Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "01",
    "file": "src/app/(app)/list/page.tsx",
    "line": null,
    "description": "Ветка непустого списка (items.map) — заготовка на Фазу 2, в Фазе 1 недостижима (D-13 read-only)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-26T15:23:37.145Z",
    "resolved_at": null
  }
]
````
