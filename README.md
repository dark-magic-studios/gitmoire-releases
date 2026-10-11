# gitmoire-releases

Public downloads and auto-update feed for gitmoire, plus its landing page.
Source of the app is private.

## Landing page

Static site in `site/`, deployed to Netlify with no build step (`netlify.toml`).

```sh
python3 -m http.server -d site 4173     # preview at http://localhost:4173
```

Deploy: connect this repo in Netlify (publish directory `site`, no build
command), or `npx netlify deploy --dir site --prod`.

### Content sync

Releases, roadmap and project facts come from the private gitmoire repo:

```sh
node scripts/sync.mjs        # or: GITMOIRE_SRC=/path/to/gitmoire node scripts/sync.mjs
```

- Mirrors docs into `content/source/` (**gitignored**: internal notes).
- Writes `site/data/{releases,roadmap,project}.json` (committed).
- Claude Code skill: `.claude/skills/sync-gitmoire`.

### Design

Follows the app's TTY design system (`packages/design-system/SPEC.md` in the
source repo): JetBrains Mono, box-drawing structure, double border on the
focused pane, a key bar, no radii or shadows. Screenshots in
`site/assets/shots/` are of the app running on a demo repository.
