/* gitmoire.dev, the grimoire build.
   One small scroll engine (progress per act), the git-graph rail, the hero's four planes,
   the wipe, the resolver, the orchestration run, the pan, plus the data-driven parts
   (themes, releases, roadmap, key map, downloads). With no JS the page is complete static HTML;
   with reduced motion every act shows its final state and nothing is pinned. */
(() => {
  'use strict';
  const REPO = 'dark-magic-studios/gitmoire-releases';
  const RELEASES_URL = `https://github.com/${REPO}/releases`;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) root.classList.add('rm');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const hash7 = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7); };
  function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ── toast ── */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  };

  /* ══════════ themes: the page wears the app's real themes ══════════ */
  let THEMES = [];
  const themeId = () => root.dataset.theme || 'dark-magic';
  const isLight = () => root.dataset.base === 'light';
  const themeLabel = (id) => (THEMES.find((t) => t.id === id) || { label: id }).label;
  function applyTheme(id, { silent = false, persist = true } = {}) {
    const t = THEMES.find((x) => x.id === id);
    root.dataset.theme = id;
    root.dataset.base = id === 'dark-magic-light' || (t && t.base === 'light') ? 'light' : 'dark';
    if (persist) store.set('gm-theme', id);
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
    $('#theme-toggle-label').textContent = isLight() ? 'dark' : 'light';
    $$('.swatch').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    const img = $('#theme-shot');
    if (img) {
      img.src = `/assets/shots/theme-${id}.webp`;
      img.alt = `gitmoire in the ${themeLabel(id)} theme`;
      $('#theme-shot-name').textContent = themeLabel(id).toLowerCase();
    }
    if (!silent) toast(`${themeLabel(id)}. Better already.`);
  }
  function applyAccent(id) {
    root.dataset.accent = id; store.set('gm-accent', id);
    $$('.accent').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
  }
  const ACCENTS = [['purple', '#8C15F9'], ['jade', '#10c98f'], ['sapphire', '#4f8cf5'], ['lotus', '#f0559f'], ['crimson', '#f05656']];
  function renderThemePickers() {
    const wrap = $('#theme-picks');
    wrap.innerHTML = THEMES.map((t) => `
      <button class="swatch" role="radio" aria-checked="false" data-id="${esc(t.id)}" type="button">
        <span class="dots" aria-hidden="true" style="background:${esc(t.bg)}">${t.dots.map((d) => `<i style="background:${esc(d)}"></i>`).join('')}</span>
        <span>${esc(t.label.replace(/^Dark Magic ?/, '') || 'Dark Magic')}</span>
      </button>`).join('');
    wrap.addEventListener('click', (e) => { const b = e.target.closest('.swatch'); if (b) applyTheme(b.dataset.id); });
    const acc = $('#accent-picks');
    acc.innerHTML = '<span class="lbl">accent</span>' + ACCENTS.map(([id, c]) =>
      `<button class="accent" role="radio" aria-checked="false" aria-label="${id} accent" title="${id}" data-id="${id}" type="button" style="background:${c}"></button>`).join('');
    acc.addEventListener('click', (e) => { const b = e.target.closest('.accent'); if (b) { applyAccent(b.dataset.id); toast(`${b.dataset.id} accent. Bold.`); } });
    applyAccent(root.dataset.accent || 'purple');
    applyTheme(themeId(), { silent: true, persist: false });
  }
  $('#theme-toggle-label').textContent = isLight() ? 'dark' : 'light';
  get('/data/themes.json').then((t) => { THEMES = t; renderThemePickers(); }).catch(() => {
    $('#theme-picks').innerHTML = '<p class="meta">The theme list went missing. The toggle in the status line still works.</p>';
  });
  $('#theme-toggle').addEventListener('click', () => applyTheme(isLight() ? 'dark-magic' : 'dark-magic-light'));

  /* omarchy */
  const omaTabs = $$('#omarchy-tabs [role=tab]');
  omaTabs.forEach((t) => t.addEventListener('click', () => {
    omaTabs.forEach((b) => b.setAttribute('aria-selected', String(b === t)));
    const img = $('#omarchy-shot');
    img.src = `/assets/shots/omarchy-${t.dataset.omarchy}.webp`;
    img.alt = `gitmoire wearing the ${t.dataset.name} Omarchy theme.`;
    $('#omarchy-name').textContent = t.dataset.name.toLowerCase();
  }));

  /* lane palettes */
  const LANE_SHOTS = new Set(['gitmoire', 'dark-magic', 'neon', 'pastel', 'mono']);
  get('/data/palettes.json').then((pals) => {
    const tabsEl = $('#lane-tabs');
    tabsEl.innerHTML = pals.map((p, i) => `<button role="tab" type="button" aria-selected="${i === 0}" data-id="${esc(p.id)}">
        <span class="lane-tabs-dot" aria-hidden="true">${p.dark.map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</span>${esc(p.label)}</button>`).join('');
    const show = (id) => {
      const p = pals.find((x) => x.id === id) || pals[0];
      $$('#lane-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === p.id)));
      const img = $('#lane-shot');
      img.src = `/assets/shots/lanes-${LANE_SHOTS.has(p.id) ? p.id : 'gitmoire'}.webp`;
      img.alt = `The commit graph with the ${p.label} lane palette.`;
      $('#lane-name').textContent = p.label.toLowerCase();
      $('#lane-note').textContent = p.id === 'project'
        ? 'Extracted from your project logo. The demo repo\'s logo is purple, so here it matches Gitmoire; yours won\'t.'
        : `${p.description}.`;
      const row = (label, arr) => `<div class="lane-row"><span class="lbl">${label}</span>${arr.map((c) => `<i title="${esc(c)}" style="background:${esc(c)}"></i>`).join('')}</div>`;
      $('#lane-swatches').innerHTML = row('dark', p.dark) + row('light', p.light);
    };
    tabsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.id); });
    show(pals[0].id);
  }).catch(() => { $('#lane-tabs').innerHTML = '<p class="meta">The palette list went missing.</p>'; });

  /* ══════════ platform, downloads, sizes ══════════ */
  const ua = navigator.userAgent;
  const os = /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? 'mac' : /Win/i.test(ua) ? 'win' : 'linux';
  const OS_LABEL = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
  const OS_ASSET = { mac: /\.dmg$/i, win: /(setup\.exe|\.msi)$/i, linux: /\.AppImage$/i };
  const osTabs = $$('.os [role=tab]');
  const setOs = (id) => {
    osTabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.os === id)));
    $$('.install').forEach((p) => { p.hidden = p.dataset.panel !== id; });
  };
  osTabs.forEach((b) => b.addEventListener('click', () => setOs(b.dataset.os)));
  setOs(os);

  const dl = $('#dl'), dlBar = $('#dl-bar'), dlMeta = $('#dl-meta');
  let publishedTags = new Set();
  const mb = (n) => (n / 1048576).toFixed(1);
  const BAR_KINDS = [['macOS .dmg', /\.dmg$/], ['Windows setup.exe', /setup\.exe$/], ['Windows .msi', /\.msi$/], ['Linux .deb', /\.deb$/], ['Linux .rpm', /\.rpm$/], ['Linux AppImage', /\.AppImage$/]];

  function setBars() {
    $$('#size-chart .bar, .bars .bar').forEach((b) => {
      const w = b.dataset.pct ? Number(b.dataset.pct) : Math.max(1, (Number(b.dataset.mb) / 1024) * 100);
      b.style.setProperty('--w', `${w}%`);
    });
  }
  function applyRelease(rel) {
    const ver = rel.tag_name.replace(/^v/, '');
    const sizes = {};
    BAR_KINDS.forEach(([label, re]) => { const a = rel.assets.find((x) => re.test(x.name)); if (a) sizes[label] = a; });
    $$('#size-chart .row').forEach((row) => {
      const a = sizes[$('.lbl', row).textContent];
      if (!a) return;
      $('.bar', row).dataset.mb = mb(a.size); $('.val', row).textContent = `${mb(a.size)} MB`;
    });
    setBars();
    const exe = sizes['Windows setup.exe'], app = sizes['Linux AppImage'];
    if (exe && app) $('#sizes-line').innerHTML = `The ${esc(rel.tag_name)} downloads run from ${mb(exe.size)}&nbsp;MB on Windows to ${mb(app.size)}&nbsp;MB for the Linux AppImage.`;
    $('#size-cap').innerHTML = `${esc(rel.tag_name)} release assets, from the published byte counts. Bars are to scale against ~1&nbsp;GB, and yes, they are still that small.`;
    const rl = $('#rel-link'); rl.href = rel.html_url; rl.textContent = `${rel.tag_name} release`;
    if (ver !== '0.14.2') {
      $$('.install pre').forEach((p) => { p.innerHTML = p.innerHTML.split('0.14.2').join(ver); });
      $$('.install a[href*="/download/"]').forEach((a) => {
        const name = a.getAttribute('href').split('/').pop().split('0.14.2').join(ver);
        const asset = rel.assets.find((x) => x.name === name);
        if (!asset) return;
        a.href = asset.browser_download_url; a.textContent = `Download ${name}`;
        const sz = a.nextElementSibling; if (sz && sz.classList.contains('dim')) sz.textContent = `${mb(asset.size)} MB`;
      });
    }
  }

  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const published = (Array.isArray(list) ? list : []).filter((r) => !r.draft && r.assets && r.assets.length);
      publishedTags = new Set(published.map((r) => r.tag_name));
      const rel = published[0];
      const asset = rel && rel.assets.find((a) => OS_ASSET[os].test(a.name));
      if (rel) applyRelease(rel);
      if (asset) {
        dl.textContent = `Download for ${OS_LABEL[os]}`; dl.href = asset.browser_download_url; dlBar.href = asset.browser_download_url;
        dlMeta.textContent = `${rel.tag_name}, ${asset.name}, ${mb(asset.size)} MB. Free. Unsigned builds, so your OS asks once.`;
      } else if (rel) {
        dl.textContent = 'Download gitmoire'; dl.href = rel.html_url; dlBar.href = rel.html_url;
      } else {
        dl.textContent = 'Watch for the first build';
        dlMeta.textContent = 'No public build yet. The first one lands in the releases repo: press Watch there and tick Releases to hear about it.';
      }
      renderReleaseNotice(); markReleaseLinks();
    })
    .catch(() => { /* offline or rate-limited: static links still point somewhere real */ });

  /* bars grow when seen */
  setBars();
  const barObs = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { $$('.bar', e.target).forEach((b, i) => setTimeout(() => b.classList.add('go'), reduce ? 0 : i * 90)); barObs.unobserve(e.target); }
  }), { threshold: 0.3 }) : null;
  $$('.bars').forEach((f) => { if (barObs && !reduce) barObs.observe(f); else $$('.bar', f).forEach((b) => b.classList.add('go')); });

  /* ══════════ releases + roadmap ══════════ */
  function renderReleaseNotice() {
    const n = $('#rel-notice'); if (!n) return;
    if (publishedTags.size) { n.hidden = true; return; }
    n.hidden = false;
    n.innerHTML = 'These versions are built in the private repo. <b>None are published for download yet.</b> Each one appears in the <a href="' + RELEASES_URL + '">releases repo</a> as it ships.';
  }
  function markReleaseLinks() {
    $$('.rel .dl-slot').forEach((el) => {
      const v = el.dataset.v;
      el.innerHTML = publishedTags.has(`v${v}`) ? `<a href="${RELEASES_URL}/tag/v${esc(v)}">Downloads for v${esc(v)}</a>` : '<span class="dim">Not published for download yet.</span>';
    });
  }
  get('/data/releases.json').then((rels) => {
    $('#release-list').innerHTML = rels.map((r, i) => {
      const hl = r.highlights.map((h) => `<li><b>${md(h.title)}.</b> <span class="t">${md(h.text)}</span></li>`).join('');
      const first = r.summary ? r.summary.split(/(?<=[.!?])\s/)[0] : (r.highlights[0] ? r.highlights[0].title : 'Maintenance release');
      const rest = r.summary && r.summary.length > first.length + 2 ? r.summary.slice(first.length).trim() : '';
      return `<details class="rel"${i === 0 ? ' open' : ''}>
        <summary><span class="v">v${esc(r.version)}</span><span class="d">${esc(r.date || '')}</span>
          <span class="s">${md(first)}${i === 0 ? '<span class="tag latest">latest</span>' : ''}</span><span class="chev" aria-hidden="true"></span></summary>
        <div class="rel-body">${rest ? `<p class="lead">${md(rest)}</p>` : ''}${hl ? `<ul class="hl">${hl}</ul>` : ''}
          <p class="links dl-slot" data-v="${esc(r.version)}"><span class="dim">Checking for a published build…</span></p></div>
      </details>`;
    }).join('');
    renderReleaseNotice(); markReleaseLinks(); layout();
  }).catch(() => {
    $('#release-list').innerHTML = `<p class="meta">The changelog went quiet. Every published release lives on the <a href="${RELEASES_URL}">releases page</a> anyway.</p>`;
  });
  $('#release-list').addEventListener('toggle', () => layout(), true);

  const bar = (n) => { const full = Math.round(n / 10); return `[${'█'.repeat(full)}<span class="e">${'░'.repeat(10 - full)}</span>]`; };
  const potion = (p) => `<div class="potion ${p.status === 'completed' ? 'done' : p.status}"><span>${md(p.feature)}</span>
      <span class="pbar" aria-hidden="true">${bar(p.progress)}</span><span class="pct">${p.progress}%<span class="sr"> done</span></span></div>`;
  get('/data/roadmap.json').then((r) => {
    const by = (s) => r.potions.filter((p) => p.status === s);
    const active = by('active'), draft = by('draft'), done = by('completed');
    const later = r.groups.flatMap((g) => g.items.filter((i) => !i.shipped));
    const section = (title, count, body) => `<div class="rm-group"><h3>${title} <span class="n">${count}</span></h3>${body}</div>`;
    let html = '';
    if (active.length) html += section('Brewing now', active.length, active.map(potion).join(''));
    if (draft.length) html += section('On the shelf, not started', draft.length, draft.map(potion).join(''));
    if (later.length) html += section('Later', later.length, `<ul class="tree rm-later">${later.map((i) => `<li>${md(i.text)}</li>`).join('')}</ul>`);
    if (r.nonGoals) html += `<p class="rm-no"><b>Not building:</b> ${md(r.nonGoals)}</p>`;
    html += `<div class="rm-group"><details class="shipped"><summary>Already drunk: ${done.length} potions shipped</summary>${done.map(potion).join('')}</details></div>`;
    $('#roadmap-body').innerHTML = html; layout();
  }).catch(() => { $('#roadmap-body').innerHTML = '<p class="meta">The roadmap wandered off. A refresh usually coaxes it back.</p>'; });

  /* ══════════ shortcuts: the app's real key map ══════════ */
  let KEYMAP = [], keyGroup = 'All', mac = os === 'mac';
  const NAMED = { enter: '⏎', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', home: 'Home', end: 'End', tab: 'Tab' };
  const cap = (c) => {
    const parts = c.split('+'); const key = parts.pop() || '+';
    const caps = parts.map((m) => (m === 'mod' ? (mac ? '⌘' : 'Ctrl') : m === 'shift' ? (mac ? '⇧' : 'Shift') : m === 'alt' ? (mac ? '⌥' : 'Alt') : m === 'ctrl' ? (mac ? '⌃' : 'Ctrl') : m));
    caps.push(NAMED[key] || (key.length === 1 ? key.toUpperCase() : key));
    return caps;
  };
  const displayCaps = (arr) => arr.map((c) => (c === 'mod' ? (mac ? '⌘' : 'Ctrl') : c === '⇧' && !mac ? 'Shift' : c));
  const keycaps = (caps) => caps.map((c) => `<kbd>${esc(c)}</kbd>`).join('');
  function entryCombos(e) {
    if (e.display) return [displayCaps(e.display)];
    const seen = new Set(), out = [];
    for (const k of e.keys) { const caps = cap(k); const sig = caps.join('+'); if (!seen.has(sig)) { seen.add(sig); out.push(caps); } }
    return e.id === 'repo.prevRepo' || e.id === 'repo.nextRepo' ? out.slice(0, 1) : out.slice(0, 2);
  }
  function renderKeys() {
    const q = $('#key-filter').value.trim().toLowerCase();
    const rows = KEYMAP.filter((e) => (keyGroup === 'All' || e.group === keyGroup) && (!q || e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)));
    const table = $('#key-table');
    if (!rows.length) table.innerHTML = '<p class="key-empty">Nothing bound to that. Either it needs no shortcut or it deserves one. <a href="https://github.com/' + REPO + '/issues">Tell me</a>.</p>';
    else {
      let html = '', last = '';
      for (const e of rows) {
        if (keyGroup === 'All' && e.group !== last) { last = e.group; html += `<div class="key-group-title">${esc(last)}</div>`; }
        const combos = entryCombos(e).map((c, i) => `<span class="combo${i ? ' alt' : ''}">${keycaps(c)}</span>`).join('');
        html += `<div class="key-row"><span class="l">${esc(e.label)}</span><span class="k">${combos}</span></div>`;
      }
      table.innerHTML = html;
    }
    $('#key-count').textContent = `${rows.length} of ${KEYMAP.length} shortcuts, read straight from the app's key map.`;
    $$('.os-mod').forEach((n) => { n.textContent = mac ? '⌘' : 'Ctrl'; });
    $('#os-switch-label').textContent = mac ? 'show pc keys' : 'show mac keys';
  }
  get('/data/keymap.json').then((k) => {
    const ORDER = ['General', 'Panels', 'Git', 'Graph', 'Diff', 'Home'];
    KEYMAP = [...k].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));
    const groups = ['All', ...ORDER.filter((g) => k.some((e) => e.group === g))];
    $('#key-groups').innerHTML = groups.map((g) => `<button role="tab" type="button" data-g="${esc(g)}" aria-selected="${g === 'All'}">${esc(g.toLowerCase())}</button>`).join('');
    $('#key-groups').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      keyGroup = b.dataset.g; $$('#key-groups button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); renderKeys();
    });
    $('#key-filter').addEventListener('input', renderKeys);
    $('#os-switch').addEventListener('click', () => { mac = !mac; renderKeys(); });
    renderKeys(); layout();
  }).catch(() => { $('#key-table').innerHTML = '<p class="key-empty">The key map didn\'t load. In the app, press <kbd>?</kbd> for the full list.</p>'; });

  /* ══════════ the resolver: a hand-sized sample running real logic ══════════ */
  (() => {
    const box = $('#resolver'); if (!box) return;
    const SIDES = { ours: [[41, 'const palette = useThemePalette();'], [42, 'return render(rows, { palette, animate: true });']],
      theirs: [[41, 'const colors = LegacyColors();'], [42, 'return render(rows, { colors });']] };
    const sel = { ours: [false, false], theirs: [false, false] };
    const out = $('#r-out'), mark = $('#r-mark'), status = $('#r-status');
    const draw = () => {
      for (const s of ['ours', 'theirs']) {
        $(`#r-${s}`).innerHTML = SIDES[s].map(([n, t], i) => `<li class="${s}"><span class="no">${n}</span>
          <button type="button" aria-pressed="${sel[s][i]}" aria-label="Take ${s} line ${n}" data-s="${s}" data-i="${i}">${sel[s][i] ? '✓' : '+'}</button><code>${esc(t)}</code></li>`).join('');
        $(`[data-all=${s}]`).checked = sel[s].every(Boolean);
      }
      const lines = ['ours', 'theirs'].flatMap((s) => SIDES[s].filter((_, i) => sel[s][i]).map(([, t]) => t));
      out.innerHTML = lines.length ? esc(lines.join('\n')) : '<span class="un">// unresolved: take a side, or a single line</span>';
      mark.disabled = !lines.length;
      mark.textContent = 'Mark resolved'; box.dataset.state = 'open';
      status.textContent = '2 conflicts left in this repository.';
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-s]');
      if (b) { sel[b.dataset.s][+b.dataset.i] = !sel[b.dataset.s][+b.dataset.i]; draw(); }
    });
    box.addEventListener('change', (e) => {
      const s = e.target.dataset.all; if (!s) return;
      sel[s] = sel[s].map(() => e.target.checked); draw();
    });
    mark.addEventListener('click', () => { box.dataset.state = 'resolved'; mark.textContent = 'Resolved ✓'; mark.disabled = true; status.textContent = '1 conflict left in this repository. Nothing was written to disk. It is a sample.'; });
    draw();
  })();

  /* ══════════ scroll engine: progress per act ══════════ */
  const acts = $$('[data-act]').map((el) => ({ el, id: el.id, span: Number(el.dataset.span || 0), top: 0, h: 0, p: 0 }));
  const byId = (id) => acts.find((a) => a.id === id);
  const CHAPTERS = [['hook', 'top'], ['weight', 'weight'], ['graph', 'graph'], ['craft', 'craft'], ['conflicts', 'conflicts'], ['agents', 'agents'], ['ai', 'ai'], ['cli', 'cli'], ['themes', 'themes'], ['keys', 'keys'], ['log', 'log'], ['install', 'install']];
  let vh = innerHeight, vw = innerWidth, docMax = 1, railOn = false;
  let panMax = 0;

  /* tmux windows */
  const winsEl = $('#tmux-wins');
  winsEl.innerHTML = CHAPTERS.map(([n, id], i) => `<a href="#${id}" data-i="${i}">${i}:${n}</a>`).join('');
  const winEls = $$('a', winsEl);

  /* ── the rail ── */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const rail = $('#rail');
  const BR_COL = ['--info', '--warn', '--ok'];
  let railParts = null;
  const mk = (n, a = {}, parent) => { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; };
  const ry = (y) => railParts.T + clamp(y / docMax) * (railParts.H - 2 * railParts.T);

  function buildRail() {
    railOn = matchMedia('(min-width: 1180px)').matches;
    rail.hidden = !railOn; rail.textContent = '';
    if (!railOn) { railParts = null; return; }
    const H = rail.clientHeight || innerHeight - 36, W = 84, T = 30, X = 22;
    const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group' }, rail);
    railParts = { H, W, T, X, nodes: [], branches: [] };
    mk('line', { class: 'base', x1: X, y1: T, x2: X, y2: H - T }, svg);
    const done = mk('line', { class: 'done', x1: X, y1: T, x2: X, y2: T }, svg);
    const p = railParts;
    p.done = done;
    const peak = byId('agents'), peakEnd = peak.top + peak.h - vh;
    for (let k = 0; k < 3; k++) {
      const x = X + 16 * (k + 1), y0 = ry(peak.top), y1 = ry(peakEnd), d = 14;
      const path = mk('path', { class: 'br', pathLength: 1, d: `M${X} ${y0} Q${x} ${y0} ${x} ${y0 + d} L${x} ${y1 - d} Q${x} ${y1} ${X} ${y1}`, stroke: `hsl(var(${BR_COL[k]}))`, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, svg);
      p.branches.push(path);
    }
    CHAPTERS.forEach(([n, id], i) => {
      const a = byId(id); if (!a) return;
      const y = i === 0 ? T : ry(a.top);
      const g = mk('a', { href: `#${id}`, 'aria-label': `${n}: ${hash7(n)}` }, svg);
      mk('title', {}, g).textContent = `${hash7(n)} ${n}`;
      const c = mk('circle', { class: 'node', cx: X, cy: y, r: 5 }, g);
      const t = mk('text', { x: X + 12, y: y + 3.5 }, g); t.textContent = hash7(n);
      t.style.display = 'none';
      p.nodes.push({ c, t, y, id });
    });
    p.head = mk('circle', { class: 'head', cx: X, cy: T, r: 9 }, svg);
  }

  function updateRail(sy) {
    if (!railOn || !railParts) return;
    const p = railParts, y = ry(sy);
    p.head.setAttribute('cy', y); p.done.setAttribute('y2', y);
    p.nodes.forEach((n, i) => { const on = n.y <= y + 1; n.c.classList.toggle('on', on); const cur = i === cur_i; n.t.style.display = cur ? '' : 'none'; n.t.classList.toggle('cur', cur); });
    const pk = byId('agents').p;
    p.branches.forEach((b, k) => { b.setAttribute('stroke-dashoffset', 1 - clamp((pk - .26 - k * .08) / .5)); });
  }

  /* ── scroll-driven acts ── */
  const hero = byId('top'), wipe = byId('graph'), peakA = byId('agents'), pan = byId('ai');
  let cur_i = 0;

  function runePath(r) {
    const s = [], br = [[0, -14, 8, -6], [0, -14, -8, -6], [0, -2, 8, 6], [0, 2, -8, 10], [0, -6, 8, 2], [0, 14, 8, 6], [0, 6, -8, -2]];
    let d = 'M0 -14V14';
    const n = 1 + Math.floor(r() * 2.99);
    for (let i = 0; i < n; i++) { const b = br[Math.floor(r() * br.length)]; if (!s.includes(b)) { s.push(b); d += `M${b[0]} ${b[1]}L${b[2]} ${b[3]}`; } }
    return d;
  }
  function buildSigil() {
    const svg = $('#sigil'); if (!svg) return;
    const r = rng(2026), a = mk('g', { class: 'ring', id: 'ring-a' }, svg), b = mk('g', { class: 'ring', id: 'ring-b' }, svg);
    const st = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2 };
    [470, 440, 340, 312, 206].forEach((rad, i) => mk('circle', { ...st, r: rad, opacity: i === 1 || i === 3 ? .5 : 1 }, i < 2 ? a : b));
    for (let i = 0; i < 24; i++) {
      const g = mk('g', { transform: `rotate(${i * 15}) translate(0 -391)` }, a);
      mk('path', { ...st, d: runePath(r), 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    }
    for (let i = 0; i < 72; i++) mk('line', { ...st, x1: 0, y1: -470, x2: 0, y2: i % 3 ? -458 : -450, transform: `rotate(${i * 5})`, opacity: .6 }, a);
    const tri = (rad, rot) => { const pts = [0, 1, 2].map((k) => { const ang = ((rot + k * 120) * Math.PI) / 180; return `${(rad * Math.sin(ang)).toFixed(1)},${(-rad * Math.cos(ang)).toFixed(1)}`; }).join(' '); mk('polygon', { ...st, points: pts }, b); };
    tri(312, 0); tri(312, 180);
    for (let i = 0; i < 12; i++) { const g = mk('g', { transform: `rotate(${i * 30 + 7}) translate(0 -260) scale(.8)` }, b); mk('path', { ...st, d: runePath(r), 'stroke-linecap': 'round' }, g); }
  }

  /* embers: drifting runes on a canvas, only while the hero is on screen */
  const cv = $('#embers'), ctx = cv && cv.getContext('2d');
  let embers = [], cw = 0, ch = 0, emberRun = false;
  function initEmbers() {
    if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    cw = cv.clientWidth; ch = cv.clientHeight; cv.width = cw * dpr; cv.height = ch * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(7), n = vw < 700 ? 18 : 36;
    embers = Array.from({ length: n }, () => ({ x: r() * cw, y: r() * ch, s: .5 + r() * 1.1, v: .12 + r() * .35, a: .15 + r() * .45, d: new Path2D(runePath(r)), rot: (r() - .5) * .5 }));
    drawEmbers(0);
  }
  function drawEmbers(dt) {
    ctx.clearRect(0, 0, cw, ch);
    const col = getComputedStyle(root).getPropertyValue('--primary-text').trim();
    ctx.strokeStyle = `hsl(${col})`; ctx.lineWidth = 1.4;
    for (const e of embers) {
      e.y -= e.v * dt * .06; if (e.y < -30) { e.y = ch + 30; }
      ctx.save(); ctx.globalAlpha = e.a * .8 * (.5 + .5 * Math.sin(e.y / 90 + e.x)); ctx.translate(e.x + (pointer.x * 20 * e.s), e.y); ctx.rotate(e.rot); ctx.scale(e.s, e.s); ctx.stroke(e.d); ctx.restore();
    }
  }
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let last = 0;
  function frame(t) {
    const dt = Math.min(48, t - last || 16); last = t;
    pointer.x += (pointer.tx - pointer.x) * .08; pointer.y += (pointer.ty - pointer.y) * .08;
    root.style.setProperty('--px', pointer.x.toFixed(3)); root.style.setProperty('--py', pointer.y.toFixed(3));
    if (ctx) drawEmbers(dt);
    if (!reduce) requestAnimationFrame(frame); else emberRun = false;
  }
  function startEmbers() { if (!emberRun && !reduce && ctx) { emberRun = true; last = 0; requestAnimationFrame(frame); } }
  if (matchMedia('(pointer: fine)').matches && !reduce) {
    addEventListener('pointermove', (e) => { pointer.tx = (e.clientX / innerWidth - .5) * 2; pointer.ty = (e.clientY / innerHeight - .5) * 2; startEmbers(); }, { passive: true });
  }

  /* the wipe: a raw git log becomes the real graph */
  function buildTangle() {
    const t = $('#tangle'); if (!t) return;
    const r = rng(99), msgs = ['wip', 'fix', 'fix again', 'update', 'asdf', "Merge branch 'main' into main", 'revert revert', 'final', 'final2', 'oops', 'tmp', 'stuff'];
    const lanes = 9; let cols = Array.from({ length: lanes }, (_, i) => i < 3);
    const rows = [];
    for (let i = 0; i < 46; i++) {
      let s = '';
      const mover = Math.floor(r() * lanes), kind = r();
      for (let c = 0; c < lanes; c++) {
        if (c === mover) s += '* '; else if (cols[c]) s += kind < .25 && c === mover + 1 ? '\\ ' : kind > .8 && c === mover - 1 ? '/ ' : '| '; else s += '  ';
      }
      if (r() < .3) cols[Math.floor(r() * lanes)] = !cols[Math.floor(r() * lanes)];
      const h = Math.floor(r() * 0xfffffff).toString(16).padStart(7, '0');
      rows.push(`${s} ${h} ${msgs[Math.floor(r() * msgs.length)]}`);
    }
    t.textContent = rows.join('\n');
  }

  function setActs(sy) {
    root.style.setProperty('--sy', Math.round(sy));
    for (const a of acts) {
      if (a.span) a.p = clamp((sy - a.top) / Math.max(1, a.h - vh));
      else a.p = clamp((sy + vh - a.top) / (a.h + vh));
    }
    // hero depth
    hero.el.style.setProperty('--hp', reduce ? 0 : hero.p.toFixed(4));
    // wipe
    const wc = reduce ? 1 : ease(clamp((wipe.p - .12) / .6));
    wipe.el.style.setProperty('--wc', wc.toFixed(4)); wipe.el.style.setProperty('--wp', wc.toFixed(4));
    const tg = $('#tangle'); if (tg && !reduce) tg.style.transform = `translate3d(0, ${(-wipe.p * 140).toFixed(1)}px, 0)`;
    // peak
    runPeak(reduce ? 1 : peakA.p);
    // pan
    if (!reduce) pan.el.style.setProperty('--pan', (pan.p * panMax).toFixed(1));
    // cli type-on
    typeOn();
    // active chapter
    let ci = 0; CHAPTERS.forEach(([, id], i) => { const a = byId(id); if (a && a.top <= sy + vh * .4) ci = i; });
    if (ci !== cur_i || !winEls[0].hasAttribute('aria-current')) {
      cur_i = ci; winEls.forEach((w, i) => w.setAttribute('aria-current', String(i === ci)));
    }
    updateRail(sy);
  }

  /* the peak: scroll runs an orchestration; the rail forks with it */
  const peakEls = { task: $('#peak-task'), plan: $('#peak-plan'), approve: $('#peak-approve'), steps: $$('#peak-steps li'), lanes: $$('#peak-lanes li'), merge: $('#peak-merge') };
  const TASK = 'Add CSV export to the stats page';
  function runPeak(p) {
    if (!peakEls.task) return;
    peakA.el.style.setProperty('--pp', p.toFixed(4));
    const tp = clamp(p / .14);
    peakEls.task.textContent = TASK.slice(0, Math.round(tp * TASK.length));
    const dimLine = $('.dim', peakEls.plan);
    dimLine.style.opacity = p > .17 ? 1 : 0; peakEls.approve.style.opacity = p > .26 ? 1 : 0;
    const si = p < .17 ? 0 : p < .3 ? 1 : p < .8 ? 2 : 3;
    peakEls.steps.forEach((li, i) => li.classList.toggle('on', i === si));
    peakEls.lanes.forEach((li, k) => {
      const s = .32 + k * .07, e = s + (k === 2 ? .22 : .32), lp = clamp((p - s) / (e - s));
      li.querySelector('.lbar i').style.setProperty('--lp', lp.toFixed(3));
      const b = li.querySelector('.badge');
      const st = p < s ? ['queue', 'queued'] : lp < 1 ? ['work', k === 2 ? 'reviewing' : 'working'] : p > .88 ? ['done', 'merged'] : ['done', 'done'];
      b.dataset.s = st[0]; b.textContent = st[1];
    });
    peakEls.merge.style.opacity = p > .9 ? 1 : 0;
  }

  /* the cli transcript types itself as it passes */
  const termEl = $('#term'), termLines = termEl ? $$('.ln', termEl) : [];
  function typeOn() {
    if (!termEl || reduce) return;
    const r = termEl.getBoundingClientRect();
    const p = clamp((vh * .9 - r.top) / (vh * .55));
    termLines.forEach((l) => { l.style.setProperty('--lo', p >= Number(l.dataset.at) ? 1 : 0); });
  }

  /* ── layout + loop ── */
  function measure() {
    vh = innerHeight; vw = innerWidth;
    const sy = scrollY;
    for (const a of acts) { const r = a.el.getBoundingClientRect(); a.top = r.top + sy; a.h = a.el.offsetHeight; }
    docMax = Math.max(1, document.documentElement.scrollHeight - vh);
    const track = $('#pan-track');
    panMax = track ? Math.max(0, track.scrollWidth - vw + 16) : 0;
  }
  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; setActs(scrollY); startEmbers(); }); } }
  function layout() { measure(); buildRail(); setActs(scrollY); }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { initEmbers(); layout(); }, 120); });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* sections arrive: transform and opacity only, and never later than a glance */
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.sec .h, .sec .sub, .sec .big, .grid .pane, .sec .split > *, .craft-shots figure, .agents-more .tree').forEach((el) => { el.classList.add('in'); io.observe(el); });
  }

  buildSigil(); buildTangle(); initEmbers(); layout(); startEmbers();

  /* ══════════ keyboard + command prompt ══════════ */
  const go = (sel) => {
    const el = $(sel); if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', sel);
  };
  const cmdOut = $('#cmd-out'), cmdIn = $('#cmd'), hist = []; let hi = 0;
  const say = (html) => { const d = document.createElement('div'); d.innerHTML = html; cmdOut.appendChild(d); cmdOut.scrollTop = cmdOut.scrollHeight; };
  const installLine = { mac: 'curl -fsSL https://gitmoire.dev/install.sh | sh', win: 'irm https://gitmoire.dev/install.ps1 | iex', linux: 'curl -fsSL https://gitmoire.dev/install.sh | sh' };
  const COMMANDS = {
    help: () => say('help · install · download · themes · theme &lt;name&gt; · accent &lt;name&gt; · ls · keys · releases · roadmap · agents · whoami · clear'),
    install: () => { setOs(os); say(`<span class="ok">detected ${OS_LABEL[os]}.</span> paste this:<br><code>${esc(installLine[os])}</code>`); },
    download: () => say(`<a href="${esc(dl.href)}">${esc(dl.textContent)}</a>`),
    themes: () => say(THEMES.map((t) => esc(t.id.replace('dark-magic-', '').replace('dark-magic', 'default'))).join(' · ') || 'loading…'),
    ls: () => say(CHAPTERS.map(([n]) => n).join('  ')),
    keys: () => { say('opening the key map…'); go('#keys'); },
    releases: () => { say('git log, newest first.'); go('#releases'); },
    log: () => COMMANDS.releases(),
    roadmap: () => { say('the real ledger.'); go('#roadmap-h'); },
    agents: () => { say('summoning…'); go('#agents'); },
    whoami: () => say('a person who commits at 2am, and is respected for it.'),
    clear: () => { cmdOut.textContent = ''; },
  };
  function runCmd(line) {
    const [c, ...args] = line.trim().split(/\s+/); if (!c) return;
    say(`<span class="ps1 ok">gitmoire:~$</span> ${esc(line)}`);
    if (c === 'sudo') return say('gitmoire: nice try. you are already root of your own repo.');
    if (c === 'theme') {
      const q = (args[0] || '').toLowerCase();
      const t = THEMES.find((x) => x.id === `dark-magic-${q}` || x.id === q || (q === 'default' && x.id === 'dark-magic'));
      if (!t) return say(`no such theme: ${esc(q)}. try <code>themes</code>.`);
      applyTheme(t.id, { silent: true }); return say(`wearing ${esc(t.label)}.`);
    }
    if (c === 'accent') {
      const a = ACCENTS.find(([id]) => id === (args[0] || '').toLowerCase());
      if (!a) return say(`accents: ${ACCENTS.map(([id]) => id).join(', ')}`);
      applyAccent(a[0]); return say(`accent: ${a[0]}.`);
    }
    if (COMMANDS[c]) return COMMANDS[c]();
    say(`gitmoire: command not found: ${esc(c)}. try <code>help</code>.`);
  }
  $('#cmd-form').addEventListener('submit', (e) => { e.preventDefault(); const v = cmdIn.value; if (v.trim()) { hist.push(v); hi = hist.length; } cmdIn.value = ''; runCmd(v); });
  cmdIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); cmdIn.value = hist[hi]; }
    if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hi = Math.min(hist.length, hi + 1); cmdIn.value = hist[hi] || ''; }
  });

  let konami = 0;
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    const k = e.key.toLowerCase();
    if (!typing) {
      konami = k === KONAMI[konami] ? konami + 1 : (k === KONAMI[0] ? 1 : 0);
      if (konami === KONAMI.length) { konami = 0; applyTheme('dark-magic-frankenstein', { silent: true }); toast('It\'s alive. It\'s ALIVE. (Frankenstein theme unlocked.)'); return; }
    }
    if (typing) { if (k === 'escape') e.target.blur(); return; }
    if (/^\d$/.test(k)) { const c = CHAPTERS[Number(k)]; if (c) go(`#${c[1]}`); return; }
    if (k === 'l') applyTheme(isLight() ? 'dark-magic' : 'dark-magic-light');
    else if (k === '/') { e.preventDefault(); go('#keys'); setTimeout(() => $('#key-filter').focus(), reduce ? 0 : 450); }
    else if (k === ':') { e.preventDefault(); go('#install'); setTimeout(() => cmdIn.focus(), reduce ? 0 : 600); }
    else if (k === 'r') go('#releases');
    else if (k === 'm') go('#roadmap-h');
    else if (k === 'i') go('#install');
    else if (k === 't') go('#top');
    else if (k === 'd') { dl.focus(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  });
  // window links jump without a hash-flash
  winsEl.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(a.getAttribute('href')); } });
  rail.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(a.getAttribute('href').baseVal || a.getAttribute('href')); } });

  /* witching hour: the app does this too, between midnight and 3am */
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 3) { const w = $('#witching'); if (w) w.hidden = false; }
  try {
    console.log('%cgitmoire', 'font:700 20px monospace;color:#a855f7');
    console.log('Poking around? Same. Try the Konami code, or press : to talk to the page.');
  } catch { /* console unavailable */ }
})();
