// Studio's interface. Plain JavaScript, no framework.
// It keeps a copy of the site's content in `S`, shows one view at a time, and saves
// each change to the server a moment after you stop typing.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const IMAGE = /\.(jpe?g|png|webp|heic|heif|tiff?)$/i;

let S = null;                     // everything from the server
let view = { kind: 'none' };      // { kind: 'trip', id } | { kind: 'site' }
let upload = null;                // { id, done, total, errors } while photos are being added
const main = $('#main');

// ---------------------------------------------------------------- server

async function api(method, path, body, { raw = false } = {}) {
  const init = { method, headers: { 'x-studio': '1' } };
  if (body !== undefined) {
    init.body = raw ? body : JSON.stringify(body);
    init.headers['content-type'] = raw ? 'application/octet-stream' : 'application/json';
  }
  let res;
  try { res = await fetch(path, init); }
  catch { throw new Error('Studio isn’t running any more. Start it again, then reload this page.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ---------------------------------------------------------------- saving

const pending = new Map();        // key → timer
const saving = new Set();
let saveError = '';

function setSaveState() {
  const el = $('#save-state');
  if (saveError) { el.className = 'save-state bad'; el.textContent = `Not saved: ${saveError}`; }
  else if (pending.size || saving.size) { el.className = 'save-state'; el.textContent = 'Saving…'; }
  else { el.className = 'save-state ok'; el.textContent = 'All changes saved'; }
}

function touch(key, delay = 700) {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => save(key), delay));
  setSaveState();
}

function tripProblem(t) {
  if (!t.country.trim()) return 'Add a country or place name.';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.date)) return 'Choose the month of the trip.';
  return '';
}

async function save(key) {
  clearTimeout(pending.get(key));
  pending.delete(key);
  if (saving.has(key)) { touch(key, 300); return; }
  saving.add(key);
  setSaveState();
  try {
    if (key === 'about') {
      await api('PUT', '/api/about', S.about);
    } else {
      const trip = S.trips.find((t) => t.id === key);
      if (trip) {
        const problem = tripProblem(trip);
        if (problem) throw new Error(problem);
        const { trip: saved } = await api('PUT', `/api/trips/${encodeURIComponent(key)}`, trip);
        if (saved.id !== key) {           // the folder was renamed because country or month changed
          trip.id = saved.id;
          if (view.kind === 'trip' && view.id === key) view.id = saved.id;
          if (upload?.id === key) upload.id = saved.id;
          sortTrips();
          refreshHeaderLinks();
          if (currentTrip() === trip) rerenderPhotos();   // photo addresses changed with the folder name
        }
        renderSide();
      }
    }
    saveError = '';
  } catch (e) {
    saveError = e.message;
  } finally {
    saving.delete(key);
    setSaveState();
    refreshChanges();
  }
}

async function flush() {
  await Promise.all([...pending.keys()].map((k) => save(k)));
  while (saving.size) await new Promise((r) => setTimeout(r, 80));
}

let changesTimer;
function refreshChanges() {
  clearTimeout(changesTimer);
  changesTimer = setTimeout(async () => {
    try { S.changes = await api('GET', '/api/changes'); renderPublishButton(); } catch { /* shown elsewhere */ }
  }, 400);
}

// ---------------------------------------------------------------- helpers

const sortTrips = () => S.trips.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
const currentTrip = () => (view.kind === 'trip' ? S.trips.find((t) => t.id === view.id) : null);
const plain = (name) => name.replace(/[\[\]]/g, '').trim().toLowerCase();
const knownCountry = (name) => S.countries.includes(plain(name));
const thumb = (trip, file, w = 480) => `/media/trips/${encodeURIComponent(trip.id)}/${encodeURIComponent(file)}?w=${w}`;

function monthLabel(t) {
  if (t.dateLabel) return t.dateLabel;
  const m = /^(\d{4})-(\d{2})$/.exec(t.date);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : 'No month yet';
}

