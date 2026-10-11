#!/usr/bin/env node
// Sync the landing page's data from the private gitmoire source tree.
//
//   node scripts/sync.mjs [--src ~/Projects/gitmoire] [--worktree]
//
// 1. Mirrors a fixed list of files into content/source/ (gitignored: the source
//    repo is private and those docs carry internal notes), read from git refs so
//    unreleased working-tree changes stay out. See --worktree below.
// 2. Derives public-safe JSON into site/data/ (committed: Netlify serves it).
//
// No dependencies. Node 20+.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argSrc = process.argv.indexOf('--src');
const SRC = resolve(
  (argSrc > -1 && process.argv[argSrc + 1]) || process.env.GITMOIRE_SRC || join(homedir(), 'Projects/gitmoire'),
);
const MIRROR = join(ROOT, 'content/source');
const DATA = join(ROOT, 'site/data');

const MIRRORED = [
  'README.md',
  'PRODUCT.md',
  'CHANGELOG.md',
  'TASKS.md',
  'DECISIONS.md',
  'RELEASING.md',
  'package.json',
  'LICENSE',
  'docs/Roadmap.md',
  'docs/Getting-Started.md',
  'docs/Distribution.md',
  'docs/Architecture.md',
  'src-tauri/tauri.conf.json',
  'src/shared/keymap.ts',
  'src/features/settings/store.ts',
  'packages/design-system/src/themes.css',
  'src/features/settings/graphColors.ts',
];

if (!existsSync(SRC)) {
  console.error(`sync: source tree not found at ${SRC} (pass --src or set GITMOIRE_SRC)`);
  process.exit(1);
}

// ---------- 1. mirror ----------
// Product facts (themes, shortcuts, palettes, changelog) are read at the latest
// release tag, so unreleased work in the working tree never leaks onto the
// page. Planning docs (roadmap, ledger) are read at HEAD: committed, not WIP.
// Pass --worktree to read the working tree instead (previewing a release).
const WORKTREE = process.argv.includes('--worktree');
const git = (args) => execFileSync('git', ['-C', SRC, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let TAG = null;
try { TAG = git(['describe', '--tags', '--abbrev=0']).trim(); } catch { /* not a git checkout */ }
const TAGGED = new Set([
  'CHANGELOG.md', 'package.json', 'README.md', 'LICENSE', 'src-tauri/tauri.conf.json',
  'docs/Getting-Started.md', 'docs/Distribution.md', 'docs/Architecture.md',
  'src/shared/keymap.ts', 'src/features/settings/store.ts', 'src/features/settings/graphColors.ts',
  'packages/design-system/src/themes.css',
]);
function readSource(rel) {
  const ref = WORKTREE ? null : TAGGED.has(rel) ? TAG : 'HEAD';
  if (ref) {
    try { return { text: git(['show', `${ref}:${rel}`]), ref }; } catch { /* fall through to the working tree */ }
  }
  const from = join(SRC, rel);
  return existsSync(from) ? { text: readFileSync(from, 'utf8'), ref: 'worktree' } : null;
}
const refsUsed = new Set();
for (const rel of MIRRORED) {
  const got = readSource(rel);
  if (!got) { console.warn(`sync: skip ${rel} (missing)`); continue; }
  refsUsed.add(got.ref);
  const to = join(MIRROR, rel);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, got.text);
}
console.log(`sync: read ${[...refsUsed].join(' + ')}${TAG && !WORKTREE ? ` (latest tag ${TAG})` : ''}`);
const read = (rel) => readFileSync(join(MIRROR, rel), 'utf8');
mkdirSync(DATA, { recursive: true });

// ---------- helpers ----------
const plain = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const firstSentence = (s, max = 170) => {
  const t = plain(s);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const out = m ? m[1] : t;
  return out.length > max ? out.slice(0, max - 1).trimEnd() + '…' : out;
};

const semver = (v) => v.split('.').map(Number);
const gt = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

// ---------- 2a. releases ----------
function parseReleases(md) {
  const parts = md.split(/^## \[/m).slice(1);
  const out = [];
  let prev = null;
  for (const part of parts) {
    const head = part.match(/^([^\]]+)\]\s*(?:—|-)?\s*(\d{4}-\d{2}-\d{2})?/);
    if (!head) continue;
    const [, version, date] = head;
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue; // skips [Unreleased]
    // Numbering restarts where the fork began: everything after is angkorGit history.
    if (prev && gt(version, prev)) break;
    prev = version;

    const body = part.slice(part.indexOf('\n') + 1);
    const intro = body.split(/^### /m)[0].trim();
    const highlights = [];
    const sectionRe = /^### (.+)$/gm;
    const sections = body.split(/^### /m).slice(1);
    for (const sec of sections) {
      const name = plain(sec.split('\n')[0]).replace(/^[^\p{L}]+/u, '');
      if (/internal|maintenance/i.test(name)) continue;
      const bullets = sec.split(/^- \*\*/m).slice(1);
      for (const b of bullets) {
        const m = b.match(/^([^*]+?)\*\*\s*([\s\S]*)/);
        if (!m) continue;
        const title = m[1].replace(/\.$/, '').trim();
        const text = m[2].split(/\n\s*\n|\n- /)[0];
        highlights.push({ kind: name, title, text: firstSentence(text) });
      }
    }
    out.push({
      version,
      date: date || null,
      summary: intro ? plain(intro).slice(0, 420) : '',
      highlights: highlights.slice(0, 7),
      counts: {
        features: highlights.filter((h) => /major|feature/i.test(h.kind)).length,
        enhancements: highlights.filter((h) => /enhanc/i.test(h.kind)).length,
        fixes: highlights.filter((h) => /fix|bug/i.test(h.kind)).length,
      },
    });
  }
  return out;
}

const pkg = JSON.parse(read('package.json'));
const releases = parseReleases(read('CHANGELOG.md'));

// ---------- 2b. roadmap ----------
function parseRoadmap(md) {
  const groups = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^## (.+)/);
    if (h) {
      cur = { title: h[1].replace(/^Later — /, '').replace(/\s*\(.*\)$/, '').trim(), items: [] };
      groups.push(cur);
      continue;
    }
    const item = line.match(/^- \[( |x)\] (.+)/);
    if (item && cur) cur.items.push({ done: item[1] === 'x', text: plain(item[2]) });
  }
  const nonGoals = (md.match(/^Non-goals:\s*(.+)$/m) || [])[1] || '';
  return { groups: groups.filter((g) => g.items.length), nonGoals: plain(nonGoals) };
}

function parsePotions(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*\[`(DMS-\d+)`\]\([^)]*\)\s*\|\s*(.+?)\s*\|\s*`(\w+)`\s*\|\s*(\d+)%/);
    if (m) rows.push({ id: m[1], feature: plain(m[2]), status: m[3], progress: Number(m[4]) });
  }
  return rows;
}

