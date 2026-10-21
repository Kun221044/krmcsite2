/* KRMC admin editor. Every field in the site content is editable here.
   Saves go to /api/content (Netlify Blobs) and are live immediately – no redeploy. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- sections (sidebar) ----------
  const SECTIONS = [
    ['site', 'Site & logo', 'Browser title, search/social description, main logo and link-preview image.'],
    ['header', 'Header & menu', 'Top-right links and the main menu bar (with optional drop-down items).'],
    ['hero', 'Hero banner', 'The big banner at the top of the page.'],
    ['events', 'Upcoming events', 'The black event panels with live countdowns. Each event gets its own tab. Remove past events here.'],
    ['calendar', 'Calendar', 'The season calendar table. Status (Completed / Next Up / Upcoming) updates automatically from the last day.'],
    ['news', 'News & articles', 'News cards and the full article text that opens when a card is clicked. New articles are added at the top.'],
    ['classes', 'Classes', 'The square championship class tiles.'],
    ['video', 'Video', 'Paste a YouTube link to show the video (a normal watch link, youtu.be link or live link all work).'],
    ['about', 'About', 'The "About the KRMC" section.'],
    ['gettingStarted', 'Getting started', 'The two "Getting started" cards.'],
    ['lessons', 'Life lessons', 'The numbered black cards.'],
    ['photoStrip', 'Photo strip', 'Square photos above the app bar. Add a link to make a photo clickable (e.g. an Instagram post).'],
    ['appBar', 'App & social links', 'Rotax app store buttons and the Facebook / Instagram / YouTube icons. Leave a social link empty to hide that icon.'],
    ['partners', 'Partners', 'Partner and sponsor logos. Logos sit on black, so light or white artwork works best.'],
    ['footer', 'Footer', 'Footer link columns, contact details and copyright line. Leave a link empty to show plain text.'],
    ['__history', 'History & restore', 'Every save keeps a copy of the previous version (last 30).']
  ];

  // ---------- field labels, help and types ----------
  const LABELS = {
    tab: 'Tab label', championship: 'Small heading', title: 'Title', dates: 'Dates (as shown)', start: 'Countdown to (Kenya time)', venue: 'Venue',
    trackImage: 'Track map image', buttons: 'Buttons', label: 'Label', link: 'Link', submenu: 'Drop-down items', topLinks: 'Top-right links', menu: 'Main menu',
    image: 'Image', logo: 'Logo', shareImage: 'Link-preview image', description: 'Description', brand: 'Brand word', subtitle: 'Subtitle',
    buttonLabel: 'Button label', buttonLink: 'Button link', kicker: 'Small heading above title', intro: 'Intro text', rows: 'Rows', event: 'Event description',
    location: 'Location', lastDay: 'Last day of event', articles: 'Articles', date: 'Date (as shown)', tag: 'Tag', author: 'Author', body: 'Article text',
    items: 'Items', name: 'Name', ages: 'Ages', youtubeLink: 'YouTube link', paragraphs: 'Paragraphs', linkLabel: 'Link label', cards: 'Cards', text: 'Text',
    appStoreLink: 'App Store link', googlePlayLink: 'Google Play link', facebookLink: 'Facebook link', instagramLink: 'Instagram link',
    columns: 'Columns', links: 'Links', copyright: 'Copyright line'
  };
  const HELP = {
    'site.logo': 'Transparent PNG works best. Leave empty to show the built-in Kenya badge.',
    'site.shareImage': 'Shown when the site link is shared on WhatsApp, Facebook or X. Best size 1200 × 630.',
    'hero.title': 'Press Enter for a line break.',
    'hero.image': 'Wide photo, at least 2000 px across. The left side is darkened so text stays readable.',
    'events.*.start': 'The countdown counts down to this moment. Leave empty to show "TBA".',
    'events.*.trackImage': 'Optional. Leave empty to show the red outline drawing.',
    'calendar.rows.*.lastDay': 'Used to mark the row Completed after this date.',
    'news.articles.*.body': 'md',
    'news.articles.*.image': 'Landscape photo, about 1400 × 880.',
    'classes.items.*.image': 'Square photo, about 800 × 800.',
    'photoStrip.*.image': 'Square photo, about 800 × 800.',
    'partners.items.*.logo': 'PNG with a transparent background. White or light artwork shows best on black.',
    'appBar.label': 'Press Enter for a line break.'
  };
  const IMAGE_KEYS = new Set(['image', 'logo', 'trackImage', 'shareImage']);
  const LONG_KEYS = new Set(['description', 'intro', 'text', 'title@hero', 'label@appBar', 'subtitle']);
  const IMG_MAX = { logo: 800, trackImage: 900, 'partners.items.*.logo': 600 };
  const ADD_TO_TOP = new Set(['news.articles']);

  // Blank templates for "Add" when a list is empty
  const TEMPLATES = {
    'header.topLinks': { label: '', link: '' },
    'header.menu': { label: '', link: '', submenu: [] },
    'header.menu.*.submenu': { label: '', link: '' },
    events: { tab: '', championship: '', title: '', dates: '', start: '', venue: '', trackImage: '', buttons: [{ label: 'Enter Now', link: '' }, { label: 'Event Info', link: '#calendar' }] },
    'events.*.buttons': { label: '', link: '' },
    'calendar.rows': { dates: '', event: '', location: '', lastDay: '' },
    'news.articles': { title: '', date: '', tag: '', author: '', image: '', body: '' },
    'classes.items': { name: '', ages: '', image: '', link: '' },
    'about.paragraphs': '',
    'gettingStarted.cards': { title: '', paragraphs: [''] },
    'gettingStarted.cards.*.paragraphs': '',
    'lessons.items': { title: '', text: '' },
    photoStrip: { image: '', link: '' },
    'partners.items': { name: '', logo: '', link: '' },
    'footer.columns': { links: [{ label: '', link: '' }] },
    'footer.columns.*.links': { label: '', link: '' }
  };

  // ---------- state ----------
  let content = null;
  let saved = '';
  let current = 'site';
  const open = new Set();
  let mediaTarget = null;

  const sig = (path) => path.map((p) => (typeof p === 'number' ? '*' : p)).join('.');
  const pkey = (path) => path.join('.');
  const getAt = (path) => path.reduce((o, k) => (o == null ? o : o[k]), content);
  const setAt = (path, v) => { const last = path[path.length - 1]; getAt(path.slice(0, -1))[last] = v; };
  const humanize = (k) => LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  const blank = (v) => (Array.isArray(v) ? [] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : typeof v === 'string' ? '' : v);
  const isDirty = () => JSON.stringify(content) !== saved;

  // ---------- api ----------
  async function api(url, opts = {}) {
    const r = await fetch(url, { credentials: 'same-origin', ...opts });
    let data = {};
    try { data = await r.json(); } catch { /* not json */ }
    if (r.status === 401 && !url.includes('/api/login')) { showLogin('Your session has ended. Please sign in again.'); throw new Error('auth'); }
    if (!r.ok) throw new Error(data.error || 'Something went wrong (' + r.status + ').');
    return data;
  }

  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), err ? 5000 : 2600);
  }

  function setStatus() {
    const st = $('#status'), d = isDirty();
    st.textContent = d ? '● Unsaved changes' : '✓ All changes published';
    st.className = 'status ' + (d ? 'dirty' : 'ok');
    $('#saveBtn').disabled = !d;
  }

  // ---------- login ----------
  function showLogin(msg) {
    $('#appView').hidden = true; $('#loginView').hidden = false;
    $('#loginMsg').textContent = msg || '';
    setTimeout(() => $('#pw').focus(), 50);
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
    try {
      await api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
      $('#pw').value = '';
      await startApp();
    } catch (err) { $('#loginMsg').textContent = err.message; }
    btn.disabled = false;
  });
  $('#logoutBtn').addEventListener('click', async () => {
    if (isDirty() && !confirm('You have unsaved changes. Log out anyway?')) return;
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    content = null; showLogin('You have been logged out.');
  });

  // ---------- loading & saving ----------
  async function loadContent() {
    let r = await fetch('/api/content', { cache: 'no-store' });
    if (!r.ok) r = await fetch('/content/site.json', { cache: 'no-store' });
    content = await r.json();
    saved = JSON.stringify(content);
  }
  async function save() {
    if (!isDirty()) return;
    const bad = document.querySelector('input.bad');
    if (bad) { bad.focus(); toast('Please fix the highlighted link first.', true); return; }
    $('#saveBtn').disabled = true; $('#status').textContent = 'Publishing…';
    try {
      await api('/api/content', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(content) });
      saved = JSON.stringify(content);
      toast('Published. Your changes are live.');
    } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    setStatus();
  }
  $('#saveBtn').addEventListener('click', save);
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && content) { e.preventDefault(); save(); } });
  addEventListener('beforeunload', (e) => { if (content && isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- sidebar ----------
  function renderNav() {
    $('#sidebar').innerHTML = SECTIONS.map(([k, n]) => (k === '__history' ? '<div class="sep"></div>' : '') + `<button data-s="${k}" class="${k === current ? 'active' : ''}">${esc(n)}</button>`).join('');
    $('#sectionSelect').innerHTML = SECTIONS.map(([k, n]) => `<option value="${k}"${k === current ? ' selected' : ''}>${esc(n)}</option>`).join('');
  }
  $('#sidebar').addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b) go(b.dataset.s); });
  $('#sectionSelect').addEventListener('change', (e) => go(e.target.value));
  function go(k) { current = k; renderNav(); renderEditor(); scrollTo(0, 0); }

  // ---------- editor ----------
  function renderEditor() {
    const [, name, lead] = SECTIONS.find((s) => s[0] === current);
    const ed = $('#editor');
    if (current === '__history') return renderHistory(ed, name, lead);
    if (content[current] === undefined) content[current] = Array.isArray(TEMPLATES[current]) ? [] : {};
    ed.innerHTML = `<h2>${esc(name)}</h2><p class="lead">${esc(lead)}</p>` + node([current], content[current], true);
    autosize(ed);
  }

  function node(path, v, top) {
    if (Array.isArray(v)) return listNode(path, v);
    if (v && typeof v === 'object') {
      const inner = Object.keys(v).map((k) => node(path.concat(k), v[k])).join('');
      return top ? inner : inner;
    }
    return fieldNode(path, v);
  }

  function helpFor(path) {
    return HELP[sig(path)] || HELP[pkey(path)] || '';
  }

  function fieldNode(path, v) {
    const key = path[path.length - 1];
    const id = 'f_' + pkey(path).replace(/[^\w]/g, '_');
    const help = helpFor(path);
    const helpHtml = help && help !== 'md' ? `<div class="help">${esc(help)}</div>` : '';
    const label = humanize(key);
    const val = v ?? '';
    if (IMAGE_KEYS.has(key)) return imageField(path, id, label, val, help);
    if (key === 'body') {
      return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" class="big" data-path="${pkey(path)}">${esc(val)}</textarea>
        <div class="md-help">Leave a blank line between paragraphs. <code>## Heading</code> for a sub-heading · <code>- item</code> for a bullet list · <code>**bold**</code> · <code>[link text](https://…)</code></div></div>`;
    }
    if (key === 'start') return `<div class="field"><label for="${id}">${label}</label><input type="datetime-local" id="${id}" data-path="${pkey(path)}" value="${esc(val)}">${helpHtml}</div>`;
    if (key === 'lastDay') return `<div class="field"><label for="${id}">${label}</label><input type="date" id="${id}" data-path="${pkey(path)}" value="${esc(val)}">${helpHtml}</div>`;
    const isLink = key === 'link' || /Link$/.test(key);
    const long = String(val).includes('\n') || String(val).length > 90 || LONG_KEYS.has(key) || LONG_KEYS.has(key + '@' + path[0]);
    if (long && !isLink) return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" rows="2" data-path="${pkey(path)}">${esc(val)}</textarea>${helpHtml}</div>`;
    const ph = isLink ? ' placeholder="https://…  or  #section  or  mailto:…"' : '';
    const linkHelp = isLink && !help ? '<div class="help">Full web address (https://…), a section on this page (#calendar, #news, #contact…), mailto: or tel:.</div>' : helpHtml;
    return `<div class="field"><label for="${id}">${label}</label><input type="text" id="${id}" data-path="${pkey(path)}" value="${esc(val)}"${ph}${isLink ? ' data-link' : ''}>${linkHelp}</div>`;
  }

  function imageField(path, id, label, val, help) {
    const darkBg = /logo/i.test(path[path.length - 1]) && path[0] === 'partners';
    return `<div class="field"><label for="${id}">${label}</label>
      <div class="imgf">
        <div class="thumb${val ? ' has' : ''}${darkBg ? ' dark' : ''}" data-thumb="${pkey(path)}" style="${val ? `background-image:url('${esc(val)}')` : ''}">${val ? '' : 'No image'}</div>
        <div class="ctrl">
          <input type="text" id="${id}" data-path="${pkey(path)}" data-img value="${esc(val)}" placeholder="Upload, choose from library, or paste an image address">
          <div class="row">
            <label class="btn primary small">Upload<input type="file" accept="image/*" hidden data-upload="${pkey(path)}"></label>
            <button type="button" class="btn ghost small" data-library="${pkey(path)}">Library</button>
            ${val ? `<button type="button" class="btn ghost small" data-clear="${pkey(path)}">Remove</button>` : ''}
          </div>
          ${help && help !== 'md' ? `<div class="help">${esc(help)}</div>` : ''}
        </div>
      </div></div>`;
  }

  function summary(v, i) {
    if (typeof v === 'string') return esc(v.slice(0, 60)) || '<i>Empty</i>';
    const main = v.title || v.tab || v.name || v.label || v.event || (v.links && v.links[0] && v.links[0].label) || (v.image ? 'Photo ' + (i + 1) : '');
    const sub = v.dates || v.date || v.ages || v.link || '';
    return (esc(main) || '<i>Untitled</i>') + (sub ? `<small>${esc(sub)}</small>` : '');
  }

  function listNode(path, arr) {
    const s = sig(path);
    const key = path[path.length - 1];
    const label = typeof key === 'number' ? 'Items' : humanize(key);
    const tpl = TEMPLATES[s] !== undefined ? TEMPLATES[s] : arr.length ? blank(arr[0]) : '';
    const simple = typeof tpl === 'string';
    const noun = simple ? 'paragraph' : ({ articles: 'article', events: 'event', rows: 'row', menu: 'menu item', submenu: 'drop-down item', topLinks: 'link', links: 'link', buttons: 'button', cards: 'card', columns: 'column', photoStrip: 'photo' }[key] || 'item');
    const addBtn = `<button type="button" class="btn ghost small" data-add="${pkey(path)}">+ Add ${noun}</button>`;
    let rows;
    if (simple) {
      rows = arr.map((v, i) => `<div class="str-row"><textarea rows="3" data-path="${pkey(path.concat(i))}">${esc(v)}</textarea>
        <div class="tools">${moveBtns(path, i, arr.length)}</div></div>`).join('');
    } else {
      rows = arr.map((v, i) => {
        const p = pkey(path.concat(i));
        const isOpen = open.has(p);
        return `<div class="item${isOpen ? ' open' : ''}" data-item="${p}">
          <div class="item-head" data-toggle="${p}"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="sum">${summary(v, i)}</span>
            ${moveBtns(path, i, arr.length)}<span class="caret">▶</span></div>
          <div class="item-body">${isOpen ? node(path.concat(i), v) : ''}</div></div>`;
      }).join('');
    }
    const top = path.length === 1;
    return `<div class="list${top ? '' : ' group'}"><div class="list-head"><span class="ltitle">${top ? '' : esc(label)}</span>${addBtn}</div>${rows || '<p class="muted" style="margin:0 0 12px">Nothing here yet.</p>'}</div>`;
  }

  function moveBtns(path, i, n) {
    const p = pkey(path);
    return `<button type="button" class="icon-btn" title="Move up" data-move="${p}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="icon-btn" title="Move down" data-move="${p}" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="icon-btn" title="Duplicate" data-dup="${p}" data-i="${i}">⧉</button>
      <button type="button" class="icon-btn del" title="Delete" data-del="${p}" data-i="${i}">✕</button>`;
  }

  const parsePath = (s) => s.split('.').map((x) => (/^\d+$/.test(x) ? +x : x));

  // typing
  $('#editor').addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.path) return;
    const path = parsePath(el.dataset.path);
    setAt(path, el.value);
    if (el.matches('[data-link]')) el.classList.toggle('bad', /^\s*(javascript|data|vbscript):/i.test(el.value));
    if (el.matches('[data-img]')) refreshThumb(el.dataset.path, el.value);
    if (el.tagName === 'TEXTAREA') grow(el);
    const item = el.closest('.item');
    if (item) { const v = getAt(parsePath(item.dataset.item)); item.querySelector(':scope > .item-head .sum').innerHTML = summary(v, +item.dataset.item.split('.').pop()); }
    setStatus();
  });

  // clicks: add / move / duplicate / delete / expand / images
  $('#editor').addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-toggle]');
    if (!t) return;
    const d = t.dataset;
    if (d.add) {
      const path = parsePath(d.add), arr = getAt(path), s = sig(path);
      const tpl = TEMPLATES[s] !== undefined ? TEMPLATES[s] : arr.length ? blank(arr[0]) : '';
      const item = JSON.parse(JSON.stringify(tpl));
      const atTop = ADD_TO_TOP.has(s);
      atTop ? arr.unshift(item) : arr.push(item);
      if (typeof item === 'object') { shiftOpen(path, atTop ? 0 : -1); open.add(pkey(path.concat(atTop ? 0 : arr.length - 1))); }
    } else if (d.move) {
      e.stopPropagation();
      const path = parsePath(d.move), arr = getAt(path), i = +d.i, j = i + +d.d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      swapOpen(path, i, j);
    } else if (d.dup) {
      e.stopPropagation();
      const path = parsePath(d.dup), arr = getAt(path), i = +d.i;
      arr.splice(i + 1, 0, JSON.parse(JSON.stringify(arr[i])));
      shiftOpen(path, i + 1); open.add(pkey(path.concat(i + 1)));
    } else if (d.del) {
      e.stopPropagation();
      const path = parsePath(d.del), arr = getAt(path), i = +d.i;
      const v = arr[i];
      const name = typeof v === 'string' ? 'this paragraph' : `"${(v.title || v.tab || v.name || v.label || v.event || 'this item').slice(0, 60)}"`;
      if (!confirm(`Delete ${name}?`)) return;
      arr.splice(i, 1);
      [...open].filter((k) => k.startsWith(pkey(path) + '.')).forEach((k) => open.delete(k));
    } else if (d.toggle) {
      if (e.target.closest('.icon-btn')) return;
      open.has(d.toggle) ? open.delete(d.toggle) : open.add(d.toggle);
    } else if (d.library) {
      return openLibrary(d.library);
    } else if (d.clear) {
      setAt(parsePath(d.clear), '');
    } else return;
    renderEditor(); setStatus();
  });
  function shiftOpen(path, from) {
    if (from < 0) return;
    const base = pkey(path) + '.';
    const moved = [...open].filter((k) => k.startsWith(base)).map((k) => { const rest = k.slice(base.length).split('.'); const n = +rest[0]; return [k, n >= from ? base + [n + 1, ...rest.slice(1)].join('.') : k]; });
    moved.forEach(([a]) => open.delete(a)); moved.forEach(([, b]) => open.add(b));
  }
  function swapOpen(path, i, j) {
    const base = pkey(path) + '.';
    const moved = [...open].filter((k) => k.startsWith(base)).map((k) => { const rest = k.slice(base.length).split('.'); const n = +rest[0]; return [k, base + [n === i ? j : n === j ? i : n, ...rest.slice(1)].join('.')]; });
    moved.forEach(([a]) => open.delete(a)); moved.forEach(([, b]) => open.add(b));
  }

  function refreshThumb(p, url) {
    const th = document.querySelector(`[data-thumb="${CSS.escape(p)}"]`);
    if (!th) return;
    th.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : '';
    th.classList.toggle('has', !!url); th.textContent = url ? '' : 'No image';
  }

  // ---------- uploads (images are shrunk in the browser first) ----------
  function maxSizeFor(p) {
    const path = parsePath(p), key = path[path.length - 1];
    return IMG_MAX[sig(path)] || IMG_MAX[key] || 2400;
  }
  function shrink(file, max) {
    return new Promise((resolve) => {
      if (file.type === 'image/gif') return resolve(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const keepPng = file.type === 'image/png' || file.type === 'image/webp';
        if (scale === 1 && file.size < 900 * 1024) return resolve(file);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((b) => resolve(b ? new File([b], file.name.replace(/\.\w+$/, keepPng ? '.png' : '.jpg'), { type: b.type }) : file), keepPng ? 'image/png' : 'image/jpeg', 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }
  async function upload(file, max) {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    const small = await shrink(file, max);
    if (small.size > 4 * 1024 * 1024) throw new Error('That image is still over 4 MB after resizing. Please use a smaller file.');
    const fd = new FormData(); fd.append('file', small);
    return api('/api/upload', { method: 'POST', body: fd });
  }
  $('#editor').addEventListener('change', async (e) => {
    const inp = e.target;
    if (!inp.dataset.upload || !inp.files[0]) return;
    const p = inp.dataset.upload;
    toast('Uploading…');
    try {
      const r = await upload(inp.files[0], maxSizeFor(p));
      setAt(parsePath(p), r.url); renderEditor(); setStatus();
      toast('Image uploaded. Click Save & publish to put it live.');
    } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    inp.value = '';
  });

  // ---------- image library ----------
  async function openLibrary(p) {
    mediaTarget = p;
    $('#mediaDialog').showModal();
    $('#mediaGrid').innerHTML = '<div class="empty">Loading…</div>';
    try {
      const { items } = await api('/api/upload');
      $('#mediaGrid').innerHTML = items.length
        ? items.map((m) => `<div class="m" data-url="${esc(m.url)}" style="background-image:url('${esc(m.url)}')" title="${esc(m.id)}"><button title="Delete from library" data-mdel="${esc(m.id)}">✕</button></div>`).join('')
        : '<div class="empty">No uploaded images yet. Use "Upload new".</div>';
    } catch (err) { if (err.message !== 'auth') $('#mediaGrid').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  $('#mediaGrid').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-mdel]');
    if (del) {
      e.stopPropagation();
      if (!confirm('Delete this image from the library? Anywhere it is used on the site will show a placeholder instead.')) return;
      await api('/api/upload?id=' + encodeURIComponent(del.dataset.mdel), { method: 'DELETE' }).catch((err) => toast(err.message, true));
      return openLibrary(mediaTarget);
    }
    const m = e.target.closest('.m');
    if (!m || !mediaTarget) return;
    setAt(parsePath(mediaTarget), m.dataset.url);
    $('#mediaDialog').close(); renderEditor(); setStatus();
  });
  $('#mediaUpload').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    toast('Uploading…');
    try { await upload(f, mediaTarget ? maxSizeFor(mediaTarget) : 2400); toast('Uploaded.'); openLibrary(mediaTarget); }
    catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    e.target.value = '';
  });
  $('#mediaClose').addEventListener('click', () => $('#mediaDialog').close());

  // ---------- history ----------
  async function renderHistory(ed, name, lead) {
    ed.innerHTML = `<h2>${esc(name)}</h2><p class="lead">${esc(lead)}</p>
      <div class="callout">Restoring a version replaces what is live now. The current version is kept in this list first, so you can always undo.</div>
      <div class="hist" id="histList"><div class="hist-row muted">Loading…</div></div>
      <p style="margin-top:26px"><button class="btn danger" id="resetBtn">Reset everything to the original content</button></p>
      <p class="muted" style="font-size:13px">Reset goes back to the content the site was first deployed with (content/site.json). Uploaded images stay in the library.</p>`;
    $('#resetBtn').onclick = async () => {
      if (!confirm('Reset the whole site to its original content? (The current version is saved to History first.)')) return;
      try { await api('/api/history/reset', { method: 'POST' }); await loadContent(); setStatus(); toast('Site reset to original content.'); renderHistory(ed, name, lead); }
      catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    };
    try {
      const { versions } = await api('/api/history');
      const fmt = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      $('#histList').innerHTML = versions.length
        ? versions.map((v) => `<div class="hist-row"><span>${esc(fmt(v.savedAt))}</span><button class="btn ghost small" data-restore="${esc(v.key)}">Restore</button></div>`).join('')
        : '<div class="hist-row muted">No earlier versions yet. They appear here after your first save.</div>';
      $('#histList').onclick = async (e) => {
        const b = e.target.closest('[data-restore]'); if (!b) return;
        if (isDirty() && !confirm('You have unsaved changes that will be lost. Continue?')) return;
        if (!confirm('Restore this version and make it live now?')) return;
        try { await api('/api/history/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: b.dataset.restore }) }); await loadContent(); setStatus(); toast('Version restored and live.'); renderHistory(ed, name, lead); }
        catch (err) { if (err.message !== 'auth') toast(err.message, true); }
      };
    } catch (err) { if (err.message !== 'auth') $('#histList').innerHTML = `<div class="hist-row">${esc(err.message)}</div>`; }
  }

  // ---------- textarea sizing ----------
  function grow(t) { if (t.classList.contains('big')) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 4, 420) + 'px'; }
  function autosize(root) { root.querySelectorAll('textarea').forEach(grow); }

  // ---------- start ----------
  async function startApp() {
    await loadContent();
    $('#loginView').hidden = true; $('#appView').hidden = false;
    renderNav(); renderEditor(); setStatus();
  }
  (async function init() {
    try {
      const s = await (await fetch('/api/session', { cache: 'no-store' })).json();
      if (!s.configured) { $('#loginView').hidden = false; $('#loginForm').hidden = true; $('#setupCard').hidden = false; return; }
      if (s.loggedIn) return startApp();
      showLogin();
    } catch {
      $('#loginView').hidden = false;
      $('#loginMsg').textContent = 'The admin backend is not reachable. It only works on the deployed Netlify site (or with "netlify dev").';
    }
  })();
})();