function toast(text, opts) {
  const { action, onAction, bad = false, ms = 7000 } = opts || {};
  const el = document.createElement('div');
  el.className = `toast${bad ? ' bad' : ''}`;
  el.innerHTML = `<span>${h(text)}</span>${action ? `<button type="button">${h(action)}</button>` : ''}`;
  if (action) $('button', el).addEventListener('click', () => { el.remove(); onAction(); });
  $('#toasts').append(el);
  setTimeout(() => el.remove(), bad ? 12000 : ms);
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

const dialog = $('#dialog');
function openDialog(html, { wide = false } = {}) {
  dialog.className = `dialog${wide ? ' wide' : ''}`;
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  return dialog;
}
dialog.addEventListener('click', (e) => {
  if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
});

/** A yes/no question inside the page (no browser pop-ups). */
function confirmBox({ title, text, yes, danger = false }) {
  return new Promise((resolve) => {
    openDialog(`<div class="inner"><h2>${h(title)}</h2><p class="muted" style="margin:0">${h(text)}</p>
      <div class="foot"><button class="btn" type="button" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-yes>${h(yes)}</button></div></div>`);
    const done = (v) => { dialog.close(); resolve(v); };
    $('[data-yes]', dialog).addEventListener('click', () => done(true));
    $('[data-no]', dialog).addEventListener('click', () => done(false));
    dialog.addEventListener('close', () => resolve(false), { once: true });
    $('[data-no]', dialog).focus();
  });
}

// ---------------------------------------------------------------- sidebar + top bar

function tripStatus(t) {
  if (t.broken) return '<span class="tag warn">Needs fixing</span>';
  if (!t.photos.length) return '<span class="tag warn">No photos yet</span>';
  if (t.draft) return '<span class="tag">Hidden</span>';
  return '';
}

function renderSide() {
  $('#nav-site').setAttribute('aria-current', view.kind === 'site');
  $('#trip-list').innerHTML = S.trips.map((t) => `
    <li><button class="trip-item" type="button" data-nav="trip" data-id="${h(t.id)}" aria-current="${view.kind === 'trip' && view.id === t.id}">
      ${t.photos[0] ? `<img src="${h(thumb(t, t.photos[0].file, 120))}" alt="">` : '<span class="noimg"></span>'}
      <span><span class="t">${h(t.country || 'Untitled trip')}</span>
      <span class="s">${h(monthLabel(t))} · ${t.photos.length} photo${t.photos.length === 1 ? '' : 's'} ${tripStatus(t)}</span></span>
    </button></li>`).join('') || '<li class="muted" style="padding:8px 12px">No trips yet.</li>';
}

function refreshHeaderLinks() {
  const t = currentTrip();
  $('#preview-link').href = t && t.photos.length && !t.draft ? `${S.preview}/places/${t.id}/` : S.preview;
}

function renderPublishButton() {
  const c = S.changes;
  const n = c.items.length + (c.count === 0 && c.unpushed > 0 ? 1 : 0);
  $('#publish-btn').innerHTML = n ? `Publish <span class="count">${n}</span>` : 'Publish';
  $('#publish-btn').title = n ? 'Send your changes to the live site' : 'Nothing new to publish';
}

function renderChrome() {
  $('#brand-name').textContent = S.about.name ? ` · ${S.about.name}` : '';
  $('#side-foot').innerHTML = S.site ? `Live site: <a href="${h(S.site)}" target="_blank" rel="noopener">${h(S.site.replace(/^https?:\/\//, ''))}</a>` : '';
  renderSide();
  renderPublishButton();
  refreshHeaderLinks();
}

function go(next) {
  view = next;
  renderSide();
  refreshHeaderLinks();
  render();
  main.scrollIntoView({ block: 'start' });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- trip view

function photoCard(t, p, i) {
  const n = t.photos.length;
  return `
  <li class="photo" data-i="${i}">
    <div class="pic">
      <button class="thumb" type="button" data-act="zoom" title="See it larger"><img src="${h(thumb(t, p.file, 320))}" alt="" loading="lazy" draggable="false"></button>
      <div class="order">
        <button class="icon-btn" type="button" data-act="earlier" title="Move earlier" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>←</button>
        <span class="icon-btn handle" draggable="true" title="Drag to reorder" aria-hidden="true">⠿</span>
        <button class="icon-btn" type="button" data-act="later" title="Move later" aria-label="Move later" ${i === n - 1 ? 'disabled' : ''}>→</button>
      </div>
      <span class="num">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span>
    </div>
    <div class="fields">
      <input class="title" type="text" data-p="title" value="${h(p.title)}" placeholder="Title" aria-label="Title of photo ${i + 1}">
      <textarea data-p="story" rows="2" placeholder="The story behind it" aria-label="Story for photo ${i + 1}">${h(p.story)}</textarea>
      <div class="row2">
        <input type="text" data-p="city" value="${h(p.city)}" placeholder="City" list="city-list" aria-label="City for photo ${i + 1}">
        <select data-p="layout" aria-label="Size on the trip page for photo ${i + 1}">
          <option value="" ${p.layout === '' ? 'selected' : ''}>Size: automatic</option>
          <option value="wide" ${p.layout === 'wide' ? 'selected' : ''}>Full width</option>
          <option value="pair" ${p.layout === 'pair' ? 'selected' : ''}>Side by side</option>
        </select>
      </div>
      <details class="more" ${p.alt ? 'open' : ''}><summary>Description for screen readers</summary>
        <input type="text" data-p="alt" value="${h(p.alt)}" placeholder="What the photo shows (optional; the title is used if empty)" aria-label="Description of photo ${i + 1}">
      </details>
      <div class="actions">
        <button class="star" type="button" data-act="star" aria-pressed="${p.featured}" title="Show this photo in the scrolling row on the home page">★ Home carousel</button>
        <button class="link" type="button" data-act="hero" title="Use this as the big photo at the top of the home page">Use as top photo</button>
        <button class="link danger" type="button" data-act="remove">Remove</button>
      </div>
    </div>
  </li>`;
}

function photosBlock(t) {
  const featured = t.photos.filter((p) => p.featured).length;
  const busy = upload && upload.id === t.id;
  return `
    <div class="photos-head">
      <div><h2>Photos</h2><span class="muted">${t.photos.length ? `${t.photos.length} in this trip · ${featured || 'the first 6'} in the home carousel · drag ⠿ or use the arrows to reorder` : 'Add photos to put this trip on the site.'}</span></div>
      <div class="head-actions">
        <button class="btn small" type="button" data-act="pick-photos">Add photos…</button>
        <button class="btn small" type="button" data-act="pick-folder">Add a folder…</button>
      </div>
    </div>
    ${busy ? `<div class="progress"><div class="bar"><i style="width:${Math.round((upload.done / upload.total) * 100)}%"></i></div><div class="txt">Adding photo ${Math.min(upload.done + 1, upload.total)} of ${upload.total}. Converting, resizing and removing location data…</div></div>` : ''}
    <ul class="photo-grid" id="photo-grid">${t.photos.map((p, i) => photoCard(t, p, i)).join('')}</ul>
    <div class="dropzone" id="dropzone"><strong>Drop photos or a folder here</strong><span>iPhone HEIC photos are fine. Location data is removed from every photo.</span></div>
    <datalist id="city-list">${t.cities.map((c) => `<option value="${h(c)}">`).join('')}</datalist>`;
}

function mapNotice(t) {
  if (!t.country.trim() || t.map || knownCountry(t.country)) return '';
  return `<div class="notice">Studio doesn’t know where “${h(t.country)}” is, so it won’t appear on the map yet. Open “Map position” below and enter its latitude and longitude.</div>`;
}

function renderTrip() {
  const t = currentTrip();
  if (!t) return go({ kind: 'none' });
  if (t.broken) {
    main.innerHTML = `<div class="page-head"><div><h1>${h(t.id)}</h1></div></div>
      <div class="notice bad">Studio can’t read this trip’s file (src/content/trips/${h(t.id)}/index.md).\n${h(t.broken)}\n\nFix the file by hand, or delete the trip here and add it again.</div>
      <button class="btn danger" type="button" data-act="delete-trip">Delete this trip</button>`;
    return;
  }
  const ring = S.about.alsoVisited.some((v) => plain(typeof v === 'string' ? v : v.name) === plain(t.country));
  main.innerHTML = `
    <div class="page-head">
      <div><h1 id="trip-title">${h(t.country || 'Untitled trip')}<span class="muted">, ${h(monthLabel(t))}</span></h1>
        <p class="sub" id="trip-sub">${t.draft ? 'Hidden from the site.' : t.photos.length ? 'Shown on the site after you publish.' : 'Not on the site until it has a photo.'}</p></div>
      <div class="head-actions"><button class="btn danger" type="button" data-act="delete-trip">Delete trip</button></div>
    </div>
    <div id="trip-notices">${mapNotice(t)}</div>
    <section class="panel">
      <h2>Trip details</h2><p class="hint">Shown at the top of the trip’s page, in the list of places and on the map.</p>
      <div class="grid">
        <div class="f s4"><label for="t-country">Country or place</label><input id="t-country" type="text" data-t="country" value="${h(t.country)}" list="country-list" placeholder="Japan">
          ${ring ? '<span class="help">Its ring on the map becomes a solid dot once this trip has photos.</span>' : ''}</div>
        <div class="f s3"><label for="t-date">Month</label><input id="t-date" type="month" data-t="date" value="${h(t.date)}"></div>
        <div class="f s4"><label for="t-label">Shown instead of the month (optional)</label><input id="t-label" type="text" data-t="dateLabel" value="${h(t.dateLabel)}" placeholder="e.g. Home, ongoing"></div>
        <div class="f"><label for="t-cities">Cities, separated by commas</label><input id="t-cities" type="text" data-t="cities" value="${h(t.cities.join(', '))}" placeholder="Kyoto, Osaka, Tokyo"></div>
        <div class="f"><label for="t-intro">About this trip</label><textarea id="t-intro" data-t="intro" rows="3" placeholder="Why you went, how long you stayed, what the place felt like.">${h(t.intro)}</textarea>
          <span class="help">Leave a blank line to start a new paragraph.</span></div>
        <div class="f s6"><label class="check"><input type="checkbox" data-t="draft" ${t.draft ? 'checked' : ''}> Hide this trip from the site for now</label></div>
        <div class="f"><details class="more" ${t.map ? 'open' : ''}><summary>Map position</summary>
          <div class="grid">
            <div class="f s3"><label for="t-lat">Latitude</label><input id="t-lat" type="number" step="any" min="-90" max="90" data-t="lat" value="${t.map ? h(t.map.lat) : ''}" placeholder="35.01"></div>
            <div class="f s3"><label for="t-lng">Longitude</label><input id="t-lng" type="number" step="any" min="-180" max="180" data-t="lng" value="${t.map ? h(t.map.lng) : ''}" placeholder="135.77"></div>
            <div class="f s6"><span class="label">&nbsp;</span><span class="help">Leave both empty to place the dot at the centre of the country. To find a place’s numbers, right-click it in Google Maps.</span></div>
          </div></details></div>
      </div>
    </section>
    <section class="panel" id="photos-panel">${photosBlock(t)}</section>
    <datalist id="country-list">${countryOptions()}</datalist>`;
  $$('textarea', main).forEach(autosize);
}

function countryOptions() {
  const names = new Set([...S.countries.map((c) => c.replace(/\b[a-z]/g, (m) => m.toUpperCase()).replace(/^Usa$/, 'USA').replace(/^Uk$/, 'UK').replace(/^Uae$/, 'UAE'))]);
  for (const v of S.about.alsoVisited) names.add(typeof v === 'string' ? v : v.name);
  return [...names].sort().map((n) => `<option value="${h(n)}">`).join('');
}

function rerenderPhotos() {
  const t = currentTrip();
  const panel = $('#photos-panel');
  if (!t || !panel) return;
  panel.innerHTML = photosBlock(t);
  $$('textarea', panel).forEach(autosize);
  renderSide();
}

function movePhoto(t, from, to) {
  if (to < 0 || to >= t.photos.length || from === to) return;
  const [p] = t.photos.splice(from, 1);
  t.photos.splice(to, 0, p);
  rerenderPhotos();
  touch(t.id, 200);
}

async function removePhoto(t, i) {
  const [p] = t.photos.splice(i, 1);
  rerenderPhotos();
  await save(t.id);
  if (saveError) {                 // the trip couldn't be saved, so keep the photo
    t.photos.splice(i, 0, p);
    rerenderPhotos();
    return toast(`Couldn’t remove the photo: ${saveError}`, { bad: true });
  }
  let undo = null;
  try { undo = (await api('DELETE', `/api/trips/${encodeURIComponent(t.id)}/photos/${encodeURIComponent(p.file)}`)).undo; }
  catch (e) { toast(e.message, { bad: true }); }
  refreshChanges();
  toast(`Removed “${p.title || p.file}”.`, undo && {
    action: 'Undo',
    onAction: async () => {
      try {
        await api('POST', '/api/undo', { ...undo, id: t.id });
        t.photos.splice(Math.min(i, t.photos.length), 0, p);
        if (currentTrip() === t) rerenderPhotos(); else renderSide();
        touch(t.id, 0);
      } catch (e) { toast(e.message, { bad: true }); }
    },
  });
}

async function deleteTrip(t) {
  const ok = await confirmBox({
    title: `Delete ${t.country || 'this trip'}?`,
    text: `This removes the trip and its ${t.photos.length} photo${t.photos.length === 1 ? '' : 's'} from the site. You can undo straight afterwards.`,
    yes: 'Delete trip', danger: true,
  });
  if (!ok) return;
  clearTimeout(pending.get(t.id)); pending.delete(t.id);
  try {
    const { undo } = await api('DELETE', `/api/trips/${encodeURIComponent(t.id)}`);
    S.trips = S.trips.filter((x) => x !== t);
    go(S.trips[0] ? { kind: 'trip', id: S.trips[0].id } : { kind: 'none' });
    refreshChanges();
    toast(`Deleted ${t.country || 'the trip'}.`, {
      action: 'Undo', ms: 12000,
      onAction: async () => {
        try { await api('POST', '/api/undo', undo); await load({ kind: 'trip', id: undo.id }); }
        catch (e) { toast(e.message, { bad: true }); }
      },
    });
  } catch (e) { toast(e.message, { bad: true }); }
}

// ---------------------------------------------------------------- adding photos

async function filesFromDrop(dt) {
  const entries = [...(dt.items ?? [])].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...(dt.files ?? [])];
  const out = [];
  const walk = async (entry) => {
    if (entry.isFile) out.push(await new Promise((res, rej) => entry.file(res, rej)));
    else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

const photosOnly = (files) => files.filter((f) => IMAGE.test(f.name) && !f.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

function pickFiles({ folder = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (folder) input.webkitdirectory = true;
    else input.accept = 'image/*,.heic,.heif';
    input.addEventListener('change', () => resolve(photosOnly([...input.files])));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

async function addPhotos(trip, files) {
  files = photosOnly(files);
  if (!files.length) { toast('No photos found in what you dropped.', { bad: true }); return; }
  if (upload) { toast('Still adding the last batch. Try again in a moment.'); return; }
  upload = { id: trip.id, done: 0, total: files.length, errors: [] };
  const added = [];
  if (currentTrip() === trip) rerenderPhotos();
  for (const [order, file] of files.entries()) {
    try {
      const r = await api('POST', `/api/trips/${encodeURIComponent(upload.id)}/photos?name=${encodeURIComponent(file.name)}`, file, { raw: true });
      added.push({ ...r, order });
    } catch (e) { upload.errors.push(e.message); }
    upload.done++;
    const bar = $('.progress .bar i'); const txt = $('.progress .txt');
    if (bar && currentTrip() === trip) {
      bar.style.width = `${Math.round((upload.done / upload.total) * 100)}%`;
      txt.textContent = upload.done < upload.total ? `Adding photo ${upload.done + 1} of ${upload.total}. Converting, resizing and removing location data…` : 'Finishing…';
    }
  }
  // New photos go in the order they were taken.
  added.sort((a, b) => (a.takenAt ?? Infinity) - (b.takenAt ?? Infinity) || a.order - b.order);
  let featured = trip.photos.filter((p) => p.featured).length;
  for (const a of added) trip.photos.push({ file: a.file, title: '', story: '', city: '', alt: '', featured: featured++ < 6, layout: '' });
  const errors = upload.errors;
  upload = null;
  if (currentTrip() === trip) { rerenderPhotos(); const sub = $('#trip-sub'); if (sub && !trip.draft && trip.photos.length) sub.textContent = 'Shown on the site after you publish.'; }
  else renderSide();
  await save(trip.id);
  refreshHeaderLinks();
  if (added.length) toast(`Added ${added.length} photo${added.length === 1 ? '' : 's'}. Now give them titles and stories.`);
  if (errors.length) toast(`${errors.length} photo${errors.length === 1 ? '' : 's'} couldn’t be added:\n${errors.slice(0, 3).join('\n')}`, { bad: true });
}

async function newTripDialog(files = []) {
  files = photosOnly(files);
  let month = '';
  if (files[0]) { try { month = (await api('POST', '/api/probe', files[0], { raw: true })).date; } catch { /* leave empty */ } }
  if (!month) { const d = new Date(); month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  openDialog(`<form method="dialog" id="new-trip-form">
    <h2>New trip</h2>
    <div class="grid">
      <div class="f s8"><label for="n-country">Country or place</label><input id="n-country" type="text" required list="n-countries" placeholder="Taiwan" autocomplete="off"><datalist id="n-countries">${countryOptions()}</datalist></div>
      <div class="f s4"><label for="n-date">Month</label><input id="n-date" type="month" required value="${h(month)}"></div>
      <div class="f"><label for="n-cities">Cities, separated by commas (optional)</label><input id="n-cities" type="text" placeholder="Taipei, Jiufen"></div>
      <div class="f"><span class="label">Photos</span>
        <div class="dropzone" id="n-drop"><strong id="n-count">${files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} ready to add` : 'Drop photos or a folder here'}</strong>
          <span>${files.length && month ? 'The month was read from the first photo.' : 'You can also add them after creating the trip.'}</span>
          <div class="row"><button class="btn small" type="button" data-pick="photos">Choose photos…</button><button class="btn small" type="button" data-pick="folder">Choose a folder…</button></div></div></div>
    </div>
    <p class="notice bad" id="n-error" hidden></p>
    <div class="foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Create trip</button></div>
  </form>`);
  const setFiles = async (f) => {
    files = photosOnly(f);
    $('#n-count').textContent = files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} ready to add` : 'No photos found';
    if (files[0]) { try { const d = (await api('POST', '/api/probe', files[0], { raw: true })).date; if (d) $('#n-date').value = d; } catch { /* keep */ } }
  };
  $$('[data-pick]', dialog).forEach((b) => b.addEventListener('click', async () => setFiles(await pickFiles({ folder: b.dataset.pick === 'folder' }))));
  const drop = $('#n-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); setFiles(await filesFromDrop(e.dataTransfer)); });
  $('#new-trip-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { trip } = await api('POST', '/api/trips', {
        country: $('#n-country').value.trim(), date: $('#n-date').value,
        cities: $('#n-cities').value.split(',').map((c) => c.trim()).filter(Boolean),
      });
      S.trips.push(trip); sortTrips();
      dialog.close();
      go({ kind: 'trip', id: trip.id });
      refreshChanges();
      if (files.length) addPhotos(trip, files);
    } catch (err) { const el = $('#n-error'); el.textContent = err.message; el.hidden = false; }
  });
  $('#n-country').focus();
}

// ---------------------------------------------------------------- home page & about view

function imageSlot({ which, has, label, emptyText, tall = false }) {
  return `<div class="image-slot">
    <div class="preview ${tall ? 'tall' : ''}" data-slot="${which}">${has ? `<img src="/media/${which}.jpg?w=640&t=${Date.now()}" alt="">` : h(emptyText)}</div>
    <div class="rows">
      <div class="head-actions"><button class="btn small" type="button" data-act="pick-${which}">${has ? 'Replace…' : 'Choose a photo…'}</button>${which === 'hero' && has ? '<button class="btn small" type="button" data-act="remove-hero">Remove</button>' : ''}</div>
      <span class="help muted">Or drop a photo onto the picture. ${h(label)}</span>
    </div></div>`;
}

function renderSite() {
  const a = S.about;
  const newest = S.trips.find((t) => !t.draft && t.photos.length);
  main.innerHTML = `
    <div class="page-head"><div><h1>Home page &amp; About</h1><p class="sub">Everything on the site that isn’t a trip.</p></div></div>

    <section class="panel"><h2>Top of the home page</h2><p class="hint">The first thing visitors see.</p>
      <div class="grid">
        <div class="f"><span class="label">Big photo behind the top</span>
          ${imageSlot({ which: 'hero', has: !!a.hero, label: 'A wide landscape photo works best.', emptyText: newest ? `Using the first carousel photo from ${newest.country}` : 'No photo yet' })}</div>
        <div class="f s6"><label for="a-heroCaption">Caption on the photo (optional)</label><input id="a-heroCaption" type="text" data-a="heroCaption" value="${h(a.heroCaption)}" placeholder="Kyoto, March 2025"></div>
        <div class="f"><label for="a-headline">Headline</label><input id="a-headline" type="text" data-a="headline" value="${h(a.headline)}">
          <span class="help">Put *asterisks* around words to show them in grey italic.</span></div>
        <div class="f"><label for="a-intro">Line under the headline</label><textarea id="a-intro" data-a="intro" rows="2">${h(a.intro)}</textarea></div>
        <div class="f"><span class="label">Your portrait</span>
          ${imageSlot({ which: 'portrait', has: !!a.portrait, label: 'A portrait-shaped photo (taller than wide) works best.', emptyText: 'No portrait yet', tall: true })}</div>
        <div class="f s6"><label for="a-portraitCaption">Caption under the portrait (optional)</label><input id="a-portraitCaption" type="text" data-a="portraitCaption" value="${h(a.portraitCaption)}" placeholder="Me, Norway, June 2024"></div>
      </div>
    </section>

    <section class="panel"><h2>About you</h2><p class="hint">The section at the bottom of the home page.</p>
      <div class="grid">
        <div class="f s6"><label for="a-name">Name</label><input id="a-name" type="text" data-a="name" value="${h(a.name)}"></div>
        <div class="f s6"><label for="a-email">Email shown on the site (optional)</label><input id="a-email" type="email" data-a="email" value="${h(a.email)}"></div>
        <div class="f"><label for="a-bio">Bio</label><textarea id="a-bio" data-a="bio" rows="4">${h(a.bio)}</textarea>
          <span class="help">Leave a blank line to start a new paragraph. To make a link, write [words](https://address).</span></div>
        <div class="f"><span class="label">What you do by day</span><div class="rows" id="roles">${rowsHtml('roles')}</div>
          <div><button class="btn small" type="button" data-act="add-roles">+ Add a role</button></div></div>
        <div class="f"><span class="label">Links</span><div class="rows" id="links">${rowsHtml('links')}</div>
          <div><button class="btn small" type="button" data-act="add-links">+ Add a link</button></div></div>
        <div class="f s6"><label for="a-instagram">Instagram link in the menu (optional)</label><input id="a-instagram" type="url" data-a="instagram" value="${h(a.instagram)}" placeholder="https://www.instagram.com/yourname"></div>
      </div>
    </section>

    <section class="panel"><h2>Places on the map without photos yet</h2><p class="hint">Places you’ve been but haven’t posted. They show on the map as rings and turn into solid dots when you add a trip for them.</p>
      <div class="chips" id="visited">${visitedHtml()}</div>
      <form class="addline" id="visited-form"><input type="text" id="visited-input" list="country-list" placeholder="Add a country" aria-label="Add a country"><button class="btn" type="submit">Add</button></form>
      <datalist id="country-list">${countryOptions()}</datalist>
    </section>`;
  $$('textarea', main).forEach(autosize);
}

function rowsHtml(kind) {
  const [k1, k2, p1, p2] = kind === 'roles' ? ['role', 'org', 'Software Engineer', 'Company'] : ['label', 'url', 'LinkedIn', 'https://…'];
  return S.about[kind].map((r, i) => `<div class="rowline" data-row="${kind}" data-i="${i}">
    <input type="text" data-k="${k1}" value="${h(r[k1])}" placeholder="${p1}" aria-label="${k1} ${i + 1}">
    <input type="${kind === 'links' ? 'url' : 'text'}" data-k="${k2}" value="${h(r[k2])}" placeholder="${p2}" aria-label="${k2} ${i + 1}">
    <button class="icon-btn" type="button" data-act="del-row" title="Remove" aria-label="Remove">✕</button></div>`).join('') || '<span class="muted">None yet.</span>';
}

function visitedHtml() {
  const haveTrip = new Set(S.trips.filter((t) => t.photos.length && !t.draft).map((t) => plain(t.country)));
  return S.about.alsoVisited.map((v, i) => {
    const name = typeof v === 'string' ? v : v.name;
    const unknown = typeof v === 'string' && !knownCountry(name);
    const done = haveTrip.has(plain(name));
    return `<span class="chip ${unknown ? 'warn' : ''}" title="${unknown ? 'Studio doesn’t know where this is, so it won’t show on the map.' : done ? 'This place has a trip now, so it shows as a solid dot.' : ''}">${h(name)}${done ? ' ✓' : ''}${unknown ? ' (not on map)' : ''}
      <button type="button" data-act="del-visited" data-i="${i}" aria-label="Remove ${h(name)}">✕</button></span>`;
  }).join('') || '<span class="muted">None.</span>';
}

async function setImage(which, file) {
  if (!file) return;
  if (!IMAGE.test(file.name)) { toast('That isn’t a photo Studio can use.', { bad: true }); return; }
  await flush();
  toast(which === 'hero' ? 'Preparing the top photo…' : 'Preparing your portrait…', { ms: 2500 });
  try {
    const r = await api('POST', `/api/about/${which}?name=${encodeURIComponent(file.name)}`, file, { raw: true });
    S.about = r.about;
    if (view.kind === 'site') renderSite();
    refreshChanges();
    if (which === 'portrait' && r.portraitShape === 'wide') toast('That photo is wider than it is tall, so the sides will be cropped on the site.');
  } catch (e) { toast(e.message, { bad: true }); }
}

// ---------------------------------------------------------------- publish

async function publishDialog() {
  await flush();
  if (saveError) { toast(`Fix this first: ${saveError}`, { bad: true }); return; }
  let c;
  try { c = S.changes = await api('GET', '/api/changes'); } catch (e) { toast(e.message, { bad: true }); return; }
  renderPublishButton();
  if (!c.git || !c.remote) {
    openDialog(`<div class="inner"><h2>Publishing isn’t set up</h2><p class="muted" style="margin:0">This project isn’t connected to GitHub yet. The README’s “Publishing” section has the one-time steps.</p><div class="foot"><button class="btn primary" type="button" data-close>OK</button></div></div>`);
    return;
  }
  if (!c.count && !c.unpushed) {
    openDialog(`<div class="inner"><h2>Nothing new to publish</h2><p class="muted" style="margin:0">The live site already has everything.</p>
      <div class="foot">${S.site ? `<a class="btn" href="${h(S.site)}" target="_blank" rel="noopener">Open the live site ↗</a>` : ''}<button class="btn primary" type="button" data-close>OK</button></div></div>`);
    return;
  }
  const hidden = S.trips.filter((t) => !t.draft && !t.photos.length).length;
  openDialog(`<form method="dialog" id="publish-form">
    <h2>Publish to the live site</h2>
    <ul class="changes">${c.items.map((i) => `<li><span>${h(i.label)}</span><span>${h(i.detail)}</span></li>`).join('') || '<li><span>Changes saved earlier</span><span>not sent yet</span></li>'}</ul>
    ${hidden ? `<p class="muted" style="margin:0">${hidden} trip${hidden === 1 ? ' has' : 's have'} no photos yet and won’t appear on the site.</p>` : ''}
    <div class="grid"><div class="f"><label for="p-note">Note for yourself (optional)</label><input id="p-note" type="text" placeholder="e.g. Added Taiwan" maxlength="120"></div></div>
    <p class="notice bad" id="p-error" hidden></p>
    <div class="foot"><a class="btn" href="${h(S.preview)}" target="_blank" rel="noopener">Check the preview first ↗</a><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit" id="p-go">Publish</button></div>
  </form>`);
  $('#publish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#p-go');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Publishing…';
    try {
      const r = await api('POST', '/api/publish', { note: $('#p-note').value });
      openDialog(`<div class="inner"><h2>Sent ✓</h2><p class="muted" style="margin:0">The live site rebuilds itself now and updates in a minute or two. If you still see the old version after that, reload the page.</p>
        <div class="foot">${r.actions ? `<a class="btn" href="${h(r.actions)}" target="_blank" rel="noopener">Watch the progress ↗</a>` : ''}${r.site ? `<a class="btn" href="${h(r.site)}" target="_blank" rel="noopener">Open the live site ↗</a>` : ''}<button class="btn primary" type="button" data-close>Done</button></div></div>`);
    } catch (err) {
      const el = $('#p-error'); el.textContent = err.message; el.hidden = false;
      btn.disabled = false; btn.textContent = 'Try again';
    }
    refreshChanges();
  });
}

// ---------------------------------------------------------------- rendering + events

function renderEmpty() {
  main.innerHTML = `<div class="empty"><h1>Add your first trip</h1><p class="muted">Drop a folder of photos anywhere on this page, or start with the button below. Studio converts and resizes them and removes their location data.</p>
    <button class="btn primary" type="button" data-act="new-trip">+ New trip</button></div>`;
}

function render() {
  if (view.kind === 'trip') renderTrip();
  else if (view.kind === 'site') renderSite();
  else renderEmpty();
}

// Typing in a field: update the copy in memory, then save a moment later.
main.addEventListener('input', (e) => {
  const el = e.target;
  if (el.tagName === 'TEXTAREA') autosize(el);
  const t = currentTrip();

  if (el.dataset.t && t) {
    const f = el.dataset.t;
    if (f === 'cities') t.cities = el.value.split(',').map((c) => c.trim()).filter(Boolean);
    else if (f === 'draft') t.draft = el.checked;
    else if (f === 'lat' || f === 'lng') {
      const lat = parseFloat($('#t-lat').value); const lng = parseFloat($('#t-lng').value);
      t.map = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
    } else t[f] = el.value;
    if (f === 'country' || f === 'date' || f === 'dateLabel') {
      $('#trip-title').innerHTML = `${h(t.country || 'Untitled trip')}<span class="muted">, ${h(monthLabel(t))}</span>`;
      renderSide();
    }
    if (f === 'country' || f === 'lat' || f === 'lng') $('#trip-notices').innerHTML = mapNotice(t);
    if (f === 'draft') { $('#trip-sub').textContent = t.draft ? 'Hidden from the site.' : t.photos.length ? 'Shown on the site after you publish.' : 'Not on the site until it has a photo.'; renderSide(); refreshHeaderLinks(); }
    if (f === 'cities') $('#city-list').innerHTML = t.cities.map((c) => `<option value="${h(c)}">`).join('');
    el.classList.toggle('bad', (f === 'country' && !t.country.trim()) || (f === 'date' && !t.date));
    return touch(t.id);
  }
  if (el.dataset.p && t) {
    const i = Number(el.closest('.photo').dataset.i);
    t.photos[i][el.dataset.p] = el.value;
    return touch(t.id);
  }
  if (el.dataset.a) { S.about[el.dataset.a] = el.value; if (el.dataset.a === 'name') $('#brand-name').textContent = el.value ? ` · ${el.value}` : ''; return touch('about'); }
  if (el.dataset.k) {
    const row = el.closest('[data-row]');
    S.about[row.dataset.row][Number(row.dataset.i)][el.dataset.k] = el.value;
    return touch('about', 900);
  }
});

main.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const t = currentTrip();
  const card = btn.closest('.photo');
  const i = card ? Number(card.dataset.i) : -1;

  if (act === 'new-trip') return newTripDialog();
  if (t) {
    if (act === 'earlier') return movePhoto(t, i, i - 1);
    if (act === 'later') return movePhoto(t, i, i + 1);
    if (act === 'star') { t.photos[i].featured = !t.photos[i].featured; rerenderPhotos(); return touch(t.id, 200); }
    if (act === 'remove') return removePhoto(t, i);
    if (act === 'zoom') return openDialog(`<div class="inner"><img class="big" src="${h(thumb(t, t.photos[i].file, 1800))}" alt="${h(t.photos[i].alt || t.photos[i].title)}"><div class="foot"><span class="muted" style="margin-right:auto">${h(t.photos[i].title || t.photos[i].file)}</span><button class="btn primary" type="button" data-close>Close</button></div></div>`, { wide: true });
    if (act === 'hero') {
      try { S.about = (await api('POST', '/api/about/hero-from', { trip: t.id, file: t.photos[i].file })).about; refreshChanges(); toast('This is now the big photo at the top of the home page.'); }
      catch (err) { toast(err.message, { bad: true }); }
      return;
    }
    if (act === 'pick-photos') return addPhotos(t, await pickFiles());
    if (act === 'pick-folder') return addPhotos(t, await pickFiles({ folder: true }));
    if (act === 'delete-trip') return deleteTrip(t);
  }
  if (act === 'pick-hero' || act === 'pick-portrait') return setImage(act.slice(5), (await pickFiles())[0]);
  if (act === 'remove-hero') {
    await flush();
    try {
      const r = await api('DELETE', '/api/about/hero'); S.about = r.about; renderSite(); refreshChanges();
      toast('Removed. The newest trip’s photo is used instead.', r.undo && { action: 'Undo', onAction: async () => {
        try { await api('POST', '/api/undo', r.undo); S.about.hero = 'hero.jpg'; await save('about'); await load({ kind: 'site' }); } catch (err) { toast(err.message, { bad: true }); }
      } });
    } catch (err) { toast(err.message, { bad: true }); }
    return;
  }
  if (act === 'add-roles' || act === 'add-links') {
    const kind = act.slice(4);
    S.about[kind].push(kind === 'roles' ? { role: '', org: '' } : { label: '', url: '' });
    $(`#${kind}`).innerHTML = rowsHtml(kind);
    $(`#${kind} .rowline:last-child input`).focus();
    return;
  }
  if (act === 'del-row') {
    const row = btn.closest('[data-row]');
    S.about[row.dataset.row].splice(Number(row.dataset.i), 1);
    $(`#${row.dataset.row}`).innerHTML = rowsHtml(row.dataset.row);
    return touch('about', 200);
  }
  if (act === 'del-visited') { S.about.alsoVisited.splice(Number(btn.dataset.i), 1); $('#visited').innerHTML = visitedHtml(); return touch('about', 200); }
});

