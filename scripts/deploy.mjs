#!/usr/bin/env node
// Triggers the build-release workflow on GitHub. Does not build anything locally.
//
//   pnpm run deploy                     # ref=default branch of the source repo, version read from it
//   pnpm run deploy v0.9.2              # ref=v0.9.2, version=0.9.2
//   pnpm run deploy master 0.9.2
//   pnpm run deploy --ref my-branch --version 0.9.2
//
// (`pnpm deploy` without `run` is a built-in pnpm command and never reaches this script.)
import { execFileSync, spawnSync } from 'node:child_process';

const RELEASES_REPO = 'dark-magic-studios/gitmoire-releases';
const SOURCE_REPO = 'dark-magic-studios/gitmoire';
const WORKFLOW = 'build-release.yml';

function fail(message) {
  console.error(`deploy: ${message}`);
  process.exit(1);
}

function gh(args, opts = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

// --- args -------------------------------------------------------------------
let ref;
let version;
const positional = [];
const argv = process.argv.slice(2).filter((a) => a !== '--');
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--ref' || a === '-r') ref = argv[++i];
  else if (a === '--version' || a === '-v') version = argv[++i];
  else if (a.startsWith('--ref=')) ref = a.slice(6);
  else if (a.startsWith('--version=')) version = a.slice(10);
  else if (a === '--help' || a === '-h') {
    console.log('usage: pnpm run deploy [ref] [version]   (or --ref / --version)');
    process.exit(0);
  } else if (a.startsWith('-')) fail(`unknown option ${a}`);
  else positional.push(a);
}
ref ??= positional[0];
version ??= positional[1];

if (ref && !/^[A-Za-z0-9._/-]+$/.test(ref)) fail(`invalid ref "${ref}"`);


// --- gh ---------------------------------------------------------------------
try {
  gh(['--version']);
} catch {
  fail('GitHub CLI (gh) is not installed. See https://cli.github.com');
}
try {
  gh(['auth', 'status']);
} catch {
  fail('gh is not authenticated. Run `gh auth login` (or set GH_TOKEN) and try again.');
}

// --- ref / version ----------------------------------------------------------
if (!ref) {
  try {
    ref = gh(['api', `repos/${SOURCE_REPO}`, '--jq', '.default_branch']).trim();
  } catch {
    fail(`could not read the default branch of ${SOURCE_REPO}. Pass a ref explicitly.`);
  }
}
// A bare tag like v0.9.2 implies its own version.
if (!version && /^v\d+\.\d+\.\d+/.test(ref)) version = ref;

if (!version) {
  try {
    const raw = gh([
      'api',
      `repos/${SOURCE_REPO}/contents/package.json?ref=${encodeURIComponent(ref)}`,
      '-H',
      'Accept: application/vnd.github.raw',
    ]);
    version = JSON.parse(raw).version;
  } catch {
    fail(`could not read the version from ${SOURCE_REPO}@${ref}. Pass it explicitly: pnpm run deploy ${ref} <version>`);
  }
}
version = String(version).replace(/^v/, '');
if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version)) fail(`invalid version "${version}"`);

// --- dispatch ---------------------------------------------------------------
console.log(`Dispatching ${WORKFLOW} on ${RELEASES_REPO}: ref=${ref} version=${version}`);
const result = spawnSync(
  'gh',
  ['workflow', 'run', WORKFLOW, '--repo', RELEASES_REPO, '-f', `ref=${ref}`, '-f', `version=${version}`],
  { stdio: 'inherit' },
);
if (result.status !== 0) {
  fail(`could not dispatch the workflow. It must exist on the default branch of ${RELEASES_REPO}; has it been pushed?`);
}

console.log(`\nWatch:  gh run watch --repo ${RELEASES_REPO}`);
console.log(`        https://github.com/${RELEASES_REPO}/actions/workflows/${WORKFLOW}`);
console.log(`Then publish the draft: gh release edit v${version} --draft=false --repo ${RELEASES_REPO}`);