// Potions that are harness plumbing, not product work.
const INTERNAL_POTIONS = new Set(['DMS-001']);

const stems = (s) =>
  new Set(
    plain(s)
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 4)
      .map((w) => w.slice(0, 5)),
  );

// docs/Roadmap.md lags the ledger: items under Next / Connected often shipped
// already. Flag any item whose words overlap a completed potion, and review the
// printed list after every sync.
function markShipped(groups, potions, releases) {
  const done = potions.filter((p) => p.status === 'completed').map((p) => stems(p.feature));
  for (const r of releases) for (const h of r.highlights) done.push(stems(`${h.title} ${h.text}`));
  const flagged = [];
  for (const g of groups) {
    if (/^power$/i.test(g.title)) continue;
    for (const it of g.items) {
      const words = [...stems(it.text)];
      const need = words.length <= 2 ? 1 : 2;
      it.shipped = done.some((d) => words.filter((w) => d.has(w)).length >= need);
      if (it.shipped) flagged.push(it.text);
    }
  }
  return flagged;
}

const potions = parsePotions(read('TASKS.md')).filter((p) => !INTERNAL_POTIONS.has(p.id));
// Ledger ids (DMS-xxx) are internal bookkeeping: they stay out of the published JSON.
const roadmap = {
  ...parseRoadmap(read('docs/Roadmap.md')),
  potions: potions.map(({ id, ...rest }) => rest),
};
const flaggedShipped = markShipped(roadmap.groups, potions, releases);

