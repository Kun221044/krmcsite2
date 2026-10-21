/* KRMC site renderer: builds the whole page from the site content.
   Content comes from /api/content (saved in the admin) and falls back to /content/site.json. */
(function () {
  'use strict';

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = (v) => esc(v).replace(/\n/g, '<br>');
  const safeUrl = (u) => {
    u = String(u ?? '').trim();
    if (!u) return '';
    if (/^(https?:|mailto:|tel:|#|\/|\.{0,2}\/|[\w-]+(\/|\.|$))/i.test(u) && !/^\s*(javascript|data|vbscript):/i.test(u)) return u;
    return '';
  };
  const href = (u) => esc(safeUrl(u) || '#');
  const isExternal = (u) => /^https?:/i.test(u || '');
  const target = (u) => (isExternal(u) ? ' target="_blank" rel="noopener"' : '');
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
  const chev = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path d="M8 4l8 8-8 8"/></svg>';
  const caret = '<svg class="caret" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 3l4 4 4-4"/></svg>';
  const badge = (cls) => `<svg class="${cls}" viewBox="0 0 300 120"><use href="#ke-logo"/></svg>`;
  const logoImg = (src, cls, alt = '') =>
    src ? `<img class="${cls}" src="${esc(safeUrl(src))}" alt="${esc(alt)}" data-slot="${esc(src)}" onerror="this.hidden=true">` : '';
  const photo = (src, cls, grad, extra = '') =>
    `<div class="${cls}" data-img="${esc(safeUrl(src))}" style="background-image:${grad}"${extra}></div>`;
  const grads = ['linear-gradient(160deg,#555,#111)', 'linear-gradient(160deg,#6a1a1d,#111)', 'linear-gradient(160deg,#1b4d2a,#111)'];

  // Tiny, safe markdown: ## headings, - lists, **bold**, [links](url), blank-line paragraphs
  function md(text) {
    const inline = (s) =>
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${esc(safeUrl(u.replace(/&amp;/g, '&')) || '#')}"${target(u)}>${t}</a>`);
    return String(text || '')
      .replace(/\r/g, '')
      .split(/\n\s*\n/)
      .map((block) => {
        block = block.trim();
        if (!block) return '';
        if (/^#{2,3}\s/.test(block)) return `<h3>${inline(block.replace(/^#{2,3}\s+/, ''))}</h3>`;
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          const names = lines.every((l) => l.replace(/^\s*[-*]\s+/, '').length < 40);
          return `<ul${names ? ' class="names"' : ''}>` + lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
        }
        return `<p>${lines.map(inline).join('<br>')}</p>`;
      })
      .join('');
  }

  const youTubeId = (u) => {
    const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : '';
  };
  const kenyaTime = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s + (s.length <= 10 ? 'T00:00:00' : '') + '+03:00' : s);

  // ---------- sections ----------
  function renderHeader(c) {
    const h = c.header || {};
    const top = (h.topLinks || []).map((l) => `<a href="${href(l.link)}"${target(l.link)}>${esc(l.label)}</a>`).join('');
    const menu = (h.menu || [])
      .map((m) => {
        const sub = (m.submenu || []).filter((s) => s.label);
        return `<li><a href="${href(m.link)}"${target(m.link)}>${esc(m.label)}${sub.length ? ' ' + caret : ''}</a>` +
          (sub.length ? `<ul class="sub">${sub.map((s) => `<li><a href="${href(s.link)}"${target(s.link)}>${esc(s.label)}</a></li>`).join('')}</ul>` : '') +
          '</li>';
      })
      .join('');
    const mob = (h.topLinks || []).map((l) => `<li class="mob"><a href="${href(l.link)}">${esc(l.label)}</a></li>`).join('');
    $('#siteHeader').innerHTML = `<div class="wrap">
      <a href="#" class="logo" aria-label="Home">${logoImg(c.site?.logo, 'logo-img', 'KRMC')}${badge('logo-fallback')}</a>
      <div class="hdr-right">
        <div class="toplinks">${top}</div>
        <button class="burger" id="burger" aria-label="Toggle navigation"><span></span><span></span><span></span></button>
        <nav class="main" id="nav"><ul>${menu}${mob}</ul></nav>
      </div></div>`;
  }

  function renderHero(c) {
    const x = c.hero || {};
    const el = $('#hero');
    el.dataset.img = safeUrl(x.image);
    el.dataset.var = '--img';
    el.innerHTML = `<div class="wrap">
      ${x.brand ? `<div class="brand">${esc(x.brand)}<sup>®</sup></div>` : ''}
      <h1>${br(x.title)}</h1>
      ${x.subtitle ? `<h2>${br(x.subtitle)}</h2>` : ''}
      ${x.buttonLabel ? `<a class="pill" href="${href(x.buttonLink)}"${target(x.buttonLink)}>${esc(x.buttonLabel)}</a>` : ''}
    </div>`;
  }

  const trackSvg = `<svg class="track" viewBox="0 0 300 170" fill="none"><path d="M40 120 Q20 85 50 60 L110 30 Q140 15 160 40 L180 68 Q190 82 210 78 L250 60 Q280 50 280 88 L270 130 Q265 152 235 152 L80 152 Q55 152 40 120Z" stroke="#e43138" stroke-width="9" stroke-linejoin="round"/><path d="M150 145 v14" stroke="#fff" stroke-width="4"/><text x="158" y="168" fill="#fff" font-family="Archivo" font-stretch="125%" font-weight="700" font-size="10">START</text></svg>`;

  function renderEvents(c) {
    let evs = (c.events || []).filter((e) => e.title || e.tab);
    const el = $('#events');
    if (!evs.length) evs = [{ tab: 'KRMC Upcoming Events', championship: 'KRMC Calendar', title: 'No events at the moment', dates: 'Dates to be announced', buttons: [] }];
    const cols = Math.min(evs.length, 4);
    el.innerHTML =
      `<div class="tabs" role="tablist" style="--cols:${cols};--mcols:${Math.min(cols, 2)}">` +
      evs.map((e, i) => `<button class="tab${i ? '' : ' active'}" data-tab="ev${i}">${esc(e.tab || e.title)}</button>`).join('') +
      '</div>' +
      evs
        .map(
          (e, i) => `<div class="panel${i ? '' : ' active'}" id="ev${i}">
        <div class="map">
          <span class="mini-wrap">${logoImg(c.site?.logo, 'mini-logo logo-img')}${badge('mini-logo logo-fallback')}</span>
          ${logoImg(e.trackImage, 'track-img', 'Track map')}${trackSvg}
          ${e.venue ? `<div class="venue">${esc(e.venue)}</div>` : ''}
        </div>
        <div class="ev">
          <h6>${esc(e.championship)}</h6>
          <h3>${esc(e.title)}</h3>
          <div class="date">${esc(e.dates)}</div>
          <div class="ev-row"><div class="ryw">Race Your Way<br>Lights Out In:</div>
            ${e.start ? `<div class="cd" data-date="${esc(kenyaTime(e.start))}"></div>` : '<div class="cd tba"><b>TBA</b></div>'}</div>
          ${(e.buttons || []).length ? `<div class="ev-links">${e.buttons.filter((b) => b.label).map((b) => `<a href="${href(b.link)}"${target(b.link)}>${esc(b.label)} ${arrow}</a>`).join('')}</div>` : ''}
        </div></div>`
        )
        .join('');
  }

  function renderCalendar(c) {
    const x = c.calendar || {};
    const rows = (x.rows || []).filter((r) => r.event || r.dates);
    $('#calendar').innerHTML = `<div class="wrap">
      <div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2>
      <div class="cal">
        <div class="cal-row head"><span>Date</span><span>Event Description</span><span>Location</span><span>Status</span></div>
        ${rows.map((r) => `<div class="cal-row" data-end="${esc(r.lastDay || '')}"><span>${esc(r.dates)}</span><span>${esc(r.event)}</span><span>${esc(r.location)}</span><span class="st"></span></div>`).join('')}
      </div></div>`;
  }

  let ARTICLES = [];
  function renderNews(c) {
    const x = c.news || {};
    ARTICLES = (x.articles || []).filter((a) => a.title);
    $('#news').innerHTML = `<div class="wrap">
      <div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2><p class="sec-p">${br(x.intro)}</p>
      <div class="news">${ARTICLES.map(
        (a, i) => `<a href="#article-${i + 1}" data-article="${i}">${photo(a.image, 'ph', 'linear-gradient(135deg,' + ['#bb0000,#3a0000', '#006600,#002200', '#333,#000'][i % 3] + ')')}
        <div class="nmeta">${esc([a.date, a.tag].filter(Boolean).join(' · '))}</div><h4>${esc(a.title)}</h4></a>`
      ).join('')}</div></div>`;
  }

  function openArticle(i) {
    const a = ARTICLES[i];
    if (!a) return;
    const d = $('#articleDialog');
    const hero = $('#artHero');
    hero.style.backgroundImage = 'linear-gradient(135deg,#333,#000)';
    hero.dataset.img = safeUrl(a.image);
    loadPhoto(hero);
    $('#artBody').innerHTML = `<div class="nmeta">${esc([a.author, a.date].filter(Boolean).join(' · '))}</div><h2>${esc(a.title)}</h2>${md(a.body)}`;
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    history.replaceState(null, '', '#article-' + (i + 1));
  }

  function renderClasses(c) {
    const x = c.classes || {};
    $('#classes').innerHTML = `<div class="wrap">
      <div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2><p class="sec-p">${br(x.intro)}</p>
      <div class="classes">${(x.items || []).filter((k) => k.name).map((k, i) => `<a class="cls" href="${href(k.link)}"${target(k.link)}>${photo(k.image, 'ph', grads[i % 3])}<h5>${esc(k.name)}</h5><span>${esc(k.ages)}</span></a>`).join('')}</div></div>`;
  }

  function renderVideo(c) {
    const x = c.video || {};
    const id = youTubeId(x.youtubeLink);
    $('#video').innerHTML = `<div class="wrap"><h2 class="sec-h">${esc(x.title)}</h2><p class="sec-p">${br(x.intro)}</p>
      <div class="video">${id
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(x.title || 'Video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        : '<div class="play"><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div>'}</div></div>`;
  }

  function renderAbout(c) {
    const x = c.about || {};
    $('#about').innerHTML = `<div class="wrap about"><div>
      <div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2>
      ${(x.paragraphs || []).filter(Boolean).map((p) => `<p>${br(p)}</p>`).join('')}
      ${x.linkLabel ? `<a class="textlink" href="${href(x.link)}"${target(x.link)}>${esc(x.linkLabel)} ${chev}</a>` : ''}
      </div>${photo(x.image, 'ph', 'linear-gradient(135deg,#e43138,#3a0a0c)')}</div>`;
  }

  function renderGettingStarted(c) {
    const x = c.gettingStarted || {};
    $('#getting-started').innerHTML = `<div class="wrap"><div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2>
      <div class="gs">${(x.cards || []).map((k) => `<div class="gs-card"><h4>${esc(k.title)}</h4>${(k.paragraphs || []).filter(Boolean).map((p) => `<p>${br(p)}</p>`).join('')}</div>`).join('')}</div></div>`;
  }

  function renderLessons(c) {
    const x = c.lessons || {};
    const items = (x.items || []).filter((k) => k.title);
    $('#lessons').innerHTML = `<div class="wrap"><div class="kicker">${esc(x.kicker)}</div><h2 class="sec-h">${esc(x.title)}</h2><p class="sec-p">${br(x.intro)}</p>
      <div class="lessons" style="--n:${Math.min(items.length, 5) || 1}">${items.map((k, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b><h5>${esc(k.title)}</h5><p>${br(k.text)}</p></div>`).join('')}</div></div>`;
  }

  function renderStrip(c) {
    const tiles = c.photoStrip || [];
    const g = ['linear-gradient(135deg,#222,#000)', 'linear-gradient(135deg,#bb0000,#400)', 'linear-gradient(135deg,#006600,#020)'];
    $('#photoStrip').innerHTML = tiles
      .map((t, i) => (safeUrl(t.link) ? `<a href="${href(t.link)}"${target(t.link)}>${photo(t.image, 'ph', g[i % 3])}</a>` : photo(t.image, 'ph', g[i % 3])))
      .join('');
    $('#photoStrip').style.display = tiles.length ? '' : 'none';
  }

  function renderAppBar(c) {
    const x = c.appBar || {};
    const soc = [
      ['facebookLink', 'Facebook', '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8.5c0-.3.2-.5.5-.5z"/></svg>'],
      ['instagramLink', 'Instagram', '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>'],
      ['youtubeLink', 'YouTube', '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M22 8.2c-.2-1.5-1-2.6-2.6-2.8C17 5 12 5 12 5s-5 0-7.4.4C3 5.6 2.2 6.7 2 8.2 1.8 9.5 1.8 12 1.8 12s0 2.5.2 3.8c.2 1.5 1 2.6 2.6 2.8C7 19 12 19 12 19s5 0 7.4-.4c1.6-.2 2.4-1.3 2.6-2.8.2-1.3.2-3.8.2-3.8s0-2.5-.2-3.8zM10 15V9l5.2 3z"/></svg>']
    ].filter(([k]) => safeUrl(x[k]));
    $('#appBar').innerHTML = `<div class="wrap"><div class="left">
      <div class="lbl">${br(x.label)}</div>
      ${x.appStoreLink ? `<a class="store" href="${href(x.appStoreLink)}" target="_blank" rel="noopener"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.3 3-2.5.9-1.4 1.3-2.7 1.3-2.8 0 0-2.3-.9-2.3-4.2zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg><div><small>Download on the</small><b>App Store</b></div></a>` : ''}
      ${x.googlePlayLink ? `<a class="store" href="${href(x.googlePlayLink)}" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#34a853" d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1z"/><path fill="#fbbc04" d="m17.1 15.3-3.3-3.3 3.3-3.3 3.8 2.2c1 .6 1 1.6 0 2.2z"/><path fill="#ea4335" d="M13.8 12 3.6 22.2c.3.2.8.2 1.3-.1l12.2-6.8z"/><path fill="#4285f4" d="M13.8 12 17.1 8.7 4.9 1.9c-.5-.3-1-.3-1.3-.1z"/></svg><div><small>GET IT ON</small><b>Google Play</b></div></a>` : ''}
      </div><div class="soc">${soc.map(([k, n, ic]) => `<a href="${href(x[k])}" target="_blank" rel="noopener" aria-label="${n}">${ic}</a>`).join('')}</div></div>`;
  }

  function renderPartners(c) {
    const x = c.partners || {};
    const items = (x.items || []).filter((p) => p.logo || p.name);
    $('#partners').innerHTML = items.length
      ? `<div class="wrap"><h3>${esc(x.title)}</h3><div class="prow logos">${items
          .map((p) => `<a class="plogo img" href="${href(p.link)}"${target(p.link)}>${p.logo ? logoImg(p.logo, '', p.name) : esc(p.name)}</a>`)
          .join('')}</div></div>`
      : '';
  }

  function renderFooter(c) {
    const x = c.footer || {};
    const cols = (x.columns || []).filter((col) => (col.links || []).length);
    $('#contact').innerHTML = `<div class="wrap"><div class="cols" style="--fcols:${Math.max(cols.length, 1)}">${cols
      .map((col) => `<ul>${col.links.filter((l) => l.label).map((l) => (safeUrl(l.link) ? `<li><a href="${href(l.link)}"${target(l.link)}>${esc(l.label)}</a></li>` : `<li><span>${esc(l.label)}</span></li>`)).join('')}</ul>`)
      .join('')}</div><div class="copy">${esc(x.copyright)}</div></div>`;
  }

  function renderHead(c) {
    const s = c.site || {};
    if (s.title) document.title = s.title;
    const set = (sel, attr, v) => { const m = $(sel); if (m && v) m.setAttribute(attr, v); };
    set('meta[name="description"]', 'content', s.description);
    set('meta[property="og:title"]', 'content', s.title);
    set('meta[property="og:description"]', 'content', s.description);
    if (s.shareImage) set('meta[property="og:image"]', 'content', new URL(safeUrl(s.shareImage) || '/', location.href).href);
  }

  // ---------- images: load each photo; keep the colour placeholder if it fails ----------
  const SLOTS = new URLSearchParams(location.search).has('slots');
  const probe = (src) => new Promise((r) => { if (!src) return r(false); const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; });
  async function loadPhoto(el) {
    const src = el.dataset.img;
    const ok = await probe(src);
    if (ok) {
      if (el.dataset.var) el.style.setProperty(el.dataset.var, `url("${src.replace(/"/g, '%22')}")`);
      else el.style.backgroundImage = `url("${src.replace(/"/g, '%22')}"),` + el.style.backgroundImage;
    }
    el.dataset.label = (src || '(no image set)') + (ok ? ' ✓' : ' — missing');
    el.classList.toggle('ok', ok);
    return [src || '(empty)', ok];
  }

  function wire() {
    // mobile menu
    const burger = $('#burger'), nav = $('#nav');
    burger.addEventListener('click', () => { nav.classList.toggle('open'); burger.classList.toggle('x'); });
    nav.querySelectorAll('a[href^="#"]:not([href="#"])').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); burger.classList.remove('x'); }));
    // event tabs
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
      document.querySelectorAll('.tab,.panel').forEach((x) => x.classList.remove('active'));
      t.classList.add('active'); document.getElementById(t.dataset.tab).classList.add('active');
    }));
    // articles
    document.querySelectorAll('[data-article]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openArticle(+a.dataset.article); }));
    const d = $('#articleDialog');
    d.querySelector('.close').onclick = () => d.close();
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));
    const m = location.hash.match(/^#article-(\d+)$/);
    if (m) openArticle(+m[1] - 1);
  }

  function tick() {
    const pad = (n) => String(n).padStart(2, '0');
    document.querySelectorAll('.cd[data-date]').forEach((el) => {
      const d = Math.max(0, new Date(el.dataset.date) - Date.now());
      const v = [Math.floor(d / 864e5), Math.floor(d / 36e5) % 24, Math.floor(d / 6e4) % 60, Math.floor(d / 1e3) % 60];
      el.innerHTML = v.map((n, i) => `<b>${pad(n)}</b><small>${['Days', 'Hrs', 'Min', 'Sec'][i]}</small>`).join('');
    });
  }

  function calendarStatus() {
    let next = false;
    document.querySelectorAll('.cal-row[data-end]').forEach((r) => {
      const st = r.querySelector('.st');
      if (!r.dataset.end) { st.innerHTML = ''; return; }
      const end = new Date(kenyaTime(r.dataset.end + 'T23:59:59'));
      if (end < Date.now()) { r.classList.add('past'); st.innerHTML = '<b class="done">Completed</b>'; }
      else if (!next) { next = true; st.innerHTML = '<b class="next">Next Up</b>'; }
      else st.innerHTML = '<b class="up">Upcoming</b>';
    });
  }

  async function slotsPanel(results) {
    if (!SLOTS) return;
    document.body.classList.add('slots');
    const logos = [...document.querySelectorAll('img[data-slot]')].map(async (i) => [i.dataset.slot, await probe(i.getAttribute('src'))]);
    const rows = [...results, ...(await Promise.all(logos))];
    const seen = new Set();
    const list = rows.filter(([f]) => !seen.has(f) && seen.add(f));
    const p = document.createElement('div');
    p.id = 'slotPanel';
    p.innerHTML = `<b>IMAGE SLOTS</b> ${list.filter((r) => r[1]).length}/${list.length} loading<br>` +
      list.map(([f, ok]) => `<span class="${ok ? 'y' : ''}">${ok ? '✓' : '✗'}</span> ${esc(f)}`).join('<br>');
    document.body.appendChild(p);
  }

  // ---------- boot ----------
  async function getContent() {
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch (e) { /* functions not available (e.g. opened locally) */ }
    const r = await fetch('/content/site.json', { cache: 'no-store' });
    return r.json();
  }

  getContent()
    .then(async (c) => {
      renderHead(c); renderHeader(c); renderHero(c); renderEvents(c); renderCalendar(c); renderNews(c);
      renderClasses(c); renderVideo(c); renderAbout(c); renderGettingStarted(c); renderLessons(c);
      renderStrip(c); renderAppBar(c); renderPartners(c); renderFooter(c);
      wire(); tick(); setInterval(tick, 1000); calendarStatus();
      document.body.classList.add('ready');
      if (location.hash && !location.hash.startsWith('#article-')) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
      const results = await Promise.all([...document.querySelectorAll('[data-img]')].map(loadPhoto));
      slotsPanel(results);
    })
    .catch((e) => { console.error(e); document.body.insertAdjacentHTML('afterbegin', '<p style="padding:20px">Sorry, the site content could not be loaded. Please refresh.</p>'); });

  const tt = $('#toTop');
  addEventListener('scroll', () => tt.classList.toggle('show', scrollY > 600));
})();
