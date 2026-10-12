#!/usr/bin/env node
// Capture the landing page's app screenshots from gitmoire's demo mode.
//
//   # in the source repo, in another terminal:  pnpm dev --port 1420
//   node scripts/capture-shots.mjs [--src ~/Projects/gitmoire] [--out DIR]
//                                  [--only a,b,c] [--install] [--port 1420]
//
// Demo mode is the real UI on a synthetic repository, so nothing private can
// leak. AI calls are answered by a mocked Ollama endpoint (canned replies), so
// AI screenshots show sample output; the page captions say so.
//
// Without --install the PNGs only land in --out for review. With --install
// they are cropped/resized into site/assets/shots/*.webp (needs ImageMagick).
//
// Not covered here: `app-graph` (the hero's first tab) is a capture of the
// installed desktop app on a demo repo. See .claude/skills/sync-gitmoire.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRC = resolve(arg('src', process.env.GITMOIRE_SRC || join(homedir(), 'Projects/gitmoire')));
const OUT = resolve(arg('out', join(tmpdir(), 'gitmoire-shots')));
const PORT = arg('port', '1420');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const INSTALL = process.argv.includes('--install');
const BASE = `http://localhost:${PORT}`;
const SHOTS_DIR = join(ROOT, 'site/assets/shots');

const pw = join(SRC, 'node_modules/@playwright/test/index.mjs');
if (!existsSync(pw)) {
  console.error(`capture: Playwright not found at ${pw}. Run pnpm install in ${SRC}.`);
  process.exit(1);
}
const { chromium } = await import(pathToFileURL(pw).href);
mkdirSync(OUT, { recursive: true });

try {
  const r = await fetch(BASE);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error(`capture: nothing on ${BASE}. Start the demo UI first: (cd ${SRC} && pnpm dev --port ${PORT})`);
  process.exit(1);
}

