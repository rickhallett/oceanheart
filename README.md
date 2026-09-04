# Oceanheart

Oceanheart is Kai Hallett's Hugo practice and working-notes site, deployed to
Vercel at [www.oceanheart.ai](https://www.oceanheart.ai).

## Verify and preview

Run the complete production verifier with one command:

```sh
./build.sh
```

It checks the share-route projection and retirement service, resolves exactly
Hugo 0.159.1, builds into a clean destination, and checks the rendered site.
On Linux, the build downloads only the matching official Hugo archive and
verifies its pinned SHA256 before execution. GitHub and Vercel run this same
command.

For an attended local preview with Hugo 0.159.1 installed:

```sh
hugo server --bind 0.0.0.0 --port 1313
```

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

The main site has one deployment owner: Vercel's Git integration for `main`.
Release through a reviewed branch after `./build.sh` passes:

1. Commit only the intended files.
2. Fetch `origin/main` and require the branch is based on current `main`.
3. Push the review branch and require the GitHub `verify` check to pass.
4. Merge the reviewed branch into `main`.
5. Wait for the Git-owned Vercel production deployment to report `Ready`.
6. Verify every short route returns `308` to its canonical article.
7. Follow every redirect and require `200`, correct canonical metadata, and the
   expected Open Graph preview metadata.

Do not run `vercel deploy` for the main site. A second deployment path makes
production lineage ambiguous.

The primary checkout may contain unrelated work. Resolve the registered
worktree holding `main` before editing or deploying.

## Skins (visitor-chosen visual systems)

Every public page can be re-skinned in place by the visitor. The dock in the
bottom-right corner lists the systems; a choice persists in `localStorage`
(`oceanheart-skin`) and is mirrored into `?theme=<slug>` so a link carries the
skin. `[` and `]` cycle, `Esc` closes, `oceanheartSkins.apply('<slug>')` works
from the console. Private surfaces (`privateSurface = true`) never load skins.

How it fits together:

- `data/variants.json` is the registry: number, slug, name, family, premise,
  structure, a two-colour swatch, and whether the skin has an effects module.
- `static/css/variants/base.css` restyles the site's class vocabulary through
  CSS variables. It is inert until `body[data-variant]` is set.
- `static/css/variants/themes/<slug>.css` sets the variables and reshapes the
  page. Every rule is scoped to `body[data-variant='<slug>']`.
- `static/js/variants/<slug>.js` (optional) registers
  `window.oceanheartSkinEffects['<slug>'] = { mount, unmount }`. `unmount`
  must leave no trace: skins are previewed on hover.
- `static/js/variants.js` loads skins on demand, swaps them without a page
  load (View Transitions where available), and drives the dock.
- `layouts/partials/head.html` applies the stored or URL skin before first
  paint; `layouts/partials/variant-dock.html` renders the dock from the registry.

To add a skin: append a registry entry, add the theme stylesheet, add an
effects module if `effects` is true, and optionally one line in
`static/css/variants/scale.css` for its title sizes.

The homepage is the canonical three-door entry. `?from=ai` and `?from=systems`
may change which door comes first and prime the contact subject, while the hero
and public claims remain fixed.
