# Oceanheart

Oceanheart is Rick Hallett's Hugo portfolio and working-notes site, deployed to
Vercel at [www.oceanheart.ai](https://www.oceanheart.ai).

## Local build

The production build pins Hugo through `build.sh`:

```sh
hugo
./build.sh
vercel build --prod
```

These are separate gates. A local Hugo build does not prove that Vercel's
production builder accepts the repository.

## Share-friendly blog routes

The dated Hugo article URL is permanent and remains the canonical SEO URL. Each
publicly rendered blog article also owns at least one short, stable root alias in
its TOML frontmatter:

```toml
aliases = ["/ai/"]
draft = false

[build]
render = "always"
list = "always"
```

Hugo generates a static alias page as a hosting-independent fallback. Vercel
serves the same alias as a permanent `308` redirect to the dated canonical
article.

After adding, removing, or changing an alias, regenerate the Vercel routes:

```sh
node scripts/sync-share-routes.mjs --write
node scripts/sync-share-routes.mjs --check
node scripts/sync-share-routes.mjs --list
```

`--write` updates only redirects whose destination is under `/blog/` and
preserves unrelated manual redirects. `build.sh` runs `--check`, so a stale
`vercel.json`, duplicate alias, missing alias, malformed alias, or collision
with an existing root route fails the build.

Alias rules:

- Use one lowercase root path segment, such as `/ai/` or `/photo-curation/`.
- Choose a short semantic name that will remain tied to that article.
- Never repoint a permanent alias to a newer article. Add a new alias instead.
- Do not replace the dated filename with `slug` or `url` merely to shorten it.
- Add aliases only to articles that are intentionally public.

The current mappings can be inspected without changing files:

```sh
node scripts/sync-share-routes.mjs --list
```

## Production release

Release only from the clean registered `main` worktree linked to the Vercel
project named `oceanheart`. After the three build gates pass:

1. Commit only the intended files.
2. Fetch `origin/main` and require no remote-only commits.
3. Push `main`.
4. Re-run `vercel build --prod` from the committed state.
5. Deploy with `vercel deploy --prebuilt --prod`.
6. Verify every short route returns `308` to its canonical article.
7. Follow every redirect and require `200`, correct canonical metadata, and the
   expected Open Graph preview metadata.

The primary checkout may contain unrelated work. Resolve the registered
worktree holding `main` before editing or deploying.
