#!/usr/bin/env node
// Studio: a private editor for this site that runs only on your own computer.
// Start it with "npm run studio" (or double-click "Open Studio.command").
// It reads and writes the same files you could edit by hand under src/content/.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  ROOT, CONTENT, TRIPS, listTrips, readTrip, writeTrip, createTrip, readAbout, writeAbout,
  trashPath, restoreFromTrash, validTripId, validFileName, validDate,
} from '../scripts/lib/content.mjs';
import { prepare, takenAt, uniqueName, isImageName } from '../scripts/lib/photos.mjs';

const PORT = Number(process.env.STUDIO_PORT || 4400);
const PREVIEW_PORT = Number(process.env.STUDIO_PREVIEW_PORT || 4321);
const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui');
const MAX_UPLOAD = 80 * 1024 * 1024;

const exists = (p) => fs.access(p).then(() => true, () => false);

// ---------- small helpers ----------

class Problem extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(data);
}

function readBody(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Problem('That file is too large (over 80 MB).', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req, 5 * 1024 * 1024);
  try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new Problem('Could not read that request.'); }
}

function run(cmd, args, { timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, timeout, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr), code: error?.code }));
  });
}

// ---------- images ----------

const thumbCache = new Map();
async function thumbnail(file, width) {
  const stat = await fs.stat(file);
  const key = `${file}|${stat.mtimeMs}|${width}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const data = await sharp(file).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  if (thumbCache.size > 400) thumbCache.delete(thumbCache.keys().next().value);
  thumbCache.set(key, data);
  return data;
}

async function takenNames(dir) {
  return new Set(await fs.readdir(dir).catch(() => []));
}

// ---------- site facts ----------

async function siteUrl() {
  const cfg = await fs.readFile(path.join(ROOT, 'astro.config.mjs'), 'utf8').catch(() => '');
  return /site:\s*['"]([^'"]+)['"]/.exec(cfg)?.[1] ?? '';
}

async function countries() {
  try { return Object.keys(JSON.parse(await fs.readFile(path.join(ROOT, 'src/lib/countries.json'), 'utf8'))); }
  catch { return []; }
}

// ---------- what has changed since the last publish ----------

async function changes() {
  const git = await run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!git.ok) return { git: false, items: [], count: 0, unpushed: 0, remote: '' };
  const status = await run('git', ['status', '--porcelain=v1', '-uall']);
  const trips = new Map((await listTrips()).map((t) => [t.id, t.country]));
  const groups = new Map();
  const bump = (label, kind) => {
    const g = groups.get(label) ?? { label, added: 0, removed: 0, text: false, other: 0 };
    if (kind === 'added') g.added++; else if (kind === 'removed') g.removed++; else if (kind === 'text') g.text = true; else g.other++;
    groups.set(label, g);
  };
  let count = 0;
  for (const line of status.stdout.split('\n')) {
    if (!line.trim()) continue;
    count++;
    const code = line.slice(0, 2);
    const file = line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop();
    const kind = code.includes('D') ? 'removed' : code.includes('?') || code.includes('A') ? 'added' : 'changed';
    const trip = /^src\/content\/trips\/([^/]+)\/(.*)$/.exec(file);
    if (trip) {
      const label = trips.get(trip[1]) ? `${trips.get(trip[1])} (${trip[1].slice(0, 7)})` : `Trip ${trip[1]}`;
      if (trip[2].startsWith('photos/')) bump(label, kind === 'changed' ? 'other' : kind);
      else bump(label, 'text');
    } else if (/^src\/content\/(about\.md|hero\.jpg|portrait\.jpg)$/.test(file)) bump('Home page and About', 'text');
    else bump('Site design and settings', 'other');
  }
  const items = [...groups.values()].map((g) => {
    const parts = [];
    if (g.added) parts.push(`${g.added} photo${g.added > 1 ? 's' : ''} added`);
    if (g.removed) parts.push(`${g.removed} photo${g.removed > 1 ? 's' : ''} removed`);
    if (g.text) parts.push('details edited');
    if (g.other && !parts.length) parts.push(`${g.other} file${g.other > 1 ? 's' : ''} changed`);
    return { label: g.label, detail: parts.join(', ') };
  });
  const ahead = await run('git', ['rev-list', '--count', '@{u}..HEAD']);
  const remote = (await run('git', ['remote', 'get-url', 'origin'])).stdout.trim();
  return { git: true, items, count, unpushed: ahead.ok ? Number(ahead.stdout.trim()) || 0 : 0, remote };
}

function actionsUrl(remote) {
  const m = /github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/.exec(remote);
  return m ? `https://github.com/${m[1]}/${m[2]}/actions` : '';
}

