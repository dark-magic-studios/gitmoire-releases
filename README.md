# gitmoire-releases

Public downloads and auto-update feed for gitmoire, plus its landing page.
Source of the app is private.

## Releasing

The installers are built here, on free GitHub-hosted runners, from the private
`dark-magic-studios/gitmoire` source. The source repo has no workflows of its
own. Workflow: `.github/workflows/build-release.yml`.

```sh
pnpm run deploy                    # build the source's default branch (master); version read from it
pnpm run deploy master 0.9.2       # explicit ref + version
pnpm run deploy v0.9.2             # build the v0.9.2 tag of the source repo
```

Use `pnpm run deploy`: bare `pnpm deploy` is a built-in pnpm command and never
reaches the script. The script only dispatches the workflow through `gh` (it
needs `gh auth login`); nothing is built locally. Equivalent by hand:
`gh workflow run build-release.yml -f ref=master -f version=0.9.2`.

The run builds macOS (universal), Windows and Linux in parallel, then a final job
creates a **draft** release `vX.Y.Z` holding the installers, their updater
signatures and `latest.json`. The updater feed only goes live once you publish:

```sh
gh release edit vX.Y.Z --draft=false
```

Pushing a `v*` tag to this repo also triggers a build of the same-named tag in
the source repo.

### Secrets

Set under *Settings → Secrets and variables → Actions* of this repo.

| Secret | Required | Purpose |
| --- | --- | --- |
| `GITMOIRE_DEPLOY_KEY` | one of these two | Private half of a read-only SSH deploy key on the source repo (preferred) |
| `GITMOIRE_READ_TOKEN` | one of these two | Fallback: fine-grained PAT, *Contents: read* on the source repo only |
| `TAURI_SIGNING_PRIVATE_KEY` | yes | Signs updater artifacts. Contents of `~/.tauri/gitmoire.key`; the key has an empty password |
| `APPLE_CERTIFICATE` | no | Base64 Developer ID `.p12`, single line: `base64 -i cert.p12 \| tr -d '\n'` |
| `APPLE_CERTIFICATE_PASSWORD` | with the above | Password of the `.p12` |
| `APPLE_SIGNING_IDENTITY` | with the above | e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | no | Notarization (app-specific password). Needs the three signing secrets too |

Without the `APPLE_*` secrets the macOS build keeps its ad-hoc signature and is
not notarized; the steps skip cleanly.

**Deploy key** (preferred; scoped to one repo, read-only by construction):

```sh
ssh-keygen -t ed25519 -N '' -C gitmoire-releases-ci -f gitmoire_deploy_key
gh repo deploy-key add gitmoire_deploy_key.pub --repo dark-magic-studios/gitmoire --title gitmoire-releases-ci
gh secret set GITMOIRE_DEPLOY_KEY --repo dark-magic-studios/gitmoire-releases < gitmoire_deploy_key
shred -u gitmoire_deploy_key gitmoire_deploy_key.pub
```

Do not pass `--allow-write`. **Fallback PAT**: create a fine-grained token with
*Only select repositories → gitmoire* and *Contents: Read-only*, then
`gh secret set GITMOIRE_READ_TOKEN --repo dark-magic-studios/gitmoire-releases`.

### Security rules (this repo is public)

- Logs and artifacts are world-readable and the source is private. Build output
  is captured by `scripts/ci-quiet.sh`; on failure the log only says it failed.
  `verbose_logs=true` on a dispatch streams it: use only when you accept that.
- Never echo secrets or environment, never `ls -R` / `tree` / print source
  paths, never upload source, `node_modules`, sourcemaps or build intermediates.
- Triggers stay `workflow_dispatch` and tag push. Never `pull_request`,
  `pull_request_target`, `issue_comment` or anything else forks can reach.
- Only the final `release` job has `contents: write`; jobs that run private
  build scripts get a read-only token.
- Third-party actions are pinned to full commit SHAs. Update by resolving the
  new tag's SHA, never by switching to a tag or branch.
- Release builds ship no sourcemaps (`build.sourcemap: false` in the source,
  asserted again by the workflow); artifacts are limited to an extension
  allow-list.
- Caches hold only the pnpm package store, keyed on the lockfile.

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
