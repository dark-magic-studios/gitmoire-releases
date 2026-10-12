/* gitmoire landing analytics: site-wide GA4 event layer on top of gtag.js.
 *
 * What it tracks (all anonymous, no PII):
 *  - file_download  — any download click, with an `os` param (macos/windows/linux/unknown)
 *                     so GA4 Reports > Engagement > Events answers "downloads per OS".
 *  - click (outbound) — every external link, with link_url + link_domain.
 *  - cta_click      — hero CTA buttons specifically.
 *  - view_section   — each content section scrolled into view (once per page load).
 *  - select_os_tab  — install OS tab switches (download intent per OS, even pre-release).
 *  - install_command_copy — copy of an install snippet, with the visible OS panel.
 *  - select_theme / select_accent / view_screenshot / select_omarchy /
 *    select_palette / toggle_release — page interactions.
 *
 * Everything is guarded: ad blockers, missing gtag, and Do-Not-Track just
 * mean events are dropped silently. The page works identically either way.
 */
(() => {
  'use strict';

  const DNT = navigator.doNotTrack === '1'
    || window.doNotTrack === '1'
    || navigator.msDoNotTrack === '1';

  const send = (name, params) => {
    try {
      if (DNT) return;
      if (typeof window.gtag !== 'function') return;
      window.gtag('event', name, { transport_type: 'beacon', ...params });
    } catch { /* analytics must never break the page */ }
  };

  const text = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);

  /* ── OS inference for download counting ────────────────────────────── */

  // Ordered: first match wins. Covers direct asset URLs, the gh CLI
  // patterns in the install panels, and the hero button label.
  const OS_PATTERNS = [
    [/\.dmg($|[?#])/i, 'macos'],
    [/(setup\.exe|\.msi)($|[?#])/i, 'windows'],
    [/\.AppImage($|[?#])/i, 'linux'],
    [/\.(deb|rpm)($|[?#])/i, 'linux'],
    [/macos|darwin|\.dmg/i, 'macos'],
    [/windows|win64|x64-setup\.exe/i, 'windows'],
    [/linux|appimage/i, 'linux'],
  ];

  const osFromString = (s) => {
    if (!s) return null;
    for (const [re, os] of OS_PATTERNS) if (re.test(s)) return os;
    return null;
  };

  const activeInstallOs = () => {
    const active = document.querySelector('.os [role=tab][aria-selected="true"]');
    const map = { mac: 'macos', win: 'windows', linux: 'linux' };
    return (active && map[active.dataset.os]) || 'unknown';
  };

  const fileName = (url) => {
    try {
      const path = new URL(url, location.href).pathname;
      const last = path.split('/').pop();
      return (last || '').slice(0, 160) || '(releases page)';
    } catch {
      return '(unknown)';
    }
  };

  const isDownload = (href, el) => {
    if (!href) return false;
    if (el.id === 'dl') return true; // hero download button (href is dynamic)
    if (el.closest('.dl-slot')) return true; // per-release download links
    return /\.(dmg|exe|msi|AppImage|deb|rpm|zip|tar\.gz)($|[?#])/i.test(href);
  };

  /* ── click tracking (delegated: covers JS-rendered links too) ──────── */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el) return;

    // 1. Downloads — highest value, check first.
    if (el.tagName === 'A' && isDownload(el.href, el)) {
      const href = el.href;
      const os = osFromString(href + ' ' + text(el)) || activeInstallOs();
      const version = (href.match(/\/tag\/(v?[\w.-]+)/) || [])[1] || undefined;
      send('file_download', {
        os,
        file_name: fileName(href),
        link_url: href.slice(0, 500),
        link_text: text(el) || '(download button)',
        ...(version ? { version } : {}),
      });
      // Also a dedicated event so "downloads per OS" needs no funnel setup.
      send('download', { os, link_text: text(el) || '(download button)' });
      return;
    }

    // 2. Outbound links (incl. releases repo, omarchy.org, footer).
    if (el.tagName === 'A' && /^https?:/i.test(el.href)) {
      let domain = '';
      try { domain = new URL(el.href).hostname; } catch { /* keep empty */ }
      if (domain && domain !== location.hostname) {
        send('click', {
          link_url: el.href.slice(0, 500),
          link_domain: domain,
          link_text: text(el) || '(image link)',
          outbound: true,
        });
        // Hero CTAs get their own event for funnel analysis.
        if (el.closest('.cta')) send('cta_click', { link_text: text(el), link_url: el.href.slice(0, 500) });
        return;
      }
      // Internal anchor / same-site nav worth naming.
      if (el.closest('.cta')) send('cta_click', { link_text: text(el), link_url: el.href.slice(0, 500) });
      return;
    }

    // 3. UI interactions.
    if (el.closest('.os [role=tab]')) {
      const map = { mac: 'macos', win: 'windows', linux: 'linux' };
      send('select_os_tab', { os: map[el.dataset.os] || el.dataset.os });
      return;
    }
    if (el.id === 'theme-toggle') { send('toggle_theme_mode', {}); return; }
    const swatch = el.closest('.swatch');
    if (swatch) { send('select_theme', { theme_id: swatch.dataset.id }); return; }
    const accent = el.closest('.accent');
    if (accent) { send('select_accent', { accent: accent.dataset.id }); return; }
    const shot = el.closest('#shots .tabs [role=tab]');
    if (shot) { send('view_screenshot', { shot: shot.dataset.shot }); return; }
    const oma = el.closest('#omarchy-tabs [role=tab]');
    if (oma) { send('select_omarchy', { theme: oma.dataset.omarchy }); return; }
    const lane = el.closest('#lane-tabs button');
    if (lane) { send('select_palette', { palette: lane.dataset.id }); return; }
    const keyGroup = el.closest('#key-groups button');
    if (keyGroup) { send('select_key_group', { group: keyGroup.dataset.g }); return; }
    if (el.id === 'os-switch') { send('toggle_key_os', {}); return; }
  });

  // Release <details> expand/collapse (toggle event, not click).
  document.addEventListener('toggle', (e) => {
    const details = e.target.closest && e.target.closest('details.rel');
    if (!details) return;
    if (details.open) {
      const v = (details.querySelector('.v') && text(details.querySelector('.v'))) || 'unknown';
      send('toggle_release', { version: v });
    }
  }, true);

  // Install snippet copies — strong "would install" signal per OS.
  document.addEventListener('copy', () => {
    const sel = window.getSelection();
    const anchor = sel && sel.anchorNode && sel.anchorNode.parentElement;
    const panel = anchor && anchor.closest && anchor.closest('.install');
    if (panel) send('install_command_copy', { os: activeInstallOs() });
  });

  /* ── section views (once per section per page load) ────────────────── */

  const seen = new Set();
  const sections = document.querySelectorAll('main section[id], main section [id]');
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id || (entry.target.closest('section') || {}).id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        send('view_section', { section: id });
        io.unobserve(entry.target);
      }
    }, { threshold: 0.4 });
    sections.forEach((s) => io.observe(s));
  }

  /* ── JS error breadcrumb (rate-limited, message only) ──────────────── */
  let errCount = 0;
  window.addEventListener('error', (e) => {
    if (errCount++ > 3) return;
    send('exception', {
      description: String((e && e.message) || 'unknown').slice(0, 150),
      fatal: false,
    });
  });
})();