async function publish(note) {
  const steps = [];
  const before = await changes();
  if (!before.git) throw new Problem('This folder isn’t set up with git, so Studio can’t publish from it.');
  if (!before.remote) throw new Problem('This project isn’t connected to GitHub yet. See “Publishing” in the README.');

  if (before.count > 0) {
    const add = await run('git', ['add', '-A']);
    if (!add.ok) throw new Problem(`Couldn’t collect the changes.\n${add.stderr.trim()}`, 500);
    const summary = before.items.map((i) => `${i.label}: ${i.detail}`).join('; ');
    const message = (note || '').trim() || (summary.length > 72 ? 'Update site from Studio' : summary || 'Update site from Studio');
    const commit = await run('git', ['commit', '-m', message, '-m', note?.trim() ? summary : '']);
    if (!commit.ok) {
      const text = commit.stderr + commit.stdout;
      if (/user\.email|user\.name|Please tell me who you are/i.test(text)) {
        throw new Problem('Git doesn’t know your name yet. In Terminal, run:\n  git config --global user.name "Your Name"\n  git config --global user.email "you@example.com"\nthen press Publish again.', 500);
      }
      throw new Problem(`Couldn’t save the changes.\n${text.trim()}`, 500);
    }
    steps.push('Saved your changes');
  }

  const push = await run('git', ['push'], { timeout: 180000 });
  if (!push.ok) {
    const text = (push.stderr + push.stdout).trim();
    let hint = 'Your changes are saved on this computer. Press Publish again to retry.';
    if (/Authentication failed|could not read Username|Permission denied|403/i.test(text)) hint = 'GitHub didn’t accept the login on this computer. Open Terminal in this folder, run “git push” once and sign in, then come back and press Publish.';
    else if (/Could not resolve host|unable to access|timed out|Network is unreachable/i.test(text)) hint = 'Couldn’t reach GitHub. Check your internet connection, then press Publish again. Your changes are saved on this computer.';
    else if (/rejected|non-fast-forward|fetch first/i.test(text)) hint = 'GitHub has changes that this computer doesn’t have. Open Terminal in this folder, run “git pull --rebase”, then press Publish again.';
    else if (/no upstream|has no upstream/i.test(text)) hint = 'This branch isn’t linked to GitHub yet. Open Terminal in this folder and run “git push -u origin main” once.';
    throw new Problem(`${hint}\n\nDetails: ${text.split('\n').slice(-4).join('\n')}`, 502);
  }
  steps.push('Sent to GitHub');
  return { steps, site: await siteUrl(), actions: actionsUrl(before.remote) };
}

// ---------- preview (the real site, running locally) ----------

let previewProcess = null;
let previewStartedHere = false;
let previewBin = '';
let previewLog = '';
const previewUrl = `http://localhost:${PREVIEW_PORT}`;

async function previewRunning() {
  try {
    const r = await fetch(previewUrl, { signal: AbortSignal.timeout(1500) });
    return r.status > 0;
  } catch { return false; }
}