// ---------- mocked model: canned replies, real UI ----------
function reply(user) {
  if (/Split the uncommitted changes into atomic commits/.test(user)) {
    const files = [];
    let cur = null;
    for (const line of user.split('\n')) {
      const f = line.match(/^### (.+?) \((\w+)\)/);
      if (f) { cur = { path: f[1], ids: [] }; files.push(cur); continue; }
      const u = line.match(/^unit (\d+)/);
      if (u && cur) cur.ids.push(Number(u[1]));
    }
    const msgFor = (p) =>
      /test/.test(p) ? 'test(auth): cover the token refresh path'
        : /docs|\.md$/.test(p) ? 'docs(auth): document the session refresh flow'
          : 'feat(auth): refresh the session token before it expires';
    const byMsg = new Map();
    for (const f of files) {
      const m = msgFor(f.path);
      if (!byMsg.has(m)) byMsg.set(m, []);
      f.ids.forEach((id) => byMsg.get(m).push({ file: f.path, id }));
    }
    return JSON.stringify([...byMsg].map(([message, units]) => ({ message, units })));
  }
  if (/Resolve this merge conflict/.test(user)) {
    return 'const palette = useThemePalette();\nreturn render(rows, { palette, animate: true });\n---RATIONALE---\nMain already moved drawGraph to the theme palette, and feature/lane-colors only renamed the same call. Keeping the palette version drops legacyColors() and preserves the animate flag.';
  }
  if (/Review this staged diff/.test(user)) {
    return '1. **Medium** - `useVirtualizer` is created on every render in `CommitGraph`; memoize the options object so scroll position survives re-renders.\n2. **Low** - `OVERSCAN` is imported but the keyboard-nav path still indexes `rows.length - 1` without an empty-list guard.\n3. **Low** - no test covers the new `renderRow` signature.\n\nOtherwise this reads cleanly: the diff is focused and the naming is consistent.';
  }
  if (/conflict/i.test(user) && /explain/i.test(user)) {
    return "Both branches touch `drawGraph`. `main` switched the renderer to the shared theme palette (`useThemePalette`) and added `animate: true`. `feature/lane-colors` kept the old `legacyColors()` helper but renamed the option, so they collide on the same two lines. Taking `main`'s version keeps the palette and the animation.";
  }
  return 'feat(auth): refresh the session token before it expires';
}

// ---------- Omarchy: colors.toml -> the app's OmarchyTheme (mirrors core/omarchy.rs) ----------
const toml = (t) => Object.fromEntries([...t.matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
function omarchyTheme(name) {
  const c = toml(readFileSync(`/usr/share/omarchy/themes/${name}/colors.toml`, 'utf8'));
  const pick = (...k) => k.map((x) => c[x]).find(Boolean);
  const selection = pick('selection', 'lighter_background');
  return {
    available: true, id: name, displayName: name, mode: c.mode || 'dark', schema: 'colors',
    background: c.background, foreground: c.foreground, accent: pick('accent', 'blue'), selection,
    muted: pick('muted'), surface: pick('lighter_background', 'dark_background'), surfaceRaised: selection,
    surfaceOverlay: selection, border: pick('muted', 'selection'), borderSubtle: selection,
    mutedForeground: pick('dark_foreground', 'muted'), faintForeground: pick('muted', 'dark_foreground'),
    lightForeground: pick('light_foreground', 'foreground'), brightForeground: pick('bright_foreground', 'foreground'),
    cursor: pick('cursor', 'accent'), red: c.red, green: c.green, yellow: c.yellow, orange: pick('orange', 'brown'),
    blue: c.blue, magenta: c.magenta, cyan: c.cyan, brown: pick('brown', 'orange'), hash: name,
  };
}

// ---------- browser session ----------
const browser = await chromium.launch();

async function session({ theme = 'dark-magic', state = {}, repo = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await ctx.route('http://localhost:11434/**', async (route) => {
    let user = '';
    try { user = JSON.parse(route.request().postData() || '{}').messages.map((m) => m.content).join('\n'); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ model: 'llama3.1', message: { role: 'assistant', content: reply(user) }, done: true }),
    });
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([t, s]) => localStorage.setItem('gitmoire-settings', JSON.stringify({ state: { theme: t, ...s }, version: 0 })),
    [theme, state],
  );
  await page.goto(BASE);
  await page.waitForTimeout(2500);
  if (!repo) return page;
  // the first dev-server load can reload mid-click, so retry until the toolbar shows
  for (let i = 0; i < 4; i++) {
    await page.getByText('~/projects/gitmoire').nth(1).click();
    try { await page.getByRole('button', { name: /^Fetch/ }).waitFor({ timeout: 6000 }); break; }
    catch { await page.goto(BASE); await page.waitForTimeout(2500); }
  }
  await page.waitForTimeout(4200); // let the "hash copied" toast clear
  return page;
}

// click by CSS pixel: the resolver's header controls have no stable labels
const at = (p, x, y) => p.mouse.click(x, y);
const resolveAll = async (p) => {
  await p.getByText('Resolve', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) { await at(p, 20, 75); await p.waitForTimeout(500); await at(p, 1325, 27); await p.waitForTimeout(1200); }
  await at(p, 1408, 27);
  await p.waitForTimeout(1000);
};
const PREFIX = {
  commitPrefixes: [
    { id: 'type', name: 'type', values: ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'chore'] },
    { id: 'scope', name: 'scope', values: ['graph', 'diff', 'auth', 'core', 'ui', 'cli'] },
  ],
  commitPrefixTemplate: '<type>(<scope>):',
};
const THEMES = ['dark-magic', 'dark-magic-light', 'dark-magic-night', 'dark-magic-nord', 'dark-magic-dracula',
  'dark-magic-frankenstein', 'dark-magic-tokyo', 'dark-magic-midnight', 'dark-magic-oled',
  'dark-magic-grimoire', 'dark-magic-moonmilk', 'dark-magic-kraken', 'dark-magic-phosphor',
  'dark-magic-magenta', 'dark-magic-synthwave'];

// install: [file, width | crop]. `crop` is WxH+X+Y on the 2160x1350 capture.
const SHOTS = [];
const add = (name, opts, run, install) => SHOTS.push({ name, opts, run, install });

for (const t of THEMES) add(`theme-${t}`, { theme: t }, async () => {}, [[`theme-${t}`, { width: 1800 }]]);
add('workspace', {}, async () => {}, [['workspace', { width: 2000 }]]);
add('light-aliases', { theme: 'dark-magic-light' }, async () => {}, [['app-graph-light', { width: 2000 }], ['workspace-light', { width: 2000 }]]);
add('palette', {}, async (p) => { await p.keyboard.press('Control+p'); await p.waitForTimeout(900); }, [['palette', { width: 2000 }]]);
add('palette-light', { theme: 'dark-magic-light' }, async (p) => { await p.keyboard.press('Control+p'); await p.waitForTimeout(900); }, [['palette-light', { width: 2000 }]]);
add('conflicts', {}, async (p) => { await p.getByText('Resolve', { exact: true }).first().click(); await p.waitForTimeout(1800); }, [['conflicts', { width: 2000 }]]);
add('conflicts-light', { theme: 'dark-magic-light' }, async (p) => { await p.getByText('Resolve', { exact: true }).first().click(); await p.waitForTimeout(1800); }, [['conflicts-light', { width: 2000 }]]);
add('diff', {}, async (p) => { await p.getByText('ipc.ts').first().click(); await p.waitForTimeout(1800); }, [['diff', { width: 2000 }]]);
add('diff-light', { theme: 'dark-magic-light' }, async (p) => { await p.getByText('ipc.ts').first().click(); await p.waitForTimeout(1800); }, [['diff-light', { width: 2000 }]]);
add('home', { repo: false }, async () => {}, [['home', { width: 2000 }]]);
add('home-light', { theme: 'dark-magic-light', repo: false }, async () => {}, [['home-light', { width: 2000 }]]);
add('terminal', {}, async (p) => { await p.keyboard.press('Control+`'); await p.waitForTimeout(2000); }, [['terminal', { width: 2000 }]]);
add('review', {}, async (p) => { await p.getByRole('button', { name: /^Review/ }).click(); await p.waitForTimeout(3500); }, [['review', { crop: '760x760+1400+520' }]]);
add('commit-message', {}, async (p) => { await at(p, 1407, 700); await p.waitForTimeout(3500); }, [['commit-message', { crop: '760x760+1400+520' }]]);
add('conflict-suggest', {}, async (p) => {
  await p.getByText('Resolve', { exact: true }).first().click(); await p.waitForTimeout(1500);
  await at(p, 1398, 168); await p.waitForTimeout(3500);
}, [['conflict-suggest', { width: 2000 }]]);
add('atomic', {}, async (p) => {
  await resolveAll(p);
  await p.getByRole('button', { name: /Atomic commits/ }).click({ timeout: 5000 });
  await p.waitForTimeout(4500);
}, [['atomic', { crop: '1160x800+500+280' }]]);
add('prefix-open', { state: PREFIX }, async (p) => {
  await at(p, 1200, 700); await p.waitForTimeout(800);
  await at(p, 1077, 664); await p.waitForTimeout(1000);
}, [['prefix-open', { crop: '760x600+1400+500' }]]);
add('prefix-filter', { state: PREFIX }, async (p) => {
  await at(p, 1200, 700); await p.waitForTimeout(800);
  await at(p, 1077, 664); await p.waitForTimeout(1000);
  await p.keyboard.type('fe'); await p.waitForTimeout(700);
}, [['prefix-filter', { crop: '760x600+1400+500' }]]);
add('worktrees', {}, async (p) => { await p.keyboard.press('Control+Shift+W'); await p.waitForTimeout(1500); }, [['worktrees', { crop: '900x720+630+290' }]]);
add('keymap', { repo: false }, async (p) => { await p.keyboard.press('Control+k'); await p.waitForTimeout(1200); }, [['keymap', { width: 1800 }]]);
add('theme-switcher', {}, async (p) => { await p.keyboard.press('Control+Shift+T'); await p.waitForTimeout(1200); }, [['theme-switcher', { crop: '900x600+630+90' }]]);
add('settings-ai', {}, async (p) => {
  await p.keyboard.press('Control+,'); await p.waitForTimeout(1200);
  await p.getByText('AI Assistant', { exact: true }).first().click(); await p.waitForTimeout(1200);
}, [['settings-ai', { crop: '1160x800+500+160' }]]);
add('settings-themes', {}, async (p) => { await p.keyboard.press('Control+,'); await p.waitForTimeout(1500); }, [['settings-themes', { crop: '1160x800+500+160' }]]);
for (const name of ['tokyo-night', 'osaka-jade', 'rose-pine', 'catppuccin-latte']) {
  add(`omarchy-${name}`, {}, async (p) => {
    const t = omarchyTheme(name);
    await p.evaluate(async (theme) => {
      const m = await import('/src/features/settings/omarchy.ts');
      const el = document.documentElement;
      for (const c of [...el.classList]) if (c.startsWith('theme-')) el.classList.remove(c);
      el.classList.add('theme-omarchy');
      el.classList.toggle('dark', theme.mode === 'dark');
      el.classList.toggle('light', theme.mode === 'light');
      m.applyOmarchyTheme(theme);
    }, t);
    await p.waitForTimeout(900);
  }, [[`omarchy-${name}`, { width: 1800 }]]);
}

for (const id of ['gitmoire', 'dark-magic', 'neon', 'pastel', 'mono']) {
  add(`lanes-${id}`, { state: { graphPreset: id } }, async () => {}, [[`lanes-${id}`, { crop: '1180x900+385+190' }]]);
}

// ---------- run ----------
function install(png, file, spec) {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const args = [png];
  if (spec.crop) args.push('-crop', spec.crop, '+repage');
  else if (spec.width) args.push('-resize', `${spec.width}x`);
  args.push('-quality', '80', '-define', 'webp:method=6', join(SHOTS_DIR, `${file}.webp`));
  execFileSync('magick', args);
}

const todo = SHOTS.filter((s) => !ONLY.length || ONLY.includes(s.name));
const failed = [];
for (const s of todo) {
  let page;
  try {
    page = await session(s.opts);
    await s.run(page);
    const png = join(OUT, `${s.name}.png`);
    await page.screenshot({ path: png });
    if (INSTALL) for (const [file, spec] of s.install) install(png, file, spec);
    console.log('ok  ', s.name);
  } catch (e) {
    failed.push(s.name);
    console.log('FAIL', s.name, String(e).split('\n')[0]);
  } finally {
    try { await page.context().close(); } catch { /* already closed */ }
  }
}
await browser.close();
console.log(`\n${todo.length - failed.length}/${todo.length} captured into ${OUT}${INSTALL ? ' and installed' : ''}`);
if (failed.length) { console.log('failed:', failed.join(', ')); process.exit(1); }
