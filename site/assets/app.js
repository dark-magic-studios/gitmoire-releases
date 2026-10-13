/* gitmoire landing: themes, screenshots, boot line, shortcuts, releases, roadmap,
   install state, and a couple of easter eggs. Everything degrades: with no JS
   the page is still complete static HTML. */
(() => {
  'use strict';
  const REPO = 'dark-magic-studios/gitmoire-releases';
  const RELEASES_URL = `https://github.com/${REPO}/releases`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* ── toast ── */
  const toastEl = $('#toast');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  };

  /* ── themes: the page wears the app's real themes ── */
  let THEMES = [];
  const LIGHT = new Set(['dark-magic-light']);
  const themeId = () => root.dataset.theme || 'dark-magic';
  const isLight = () => root.dataset.base === 'light';
  const themeLabel = (id) => (THEMES.find((t) => t.id === id) || { label: id }).label;

  function applyTheme(id, { silent = false, persist = true } = {}) {
    root.dataset.theme = id;
    root.dataset.base = LIGHT.has(id) || (THEMES.find((t) => t.id === id) || {}).base === 'light' ? 'light' : 'dark';
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
    refreshShot();
    if (!silent) toast(`${themeLabel(id)}. Better already.`);
  }

  function applyAccent(id) {
    root.dataset.accent = id;
    store.set('gm-accent', id);
    $$('.accent').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === id)));
  }

  const ACCENTS = [
    ['purple', '#8C15F9'], ['jade', '#10c98f'], ['sapphire', '#4f8cf5'], ['lotus', '#f0559f'], ['crimson', '#f05656'],
  ];

  function renderThemePickers() {
    const wrap = $('#theme-picks');
    wrap.innerHTML = THEMES.map((t) => `
      <button class="swatch" role="radio" aria-checked="false" data-id="${esc(t.id)}" type="button">
        <span class="dots" aria-hidden="true" style="background:${esc(t.bg)}">${t.dots.map((d) => `<i style="background:${esc(d)}"></i>`).join('')}</span>
        <span>${esc(t.label.replace(/^Dark Magic ?/, '') || 'Dark Magic')}</span>
      </button>`).join('');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('.swatch');
      if (b) applyTheme(b.dataset.id);
    });
    const acc = $('#accent-picks');
    acc.innerHTML = '<span class="lbl">accent</span>' + ACCENTS.map(([id, c]) =>
      `<button class="accent" role="radio" aria-checked="false" aria-label="${id} accent" title="${id}" data-id="${id}" type="button" style="background:${c}"></button>`).join('');
    acc.addEventListener('click', (e) => {
      const b = e.target.closest('.accent');
      if (b) { applyAccent(b.dataset.id); toast(`${b.dataset.id} accent. Bold.`); }
    });
    applyAccent(root.dataset.accent || 'purple');
    applyTheme(themeId(), { silent: true, persist: false });
  }

  $('#theme-toggle-label').textContent = isLight() ? 'dark' : 'light';
  get('/data/themes.json').then((t) => { THEMES = t; renderThemePickers(); }).catch(() => {
    $('#theme-picks').innerHTML = '<p class="meta">The theme list went missing. The toggle in the header still works.</p>';
  });

  const toggle = $('#theme-toggle');
  toggle.addEventListener('click', () => applyTheme(isLight() ? 'dark-magic' : 'dark-magic-light'));
  // follow the OS only until you choose something yourself
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!store.get('gm-theme')) applyTheme(e.matches ? 'dark-magic-light' : 'dark-magic', { silent: true, persist: false });
  });

  /* ── screenshots: light base swaps in the light captures ── */
  const shot = $('#shot');
  const tabs = $$('#shots .tabs [role=tab]');
  let shotIdx = 0;
  const LIGHT_SHOTS = new Set(['app-graph', 'workspace', 'conflicts', 'diff', 'palette', 'home']);
  function refreshShot() {
    const t = tabs[shotIdx];
    if (!t || !shot) return;
    const name = t.dataset.shot;
    shot.src = `/assets/shots/${name}${isLight() && LIGHT_SHOTS.has(name) ? '-light' : ''}.webp`;
    shot.alt = `gitmoire ${t.dataset.name} screen`;
    tabs.forEach((b, i) => b.setAttribute('aria-selected', String(i === shotIdx)));
    $('#shot-idx').textContent = shotIdx + 1;
    $('#shot-name').textContent = t.dataset.name;
  }
  const setShot = (i) => { if (tabs[i]) { shotIdx = i; refreshShot(); } };
  tabs.forEach((t, i) => t.addEventListener('click', () => setShot(i)));

  /* ── omarchy gallery ── */
  const omaTabs = $$('#omarchy-tabs [role=tab]');
  omaTabs.forEach((t) => t.addEventListener('click', () => {
    omaTabs.forEach((b) => b.setAttribute('aria-selected', String(b === t)));
    const img = $('#omarchy-shot');
    img.src = `/assets/shots/omarchy-${t.dataset.omarchy}.webp`;
    img.alt = `gitmoire wearing the ${t.dataset.name} Omarchy theme.`;
    $('#omarchy-name').textContent = t.dataset.name.toLowerCase();
  }));

  /* ── per-project look: the app's real lane palettes ── */
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

  /* ── boot line: typed once per visit, skipped under reduced motion ── */
  const boot = $('#boot');
  if (boot && !reduce && !store.get('gm-boot')) {
    const lines = boot.innerHTML.split('\n');
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    boot.innerHTML = lines[0];
    let f = 0;
    const tick = setInterval(() => {
      if (f < 10) {
        boot.innerHTML = `${lines[0]}\n<span class="spin">${frames[f++ % frames.length]}</span> summoning your repositories…`;
      } else {
        boot.innerHTML = lines.join('\n');
        clearInterval(tick);
        store.set('gm-boot', '1');
      }
    }, 70);
  }

  /* ── platform, download button, install panels ── */
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

  const dl = $('#dl');
  const dlMeta = $('#dl-meta');
  let publishedTags = new Set();

  /* Only promise a download when a published release really has one. */
  fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const published = (Array.isArray(list) ? list : []).filter((r) => !r.draft && r.assets && r.assets.length);
      publishedTags = new Set(published.map((r) => r.tag_name));
      const rel = published[0];
      const asset = rel && rel.assets.find((a) => OS_ASSET[os].test(a.name));
      if (asset) {
        root.dataset.release = 'live';
        dl.textContent = `Download for ${OS_LABEL[os]}`;
        dl.href = asset.browser_download_url;
        dlMeta.textContent = `${rel.tag_name}, ${asset.name}, ${(asset.size / 1048576).toFixed(1)} MB. Free. Unsigned builds, so your OS asks once.`;
      } else if (rel) {
        root.dataset.release = 'live';
        dl.textContent = 'Download gitmoire';
        dl.href = rel.html_url;
      } else {
        dl.textContent = 'Watch for the first build';
        dlMeta.textContent = 'No public build yet. The first one lands in the releases repo: press Watch there and tick Releases to hear about it.';
      }
      renderReleaseNotice();
      markReleaseLinks();
    })
    .catch(() => { /* offline or rate-limited: static links still point somewhere real */ });

  /* ── releases ── */
  let RELEASES = [];
  function renderReleaseNotice() {
    const n = $('#rel-notice');
    if (!n) return;
    if (publishedTags.size) { n.hidden = true; return; }
    n.hidden = false;
    n.innerHTML = 'These versions are built in the private repo. <b>None are published for download yet.</b> Each one appears in the <a href="' + RELEASES_URL + '">releases repo</a> as it ships.';
  }
  function markReleaseLinks() {
    $$('.rel .dl-slot').forEach((el) => {
      const v = el.dataset.v;
      el.innerHTML = publishedTags.has(`v${v}`)
        ? `<a href="${RELEASES_URL}/tag/v${esc(v)}">Downloads for v${esc(v)}</a>`
        : '<span class="dim">Not published for download yet.</span>';
    });
  }

  get('/data/releases.json').then((rels) => {
    RELEASES = rels;
    $('#release-list').innerHTML = rels.map((r, i) => {
      const hl = r.highlights.map((h) =>
        `<li><b>${md(h.title)}.</b> <span class="t">${md(h.text)}</span></li>`).join('');
      const first = r.summary ? r.summary.split(/(?<=[.!?])\s/)[0] : (r.highlights[0] ? r.highlights[0].title : 'Maintenance release');
      const rest = r.summary && r.summary.length > first.length + 2 ? r.summary.slice(first.length).trim() : '';
      return `<details class="rel"${i === 0 ? ' open' : ''}>
        <summary>
          <span class="v">v${esc(r.version)}</span>
          <span class="d">${esc(r.date || '')}</span>
          <span class="s">${md(first)}${i === 0 ? '<span class="tag latest">latest</span>' : ''}</span>
          <span class="chev" aria-hidden="true"></span>
        </summary>
        <div class="rel-body">
          ${rest ? `<p class="lead">${md(rest)}</p>` : ''}
          ${hl ? `<ul class="hl">${hl}</ul>` : ''}
          <p class="links dl-slot" data-v="${esc(r.version)}"><span class="dim">Checking for a published build…</span></p>
        </div>
      </details>`;
    }).join('');
    $('#fork-note').hidden = false;
    renderReleaseNotice();
    markReleaseLinks();
  }).catch(() => {
    $('#release-list').innerHTML = `<p class="meta">The changelog went quiet. Every published release lives on the <a href="${RELEASES_URL}">releases page</a> anyway.</p>`;
  });

  /* ── roadmap ── */
  const bar = (n) => {
    const full = Math.round(n / 10);
    return `[${'█'.repeat(full)}<span class="e">${'░'.repeat(10 - full)}</span>]`;
  };
  const potion = (p) => `<div class="potion ${p.status === 'completed' ? 'done' : p.status}">
      <span>${md(p.feature)}</span>
      <span class="pbar" aria-hidden="true">${bar(p.progress)}</span>
      <span class="pct">${p.progress}%<span class="sr"> done</span></span></div>`;

  get('/data/roadmap.json').then((r) => {
    const by = (s) => r.potions.filter((p) => p.status === s);
    const active = by('active'), draft = by('draft'), done = by('completed');
    const later = r.groups.flatMap((g) => g.items.filter((i) => !i.shipped));
    const section = (title, count, body) =>
      `<div class="rm-group"><h3>${title} <span class="n">${count}</span></h3>${body}</div>`;
    let html = '';
    if (active.length) html += section('Brewing now', active.length, active.map(potion).join(''));
    if (draft.length) html += section('On the shelf, not started', draft.length, draft.map(potion).join(''));
    if (later.length) html += section('Later', later.length,
      `<ul class="tree rm-later">${later.map((i) => `<li>${md(i.text)}</li>`).join('')}</ul>`);
    if (r.nonGoals) html += `<p class="rm-no"><b>Not building:</b> ${md(r.nonGoals)}</p>`;
    html += `<div class="rm-group"><details class="shipped"><summary>Already drunk: ${done.length} potions shipped</summary>${done.map(potion).join('')}</details></div>`;
    $('#roadmap-body').innerHTML = html;
  }).catch(() => {
    $('#roadmap-body').innerHTML = '<p class="meta">The roadmap wandered off. A refresh usually coaxes it back.</p>';
  });

  /* ── shortcuts: the app's real key map ── */
  let KEYMAP = [];
  let keyGroup = 'All';
  let mac = os === 'mac';
  const NAMED = { enter: '⏎', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', home: 'Home', end: 'End', tab: 'Tab' };
  const cap = (c) => {
    const parts = c.split('+');
    const key = parts.pop() || '+';
    const caps = parts.map((m) => (m === 'mod' ? (mac ? '⌘' : 'Ctrl') : m === 'shift' ? (mac ? '⇧' : 'Shift') : m === 'alt' ? (mac ? '⌥' : 'Alt') : m === 'ctrl' ? (mac ? '⌃' : 'Ctrl') : m));
    caps.push(NAMED[key] || (key.length === 1 ? key.toUpperCase() : key));
    return caps;
  };
  const displayCaps = (arr) => arr.map((c) => (c === 'mod' ? (mac ? '⌘' : 'Ctrl') : c === '⇧' && !mac ? 'Shift' : c));
  const keycaps = (caps) => caps.map((c) => `<kbd>${esc(c)}</kbd>`).join('');

  function entryCombos(e) {
    if (e.display) return [displayCaps(e.display)];
    // drop shifted duplicates like mod+shift+{ that mirror mod+shift+[
    const seen = new Set();
    const out = [];
    for (const k of e.keys) {
      const caps = cap(k);
      const sig = caps.join('+');
      if (!seen.has(sig)) { seen.add(sig); out.push(caps); }
    }
    return e.id === 'repo.prevRepo' || e.id === 'repo.nextRepo' ? out.slice(0, 1) : out.slice(0, 2);
  }

  function renderKeys() {
    const q = $('#key-filter').value.trim().toLowerCase();
    const rows = KEYMAP.filter((e) => (keyGroup === 'All' || e.group === keyGroup) && (!q || e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)));
    const table = $('#key-table');
    if (!rows.length) {
      table.innerHTML = '<p class="key-empty">Nothing bound to that. Either it needs no shortcut or it deserves one. <a href="https://github.com/' + REPO + '/issues">Tell me</a>.</p>';
    } else {
      let html = '';
      let last = '';
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
      const b = e.target.closest('button');
      if (!b) return;
      keyGroup = b.dataset.g;
      $$('#key-groups button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderKeys();
    });
    $('#key-filter').addEventListener('input', renderKeys);
    $('#os-switch').addEventListener('click', () => { mac = !mac; renderKeys(); });
    renderKeys();
  }).catch(() => {
    $('#key-table').innerHTML = '<p class="key-empty">The key map didn\'t load. In the app, press <kbd>?</kbd> for the full list.</p>';
  });

  /* ── keyboard: the page practises what it preaches ── */
  const go = (sel) => {
    const el = $(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', sel);
  };
  let konami = 0;
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    const k = e.key.toLowerCase();

    if (!typing) {
      konami = k === KONAMI[konami] ? konami + 1 : (k === KONAMI[0] ? 1 : 0);
      if (konami === KONAMI.length) {
        konami = 0;
        applyTheme('dark-magic-frankenstein', { silent: true });
        toast('It\'s alive. It\'s ALIVE. (Frankenstein theme unlocked.)');
        return;
      }
    }
    if (typing) { if (k === 'escape') e.target.blur(); return; }

    if (/^[1-7]$/.test(k)) { setShot(Number(k) - 1); $('#shots').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
    if (k === 'l') { applyTheme(isLight() ? 'dark-magic' : 'dark-magic-light'); return; }
    if (k === '/') { e.preventDefault(); go('#keys'); setTimeout(() => $('#key-filter').focus(), reduce ? 0 : 450); return; }
    if (k === 'r') go('#releases');
    else if (k === 'm') go('#roadmap');
    else if (k === 'i') go('#install');
    else if (k === 't') go('#top');
    else if (k === 'd') { dl.focus(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  });

  /* ── witching hour: the app does this too, between midnight and 3am ── */
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 3) { const w = $('#witching'); if (w) w.hidden = false; }

  /* ── for the curious who open devtools ── */
  try {
    console.log('%cgitmoire', 'font:700 20px monospace;color:#a855f7;text-shadow:0 0 8px #8C15F9');
    console.log('Poking around? Same. Try the Konami code. Or press ? in the app.');
  } catch { /* console unavailable */ }
})();
