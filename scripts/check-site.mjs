#!/usr/bin/env node
// Sanity-check the built landing page before it ships.
//
//   node scripts/check-site.mjs [--src ~/Projects/gitmoire] [--offline]
//
// Serves site/ itself, loads it in a headless browser at desktop and phone
// width, and fails on anything that would embarrass us in public.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SRC = resolve(arg('src', process.env.GITMOIRE_SRC || join(homedir(), 'Projects/gitmoire')));
const OFFLINE = process.argv.includes('--offline');

const problems = [];
const warn = [];
const fail = (m) => problems.push(m);

const pw = join(SRC, 'node_modules/@playwright/test/index.mjs');
if (!existsSync(pw)) { console.error(`check: Playwright not found at ${pw}`); process.exit(1); }
const { chromium } = await import(pathToFileURL(pw).href);

// ---- static server for site/ ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(SITE, p);
  if (!file.startsWith(SITE) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const links = new Set();

for (const [label, width, height] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.on('pageerror', (e) => fail(`${label}: uncaught error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/api\.github\.com/.test(m.text()) && fail(`${label}: console error: ${m.text()}`));
  page.on('response', (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400) fail(`${label}: ${r.status()} ${r.url().replace(BASE, '')}`);
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) fail(`${label}: page scrolls sideways by ${overflow}px`);

  if (label === 'desktop') {
    const text = await page.evaluate(() => document.body.innerText);
    if (/DMS-\d+/.test(text)) fail('internal DMS ticket id visible in page text');
    if (/undefined|NaN|\[object/.test(text)) fail('"undefined", "NaN" or "[object" rendered in page text');
    const noAlt = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src));
    noAlt.forEach((s) => fail(`image without alt: ${s.replace(BASE, '')}`));
    const empties = await page.evaluate(() => ['release-list', 'roadmap-body', 'key-table', 'theme-picks'].filter((id) => /Brewing the roadmap|Reading the changelog|Loading the key map|changelog went quiet|roadmap wandered off|key map didn|theme list went|palette list went/.test(document.getElementById(id)?.innerText || '')));
    empties.forEach((id) => fail(`#${id} did not finish rendering`));
    (await page.evaluate(() => [...document.querySelectorAll('a[href^="http"]')].map((a) => a.href))).forEach((h) => links.add(h));
    // download links may only point at things that exist
    const tagLinks = await page.evaluate(() => [...document.querySelectorAll('a[href*="/releases/tag/"]')].map((a) => a.href));
    tagLinks.forEach((h) => links.add(h));
  }
}
await browser.close();
server.close();

// ---- outbound links ----
if (!OFFLINE) {
  for (const url of links) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10_000) });
      if (r.status >= 400) fail(`dead link (${r.status}): ${url}`);
    } catch (e) {
      warn.push(`could not reach ${url} (${e.name})`);
    }
  }
}

// ---- data freshness ----
const projectJson = join(SITE, 'data/project.json');
const srcPkg = join(SRC, 'package.json');
if (existsSync(projectJson) && existsSync(srcPkg)) {
  const site = JSON.parse(readFileSync(projectJson, 'utf8')).version;
  const src = JSON.parse(readFileSync(srcPkg, 'utf8')).version;
  if (site !== src) warn.push(`site data is for v${site} but the source is v${src}: run scripts/sync.mjs`);
}

console.log(`checked ${links.size} outbound links, desktop and phone widths`);
warn.forEach((w) => console.log('warn ', w));
if (problems.length) {
  problems.forEach((p) => console.log('FAIL ', p));
  process.exit(1);
}
console.log('ok   site is clean');
