#!/usr/bin/env node
// Builds the Tauri updater manifest (latest.json) from the collected build
// output and refuses anything that is not a final distributable.
//
//   node scripts/make-latest-json.mjs <dist-dir> <version> <tag> <owner/repo> [notes-file]
import fs from 'node:fs';
import path from 'node:path';

const [dir, version, tag, repo, notesFile] = process.argv.slice(2);
if (!dir || !version || !tag || !repo) {
  console.error('usage: make-latest-json.mjs <dist-dir> <version> <tag> <owner/repo> [notes-file]');
  process.exit(1);
}

const ALLOWED = /\.(dmg|app\.tar\.gz|AppImage|deb|rpm|msi|sig)$|-setup\.exe$|^latest\.json$/;
const files = fs.readdirSync(dir);
const stray = files.filter((f) => !ALLOWED.test(f));
if (stray.length > 0) {
  console.error(`::error::refusing to publish ${stray.length} unexpected file(s) (not a distributable)`);
  process.exit(1);
}

const pick = (re, label) => {
  const matches = files.filter((f) => re.test(f));
  if (matches.length !== 1) {
    console.error(`::error::expected exactly one ${label}, found ${matches.length}`);
    process.exit(1);
  }
  const name = matches[0];
  const sigFile = path.join(dir, `${name}.sig`);
  if (!fs.existsSync(sigFile)) {
    console.error(`::error::missing updater signature for the ${label}`);
    process.exit(1);
  }
  return {
    signature: fs.readFileSync(sigFile, 'utf8').trim(),
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`,
  };
};

const mac = pick(/\.app\.tar\.gz$/, 'macOS updater bundle');
const linux = pick(/\.AppImage$/, 'Linux AppImage');
const windows = pick(/-setup\.exe$/, 'Windows installer');

const manifest = {
  version,
  notes: notesFile && fs.existsSync(notesFile) ? fs.readFileSync(notesFile, 'utf8').trim() : '',
  pub_date: new Date().toISOString(),
  platforms: {
    'darwin-aarch64': mac,
    'darwin-x86_64': mac,
    'linux-x86_64': linux,
    'windows-x86_64': windows,
  },
};

fs.writeFileSync(path.join(dir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote latest.json for ${tag}.`);