main.addEventListener('submit', (e) => {
  if (e.target.id !== 'visited-form') return;
  e.preventDefault();
  const input = $('#visited-input');
  const name = input.value.trim();
  if (!name) return;
  if (!S.about.alsoVisited.some((v) => plain(typeof v === 'string' ? v : v.name) === plain(name))) S.about.alsoVisited.push(name);
  input.value = '';
  $('#visited').innerHTML = visitedHtml();
  touch('about', 200);
});

// Navigation and top bar
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return go(nav.dataset.nav === 'site' ? { kind: 'site' } : { kind: 'trip', id: nav.dataset.id });
});
$('#new-trip').addEventListener('click', () => newTripDialog());
$('#publish-btn').addEventListener('click', publishDialog);

// ---- dragging: reorder photos, or drop files from the computer ----
let dragFrom = -1;
const isFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

main.addEventListener('dragstart', (e) => {
  const handle = e.target.closest?.('.handle');
  if (!handle) return;
  const card = handle.closest('.photo');
  dragFrom = Number(card.dataset.i);
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragFrom));
  e.dataTransfer.setDragImage(card, 20, 20);
});
main.addEventListener('dragend', () => { dragFrom = -1; $$('.photo').forEach((c) => c.classList.remove('dragging', 'before', 'after')); });
main.addEventListener('dragover', (e) => {
  if (dragFrom < 0) return;
  const card = e.target.closest?.('.photo');
  if (!card) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  const after = e.clientX > r.left + r.width / 2;
  $$('.photo').forEach((c) => c.classList.remove('before', 'after'));
  card.classList.add(after ? 'after' : 'before');
});
main.addEventListener('drop', (e) => {
  if (dragFrom < 0) return;
  const card = e.target.closest?.('.photo');
  const t = currentTrip();
  if (!card || !t) return;
  e.preventDefault();
  let to = Number(card.dataset.i) + (card.classList.contains('after') ? 1 : 0);
  if (dragFrom < to) to--;
  const from = dragFrom;
  dragFrom = -1;
  movePhoto(t, from, to);
});

