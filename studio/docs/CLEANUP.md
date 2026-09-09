# Studio cleanup inventory

Active checkout: `studio-dev/studio`, branch `studio/dev`.

Moved Precision, Editorial and Graphite into `_archive/studio-design-2026-09-09` and removed generated build caches and dependency links. Retained source and visual evidence. Comparison launcher now points to development. Unrelated contents of the separate `design-variants` repository were left intact.

## Remaining historical worktrees

These are Git worktrees, not disposable copies. Deleting one may lose uncommitted work; archive/reconcile its changes first.

| Folder | Branch | Working tree | Disposition |
| --- | --- | --- | --- |
| studio | feat/oceanheart-studio | 0 modified/untracked paths | Preserve; review unique work before removal |
| studio-backend | feat/managed-clerk-backend | 0 modified/untracked paths | Preserve; review unique work before removal |
| studio-chakra | feat/studio-chakra | 33 modified/untracked paths | Preserve; review unique work before removal |
| studio-ci | feat/ric-100-studio-ci | 0 modified/untracked paths | Preserve; review unique work before removal |
| studio-typography | feat/authenticated-practice | 0 modified/untracked paths | Preserve; review unique work before removal |
| studio-untitled | feat/studio-untitled-free | 25 modified/untracked paths | Preserve; review unique work before removal |

Next cleanup pass: compare each branch with main and studio/dev; commit or export unique changes, then use git worktree remove only on verified redundant clean checkouts. Do not delete the shared Git store. Public website, business-card and leaflet work are outside this Studio cleanup.
