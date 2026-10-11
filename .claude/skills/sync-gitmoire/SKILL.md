---
name: sync-gitmoire
description: Sync the gitmoire landing page (this repo's site/) with the main gitmoire repo at ~/Projects/gitmoire. Use when asked to sync, update or refresh the landing page, after a new gitmoire release, when the changelog, roadmap, themes or shortcuts changed upstream, or when screenshots are stale. Covers data sync, copy that goes stale, screenshot refresh, verification, and what never to publish.
---

# Sync the landing page with gitmoire

`site/` is a static page. Its facts come from the private repo at
`~/Projects/gitmoire` (override with `GITMOIRE_SRC` or `--src`). Nothing here
deploys or commits by itself: finish with a summary and let the user decide.

```
~/Projects/gitmoire ──scripts/sync.mjs──▶ content/source/    gitignored mirror (internal notes)
                                      └─▶ site/data/*.json   committed, public-safe
                                      └─▶ site/assets/themes.css  generated tokens
demo-mode UI ────────scripts/capture-shots.mjs──▶ site/assets/shots/*.webp
site/ ───────────────scripts/check-site.mjs──▶ pass / fail
```

## What counts as "released"

The page may only state what is in a release. `sync.mjs` therefore reads
**product facts at the latest release tag** (changelog, shortcuts, themes,
lane palettes, package version) and **planning docs at HEAD** (roadmap, ledger).
Uncommitted or unreleased work in the source tree stays off the page.
`--worktree` reads the working tree instead: use it only to preview a release
that is about to be tagged.

## Workflow

### 1. Data

```sh
git -C ~/Projects/gitmoire describe --tags --abbrev=0     # which release are we syncing to?
node scripts/sync.mjs
git diff --stat site/data site/assets/themes.css
```

Read the diff, not just the exit code:

- `releases.json`: a new top entry means a new version. Its `summary` and
  highlights come from the changelog prose.
- `roadmap.json`: progress and status per potion. Ledger ids (DMS-xxx) are
  stripped on purpose; never put them on the page.
- `themes.json`, `keymap.json`, `palettes.json`: counts changed? Then copy and
  screenshots are probably stale (step 2 and 3).
- The sync prints roadmap items it believes already shipped. Skim that list:
  `docs/Roadmap.md` lags the changelog.

### 2. Copy that goes stale

`sync.mjs` never edits prose. After a release, re-check these claims in
`site/index.html` against the diff:

| Claim on the page | Source of truth |
| --- | --- |
| "14 MB", "~28 MB installed" | `PRODUCT.md` (re-measure before changing) |
| "Opens in under 5 s" vs GitKraken "~40 s" | The owner's own hand measurements; ask before changing, never invent a number |
| "Nine themes", accent and palette counts | `themes.json`, `palettes.json`, accent list in `store.ts` |
| Shortcut examples (`Ctrl+Shift+A`, `Ctrl+P` …) | `keymap.json` |
| AI features list and providers | changelog highlights; `PRODUCT.md` |
| `gitmo` wizards | latest changelog entry about the CLI |
| Platforms, install commands, unsigned note | `docs/Getting-Started.md`, `docs/Distribution.md` |
| "In development" labels (conflict suggestions, bisect, …) | drop the label only once it is in a release |

If the page says something the changelog doesn't support, fix the page.

### 3. Screenshots

Only when the UI visibly changed (new themes, redesigned panels, new features).

1. Run the demo UI **from the release tag**, not a dirty working tree, so
   unreleased UI doesn't sneak in:
   ```sh
   git -C ~/Projects/gitmoire worktree add /tmp/gitmoire-release "$(git -C ~/Projects/gitmoire describe --tags --abbrev=0)"
   (cd /tmp/gitmoire-release && pnpm install && pnpm dev --port 1420)
   ```
2. In this repo: `node scripts/capture-shots.mjs --src /tmp/gitmoire-release`
   (add `--only name1,name2` for a subset, `--install` to write
   `site/assets/shots/*.webp`; without `--install` PNGs land in a temp dir for review).
3. Look at the PNGs before installing. Demo mode only: the repo is synthetic and
   AI replies are canned (a mocked Ollama endpoint), which the page captions say.
4. `app-graph.webp` (the hero's first tab) is the one manual shot: open the
   throwaway demo repo with the installed app (`gitmoire open <demo-repo>`) and
   `grim -g "x,y WxH"` the window. **Never capture a real repo or the tab bar**:
   they carry private project names.
5. Tear down: `git -C ~/Projects/gitmoire worktree remove /tmp/gitmoire-release`.

If a capture fails, read its PNG first: the usual cause is a dialog that moved,
since the script clicks some controls by pixel position.

### 4. Verify

```sh
node scripts/check-site.mjs        # --offline to skip outbound link checks
```

It fails on console errors, 404 assets, sideways scroll at 390px, images without
alt text, unfinished loading states, ticket ids in the text, and dead outbound
links. Fix every FAIL. Treat a `warn` about data being behind as a to-do.

### 5. Hand back

Summarise what changed and what you left alone. Do not commit, push or deploy
unless asked. Deploy is Netlify: `site/` is the publish directory
(`netlify.toml`), no build step.

## Hard rules

- **Never publish** `content/source/` (gitignored), the private repo's code, or
  internal ids. Don't relax `.gitignore`.
- **Only link to things that exist.** The releases repo may have no published
  release: the page detects this at runtime and says so. Don't add `brew`,
  `gh release download` or `/releases/tag/` links you haven't verified with
  `gh api` or `curl -I`.
- **No invented facts.** Mock output and illustrative transcripts must be
  labelled as such on the page.
- Keep `sync.mjs` dependency-free (Node 20+). Playwright and ImageMagick
  (`magick`) are the only external tools, used by capture and check.

## Files

| Path | Role |
| --- | --- |
| `scripts/sync.mjs` | Mirror + derive data (releases, roadmap, project, keymap, themes, palettes, theme CSS) |
| `scripts/capture-shots.mjs` | Demo-mode screenshots with mocked AI, optional install to webp |
| `scripts/check-site.mjs` | Pre-publish checks |
| `site/data/*.json` | Published data (committed) |
| `content/source/` | Private mirror (gitignored) |