// Files dragged in from Finder: the whole window is a drop target.
let veilDepth = 0;
const veil = $('#drop-veil');
window.addEventListener('dragenter', (e) => {
  if (!isFiles(e) || dialog.open) return;
  veilDepth++;
  const slot = view.kind === 'site';
  $('#drop-veil-sub').textContent = slot ? 'Drop onto the top photo or the portrait to replace it, or anywhere else to start a new trip.' : currentTrip() ? `They’ll be added to ${currentTrip().country || 'this trip'}.` : 'They’ll start a new trip.';
  veil.hidden = false;
});
window.addEventListener('dragleave', (e) => { if (!isFiles(e)) return; veilDepth = Math.max(0, veilDepth - 1); if (!veilDepth) veil.hidden = true; });
window.addEventListener('dragover', (e) => { if (isFiles(e)) e.preventDefault(); });
window.addEventListener('drop', async (e) => {
  if (!isFiles(e)) return;
  e.preventDefault();
  veilDepth = 0; veil.hidden = true;
  if (dialog.open) return;
  const slot = e.target.closest?.('[data-slot]');
  const files = await filesFromDrop(e.dataTransfer);
  if (slot) return setImage(slot.dataset.slot, photosOnly(files)[0]);
  const t = currentTrip();
  if (t && !t.broken) return addPhotos(t, files);
  return newTripDialog(files);
});

// Leaving the page with unsaved typing: save it first.
window.addEventListener('beforeunload', (e) => { if (pending.size || saving.size || upload) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('focus', () => { if (S) refreshChanges(); });

// ---------------------------------------------------------------- start

async function load(next) {
  try {
    S = await api('GET', '/api/state');
  } catch (e) {
    main.innerHTML = `<div class="empty"><h1>Studio couldn’t start</h1><p class="notice bad">${h(e.message)}</p></div>`;
    $('#save-state').textContent = '';
    return;
  }
  saveError = '';
  setSaveState();
  renderChrome();
  if (next && (next.kind !== 'trip' || S.trips.some((t) => t.id === next.id))) view = next;
  else view = S.trips[0] ? { kind: 'trip', id: S.trips[0].id } : { kind: 'none' };
  renderSide();
  refreshHeaderLinks();
  render();
}

load();