async function startPreview() {
  if (await previewRunning()) return;
  if (previewProcess) return;
  const astro = path.join(ROOT, 'node_modules/astro/bin/astro.mjs');
  const bin = (await exists(astro)) ? astro : path.join(ROOT, 'node_modules/.bin/astro');
  previewBin = bin;
  previewStartedHere = true;
  previewProcess = spawn(process.execPath, [bin, 'dev', '--port', String(PREVIEW_PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const keep = (d) => { previewLog = (previewLog + d.toString()).slice(-6000); };
  previewProcess.stdout.on('data', keep);
  previewProcess.stderr.on('data', keep);
  previewProcess.on('exit', () => { previewProcess = null; });
}

function stopPreview() {
  if (!previewStartedHere) return;   // a preview you started yourself is left alone
  previewStartedHere = false;
  // Astro keeps its dev server running in the background, so ask it to stop.
  try { spawnSync(process.execPath, [previewBin, 'dev', 'stop'], { cwd: ROOT, stdio: 'ignore', timeout: 8000 }); } catch { /* nothing to stop */ }
  if (previewProcess) previewProcess.kill();
}

// ---------- the API ----------

async function state() {
  const [trips, about, change, site, known] = await Promise.all([listTrips(), readAbout(), changes(), siteUrl(), countries()]);
  return { trips, about, changes: change, site, countries: known, preview: previewUrl, actions: actionsUrl(change.remote) };
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // after /api
  const method = req.method;
  const is = (m, ...shape) => method === m && parts.length === shape.length && shape.every((s, i) => s === '*' || s === parts[i]);

  if (is('GET', 'state')) return send(res, 200, await state());
  if (is('GET', 'changes')) return send(res, 200, await changes());
  if (is('GET', 'preview')) return send(res, 200, { running: await previewRunning(), url: previewUrl, log: previewLog.slice(-1500) });

  // Read the month a photo was taken, to pre-fill the "new trip" form.
  if (is('POST', 'probe')) {
    const d = await takenAt(await readBody(req));
    return send(res, 200, { date: d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '' });
  }

  // ---- trips ----
  if (is('POST', 'trips')) {
    const body = await readJson(req);
    const id = await createTrip({ country: body.country, date: body.date });
    if (Array.isArray(body.cities) && body.cities.length) await writeTrip(id, { ...(await readTrip(id)), cities: body.cities });
    return send(res, 200, { trip: await readTrip(id) });
  }
  if (parts[0] === 'trips' && parts[1]) {
    const id = parts[1];
    if (!validTripId(id) || !(await exists(path.join(TRIPS, id, 'index.md')))) throw new Problem('That trip no longer exists.', 404);
    const photoDir = path.join(TRIPS, id, 'photos');

    if (is('PUT', 'trips', '*')) {
      const newId = await writeTrip(id, await readJson(req));
      return send(res, 200, { trip: await readTrip(newId) });
    }
    if (is('DELETE', 'trips', '*')) {
      const token = await trashPath(path.join(TRIPS, id), `trip__${id}`);
      return send(res, 200, { undo: { kind: 'trip', token, id } });
    }
    if (is('POST', 'trips', '*', 'photos')) {
      const name = url.searchParams.get('name') || 'photo.jpg';
      if (!isImageName(name)) throw new Problem(`“${name}” isn’t a photo Studio can use (JPEG, PNG, WebP, HEIC or TIFF).`);
      const raw = await readBody(req);
      const when = await takenAt(raw);
      let out;
      try { out = await prepare(raw, name); }
      catch (e) { throw new Problem(`Couldn’t read “${name}”. If it’s a HEIC photo, export it from Photos as JPEG and try again.\n(${e.message})`, 422); }
      await fs.mkdir(photoDir, { recursive: true });
      const file = uniqueName(name, await takenNames(photoDir));
      await fs.writeFile(path.join(photoDir, file), out.data);
      return send(res, 200, { file, takenAt: when ? when.getTime() : null, width: out.width, height: out.height, kb: Math.round(out.size / 1024) });
    }
    // Crop a photo. The uncropped file is kept beside it so the crop can be changed or undone later.
    if (is('POST', 'trips', '*', 'photos', '*', 'crop') || is('POST', 'trips', '*', 'photos', '*', 'uncrop')) {
      const file = parts[3];
      const trip = await readTrip(id);
      const photo = trip.photos.find((p) => p.file === file);
      if (!photo) throw new Problem('That photo is no longer in this trip. Reload the page.', 404);
      const source = photo.original || photo.file;
      if (!(await exists(path.join(photoDir, source)))) throw new Problem('The original of this photo is missing, so it can’t be cropped again.', 404);
      const wasCropped = Boolean(photo.original);

      if (parts[4] === 'uncrop') {
        if (!wasCropped) return send(res, 200, { file, original: '' });
        photo.file = source; photo.original = '';
      } else {
        const c = await readJson(req);
        const meta = await sharp(path.join(photoDir, source)).metadata();
        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v)));
        const left = Math.round(clamp(c.x, 0, 0.98) * meta.width);
        const top = Math.round(clamp(c.y, 0, 0.98) * meta.height);
        const width = Math.max(50, Math.min(meta.width - left, Math.round(clamp(c.w, 0.02, 1) * meta.width)));
        const height = Math.max(50, Math.min(meta.height - top, Math.round(clamp(c.h, 0.02, 1) * meta.height)));
        if (![left, top, width, height].every(Number.isFinite)) throw new Problem('That crop isn’t valid.');
        const data = await sharp(path.join(photoDir, source)).extract({ left, top, width, height }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
        const name = uniqueName(`${path.basename(source, path.extname(source))}-crop.jpg`, await takenNames(photoDir));
        await fs.writeFile(path.join(photoDir, name), data);
        photo.file = name; photo.original = source;
      }
      await writeTrip(id, trip);
      // The previous cropped version is no longer used.
      if (wasCropped && file !== photo.file && (await exists(path.join(photoDir, file)))) await trashPath(path.join(photoDir, file), `photo__${id}__${file}`);
      return send(res, 200, { file: photo.file, original: photo.original });
    }
    if (is('DELETE', 'trips', '*', 'photos', '*')) {
      const file = parts[3];
      if (!validFileName(file)) throw new Problem('Unknown photo.');
      const from = path.join(photoDir, file);
      if (!(await exists(from))) return send(res, 200, { undo: null });
      const token = await trashPath(from, `photo__${id}__${file}`);
      const undo = { kind: 'photo', token, id, file };
      // A cropped photo also has its uncropped original in the folder; it goes too.
      const original = url.searchParams.get('original');
      if (original && original !== file && validFileName(original) && (await exists(path.join(photoDir, original)))) {
        undo.also = { file: original, token: await trashPath(path.join(photoDir, original), `photo__${id}__${original}`) };
      }
      return send(res, 200, { undo });
    }
  }

  // ---- undo ----
  if (is('POST', 'undo')) {
    const u = await readJson(req);
    if (u.kind === 'trip' && validTripId(u.id)) await restoreFromTrash(u.token, path.join(TRIPS, u.id));
    else if (u.kind === 'photo' && validTripId(u.id) && validFileName(u.file)) {
      await restoreFromTrash(u.token, path.join(TRIPS, u.id, 'photos', u.file));
      if (u.also && validFileName(u.also.file)) await restoreFromTrash(u.also.token, path.join(TRIPS, u.id, 'photos', u.also.file));
    }
    else if (u.kind === 'hero') await restoreFromTrash(u.token, path.join(CONTENT, 'hero.jpg'));
    else throw new Problem('Nothing to undo.');
    return send(res, 200, { ok: true });
  }

  // ---- home page and about ----
  if (is('PUT', 'about')) {
    await writeAbout(await readJson(req));
    return send(res, 200, { about: await readAbout() });
  }
  if (is('POST', 'about', 'hero') || is('POST', 'about', 'portrait')) {
    const which = parts[1];
    const name = url.searchParams.get('name') || 'photo.jpg';
    if (!isImageName(name)) throw new Problem(`“${name}” isn’t a photo Studio can use.`);
    let out;
    try { out = await prepare(await readBody(req), name, which === 'hero' ? { maxEdge: 3000, quality: 84 } : { maxEdge: 1600 }); }
    catch (e) { throw new Problem(`Couldn’t read “${name}”. If it’s a HEIC photo, export it from Photos as JPEG and try again.\n(${e.message})`, 422); }
    await fs.writeFile(path.join(CONTENT, `${which}.jpg`), out.data);
    const about = await readAbout();
    await writeAbout({ ...about, hero: which === 'hero' ? 'hero.jpg' : about.hero });
    return send(res, 200, { about: await readAbout(), portraitShape: out.width >= out.height ? 'wide' : 'tall' });
  }
  if (is('POST', 'about', 'hero-from')) {
    const { trip, file } = await readJson(req);
    if (!validTripId(trip) || !validFileName(file)) throw new Problem('Unknown photo.');
    await fs.copyFile(path.join(TRIPS, trip, 'photos', file), path.join(CONTENT, 'hero.jpg'));
    const about = await readAbout();
    await writeAbout({ ...about, hero: 'hero.jpg' });
    return send(res, 200, { about: await readAbout() });
  }
  if (is('DELETE', 'about', 'hero')) {
    const from = path.join(CONTENT, 'hero.jpg');
    const token = (await exists(from)) ? await trashPath(from, 'hero.jpg') : null;
    const about = await readAbout();
    await writeAbout({ ...about, hero: '' });
    return send(res, 200, { about: await readAbout(), undo: token ? { kind: 'hero', token } : null });
  }

  // ---- publish ----
  if (is('POST', 'publish')) {
    const { note } = await readJson(req);
    return send(res, 200, await publish(note));
  }

  throw new Problem('Not found', 404);
}

// ---------- static files and photos ----------

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

async function serveUi(res, name) {
  const file = path.join(UI, name);
  if (!file.startsWith(UI + path.sep)) throw new Problem('Not found', 404);
  const data = await fs.readFile(file).catch(() => null);
  if (!data) throw new Problem('Not found', 404);
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(data);
}

async function serveMedia(res, url) {
  // /media/trips/<id>/<file>, /media/hero.jpg, /media/portrait.jpg  (?w=480 for a small version)
  const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  let file;
  if (parts[0] === 'trips' && parts.length === 3 && validTripId(parts[1]) && validFileName(parts[2])) file = path.join(TRIPS, parts[1], 'photos', parts[2]);
  else if (parts.length === 1 && (parts[0] === 'hero.jpg' || parts[0] === 'portrait.jpg')) file = path.join(CONTENT, parts[0]);
  if (!file || !(await exists(file))) throw new Problem('Not found', 404);
  const width = Math.min(2400, Math.max(80, Number(url.searchParams.get('w')) || 480));
  res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' });
  res.end(await thumbnail(file, width));
}

// ---------- the server ----------

const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const server = http.createServer(async (req, res) => {
  try {
    // Studio only answers this computer. Other websites can't send it commands:
    // every change must carry a header that browsers won't let another site add.
    if (!LOCAL_HOSTS.has(req.headers.host ?? '')) throw new Problem('Studio only runs on this computer.', 403);
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method !== 'GET' && req.headers['x-studio'] !== '1') throw new Problem('Blocked.', 403);

    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET') throw new Problem('Not found', 404);
    if (url.pathname.startsWith('/media/')) return await serveMedia(res, url);
    if (url.pathname === '/') return await serveUi(res, 'index.html');
    return await serveUi(res, url.pathname.slice(1));
  } catch (e) {
    const status = e instanceof Problem ? e.status : 500;
    if (status === 500) console.error(e);
    send(res, status, { error: e.message || 'Something went wrong.' });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\nStudio is already open at http://localhost:${PORT}\n`);
    openBrowser();
    process.exit(0);
  }
  throw e;
});

function openBrowser() {
  if (process.env.STUDIO_NO_OPEN) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', `http://localhost:${PORT}`] : [`http://localhost:${PORT}`];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n  Studio is running:  http://localhost:${PORT}`);
  console.log(`  Site preview:       ${previewUrl}`);
  console.log('\n  Leave this window open while you work. Close it (or press Ctrl+C) when you’re done.\n');
  if (!process.env.STUDIO_NO_PREVIEW) await startPreview();
  openBrowser();
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stopPreview(); process.exit(0); });
process.on('exit', stopPreview);