// ---------- 2c. project ----------
function gitCount(args) {
  try {
    return execFileSync('git', ['-C', SRC, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
const latest = releases[0] || null;
const project = {
  name: 'gitmoire',
  version: pkg.version,
  latestRelease: latest && { version: latest.version, date: latest.date },
  tagline: 'Git, with a little dark magic.',
  license: 'MIT',
  releasesRepo: 'https://github.com/dark-magic-studios/gitmoire-releases',
  commits: gitCount(['rev-list', '--count', 'HEAD']) ? Number(gitCount(['rev-list', '--count', 'HEAD'])) : null,
  releaseCount: releases.length,
  syncedAt: new Date().toISOString(),
};

writeFileSync(join(DATA, 'releases.json'), JSON.stringify(releases, null, 2) + '\n');
writeFileSync(join(DATA, 'roadmap.json'), JSON.stringify(roadmap, null, 2) + '\n');
writeFileSync(join(DATA, 'project.json'), JSON.stringify(project, null, 2) + '\n');


// ---------- 2d. keymap, themes (the app's own registries) ----------
// Scan a bracketed list of quoted strings starting at `from`, honouring quotes
// so keys like 'mod+shift+]' don't end the list early.
function quotedList(src, from) {
  const open = src.indexOf('[', from);
  const out = [];
  let q = false, cur = '';
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'") {
      if (q) { out.push(cur); cur = ''; }
      q = !q;
    } else if (q) cur += ch;
    else if (ch === ']') break;
  }
  return out;
}

function parseKeymap(ts) {
  const body = ts.slice(ts.indexOf('export const KEYMAP = ['), ts.indexOf('] as const satisfies'));
  const out = [];
  for (const seg of body.split(/\bid:\s*'/).slice(1)) {
    const id = seg.slice(0, seg.indexOf("'"));
    const field = (name) => (seg.match(new RegExp(`${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`)) || [])[1];
    const kIdx = seg.indexOf('keys:');
    const dIdx = seg.indexOf('display:');
    const label = field('label');
    const group = field('group');
    if (!label || !group) continue;
    out.push({
      id,
      label: label.replace(/\\'/g, "'"),
      group,
      scope: field('scope'),
      keys: kIdx > -1 && !/keys:\s*Array/.test(seg) ? quotedList(seg, kIdx) : [],
      display: dIdx > -1 ? quotedList(seg, dIdx) : null,
      reference: /reference:\s*true/.test(seg),
    });
  }
  return out;
}

function parseThemes(ts) {
  const themes = [];
  const re = /\{ id: '([^']+)', label: '([^']+)', base: '(dark|light)', swatch: \{ bg: '(#\w+)', fg: '(#\w+)', dots: \['(#\w+)', '(#\w+)', '(#\w+)'\] \} \}/g;
  for (const m of ts.matchAll(re)) {
    themes.push({ id: m[1], label: m[2], base: m[3], bg: m[4], fg: m[5], dots: [m[6], m[7], m[8]] });
  }
  return themes;
}

// themes.css -> site/assets/themes.css, remapped to the page's own tokens.
function pageThemes(css, themes) {
  const map = {
    '--background': '--bg', '--surface': '--surface', '--surface-raised': '--raised',
    '--border': '--border', '--foreground': '--fg', '--muted-foreground': '--muted',
    '--faint-foreground': '--faint',
  };
  const base = Object.fromEntries(themes.map((t) => [t.id, t.base]));
  let out = '/* generated by scripts/sync.mjs from the app\'s themes.css, do not edit */\n';
  for (const m of css.matchAll(/\.theme-([a-z0-9-]+)\s*\{([^}]*)\}/g)) {
    const [, id, block] = m;
    const lines = [];
    for (const d of block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
      if (map[d[1]]) lines.push(`  ${map[d[1]]}: ${d[2].trim()};`);
    }
    if (!lines.length) continue;
    out += `[data-theme="${id}"] {\n${lines.join('\n')}\n}\n`;
  }
  return { css: out, base };
}

const keymap = parseKeymap(read('src/shared/keymap.ts'));
const themes = parseThemes(read('src/features/settings/store.ts'));
const { css: themeCss } = pageThemes(read('packages/design-system/src/themes.css'), themes);
writeFileSync(join(DATA, 'keymap.json'), JSON.stringify(keymap, null, 2) + '\n');
writeFileSync(join(DATA, 'themes.json'), JSON.stringify(themes, null, 2) + '\n');
writeFileSync(join(ROOT, 'site/assets/themes.css'), themeCss);

function parsePalettes(ts) {
  const out = [];
  const re = /id: '([^']+)',\s*label: '([^']+)',\s*description: '([^']+)',\s*dark: \[([^\]]+)\],\s*light: \[([^\]]+)\]/g;
  const hexes = (s) => [...s.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0]);
  for (const m of ts.matchAll(re)) out.push({ id: m[1], label: m[2], description: m[3], dark: hexes(m[4]), light: hexes(m[5]) });
  return out;
}
const palettes = parsePalettes(read('src/features/settings/graphColors.ts'));
writeFileSync(join(DATA, 'palettes.json'), JSON.stringify(palettes, null, 2) + '\n');

if (flaggedShipped.length) {
  console.log('sync: roadmap items flagged as already shipped (review):');
  for (const t of flaggedShipped) console.log(`  - ${t}`);
}
console.log(
  `sync: ${releases.length} releases (latest ${project.version}), ` +
    `${roadmap.potions.length} potions, ${roadmap.groups.length} roadmap groups, ` +
    `${keymap.length} shortcuts, ${themes.length} themes, ${palettes.length} lane palettes -> site/data/`,
);
