// Reads and writes the site's content files (trips and about.md) for Studio.
// The files stay ordinary Markdown with a YAML header, so editing by hand still works.
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { slugify } from './photos.mjs';

export const ROOT = process.cwd();
export const CONTENT = path.join(ROOT, 'src/content');
export const TRIPS = path.join(CONTENT, 'trips');
export const TRASH = path.join(ROOT, '.studio-trash');

const TRIP_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$/i;
export const validTripId = (id) => TRIP_ID.test(id);
export const validFileName = (f) => FILE_NAME.test(f) && !f.includes('..');
export const validDate = (d) => /^\d{4}-(0[1-9]|1[0-2])$/.test(d);

const exists = (p) => fs.access(p).then(() => true, () => false);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function split(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  if (!m) return { data: {}, body: md };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2] };
}

function join(data, body, note) {
  const yaml = YAML.stringify(data, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' });
  return `---\n${note ? `# ${note}\n` : ''}${yaml}---\n\n${body.trim()}\n`;
}

// ---------- trips ----------

function normaliseTrip(id, data, body) {
  const photos = Array.isArray(data.photos) ? data.photos : [];
  return {
    id,
    country: str(data.country),
    cities: Array.isArray(data.cities) ? data.cities.map(str).filter(Boolean) : [],
    date: str(data.date),
    dateLabel: str(data.dateLabel),
    draft: data.draft === true,
    map: data.map && typeof data.map.lat === 'number' && typeof data.map.lng === 'number' ? { lat: data.map.lat, lng: data.map.lng } : null,
    intro: body.trim(),
    photos: photos
      .filter((p) => p && typeof p.src === 'string')
      .map((p) => ({
        file: path.basename(p.src),
        title: str(p.title),
        story: str(p.story),
        city: str(p.city),
        alt: str(p.alt),
        featured: p.featured === true,
        layout: p.layout === 'wide' || p.layout === 'pair' ? p.layout : '',
      })),
  };
}

export async function readTrip(id) {
  if (!validTripId(id)) throw new Error('Unknown trip');
  const md = await fs.readFile(path.join(TRIPS, id, 'index.md'), 'utf8');
  const { data, body } = split(md);
  return normaliseTrip(id, data, body);
}

export async function listTrips() {
  const ids = (await fs.readdir(TRIPS, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory() && validTripId(d.name)).map((d) => d.name);
  const trips = [];
  for (const id of ids) {
    try { trips.push(await readTrip(id)); }
    catch (e) { trips.push({ id, broken: String(e.message || e), country: id, cities: [], date: '', dateLabel: '', draft: false, map: null, intro: '', photos: [] }); }
  }
  return trips.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Saves a trip. Returns its id, which changes if the country or month changed. */
export async function writeTrip(id, trip) {
  if (!validTripId(id)) throw new Error('Unknown trip');
  const country = str(trip.country).trim();
  if (!country) throw new Error('A trip needs a country or place name.');
  if (!validDate(str(trip.date))) throw new Error('The month must look like 2026-03.');

  const data = { country, cities: (trip.cities ?? []).map((c) => str(c).trim()).filter(Boolean), date: trip.date };
  if (str(trip.dateLabel).trim()) data.dateLabel = str(trip.dateLabel).trim();
  if (trip.map && Number.isFinite(trip.map.lat) && Number.isFinite(trip.map.lng)) data.map = { lat: trip.map.lat, lng: trip.map.lng };
  data.draft = trip.draft === true;
  data.photos = (trip.photos ?? []).filter((p) => validFileName(str(p.file))).map((p) => {
    const out = { src: `./photos/${p.file}`, title: str(p.title).trim(), story: str(p.story).trim() };
    if (str(p.city).trim()) out.city = str(p.city).trim();
    if (str(p.alt).trim()) out.alt = str(p.alt).trim();
    out.featured = p.featured === true;
    if (p.layout === 'wide' || p.layout === 'pair') out.layout = p.layout;
    return out;
  });

  // The folder is named <month>-<place>, so it follows the country and month.
  let newId = `${data.date}-${slugify(country) || 'trip'}`;
  if (newId !== id) {
    for (let n = 2; await exists(path.join(TRIPS, newId)); n++) newId = `${data.date}-${slugify(country) || 'trip'}-${n}`;
    await fs.rename(path.join(TRIPS, id), path.join(TRIPS, newId));
  }
  await fs.mkdir(path.join(TRIPS, newId, 'photos'), { recursive: true });
  await fs.writeFile(path.join(TRIPS, newId, 'index.md'), join(data, str(trip.intro), 'Edited with Studio. Editing this file by hand still works.'));
  return newId;
}

export async function createTrip({ country, date }) {
  if (!str(country).trim()) throw new Error('A trip needs a country or place name.');
  if (!validDate(str(date))) throw new Error('The month must look like 2026-03.');
  const base = `${date}-${slugify(country) || 'trip'}`;
  let id = base;
  for (let n = 2; await exists(path.join(TRIPS, id)); n++) id = `${base}-${n}`;
  await fs.mkdir(path.join(TRIPS, id, 'photos'), { recursive: true });
  await fs.writeFile(path.join(TRIPS, id, 'index.md'), join({ country: country.trim(), cities: [], date, draft: false, photos: [] }, '', 'Edited with Studio. Editing this file by hand still works.'));
  return id;
}

// ---------- trash (so removals can be undone) ----------

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function trashPath(from, label) {
  await fs.mkdir(TRASH, { recursive: true });
  const to = path.join(TRASH, `${stamp()}__${label}`);
  await fs.rename(from, to);
  return path.basename(to);
}

export async function restoreFromTrash(token, to) {
  if (!/^[A-Za-z0-9_.-]+$/.test(token)) throw new Error('Nothing to restore');
  if (await exists(to)) throw new Error('Something with that name already exists.');
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(path.join(TRASH, token), to);
}

// ---------- about ----------

export async function readAbout() {
  const md = await fs.readFile(path.join(CONTENT, 'about.md'), 'utf8');
  const { data, body } = split(md);
  return {
    name: str(data.name),
    headline: str(data.headline),
    intro: str(data.intro),
    hero: typeof data.hero === 'string' && (await exists(path.join(CONTENT, data.hero))) ? path.basename(data.hero) : '',
    heroCaption: str(data.heroCaption),
    portrait: typeof data.portrait === 'string' && (await exists(path.join(CONTENT, data.portrait))) ? path.basename(data.portrait) : '',
    portraitCaption: str(data.portraitCaption),
    email: str(data.email),
    instagram: str(data.instagram),
    alsoVisited: Array.isArray(data.alsoVisited)
      ? data.alsoVisited.filter((v) => typeof v === 'string' || (v && typeof v.name === 'string'))
      : [],
    roles: Array.isArray(data.roles) ? data.roles.map((r) => ({ role: str(r?.role), org: str(r?.org) })) : [],
    links: Array.isArray(data.links) ? data.links.map((l) => ({ label: str(l?.label), url: str(l?.url) })) : [],
    bio: body.trim(),
  };
}

const isUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };

export async function writeAbout(a) {
  if (!str(a.name).trim()) throw new Error('Your name can’t be empty.');
  if (!str(a.headline).trim()) throw new Error('The headline can’t be empty.');
  const data = { name: a.name.trim(), headline: a.headline.trim(), intro: str(a.intro).trim() };
  if (a.hero && (await exists(path.join(CONTENT, 'hero.jpg')))) data.hero = './hero.jpg';
  if (str(a.heroCaption).trim()) data.heroCaption = a.heroCaption.trim();
  if (await exists(path.join(CONTENT, 'portrait.jpg'))) data.portrait = './portrait.jpg';
  if (str(a.portraitCaption).trim()) data.portraitCaption = a.portraitCaption.trim();
  if (str(a.email).trim()) data.email = a.email.trim();
  if (str(a.instagram).trim()) {
    if (!isUrl(a.instagram.trim())) throw new Error('The Instagram link must be a full address starting with https://');
    data.instagram = a.instagram.trim();
  }
  data.alsoVisited = (a.alsoVisited ?? [])
    .map((v) => (typeof v === 'string' ? v.trim() : v && typeof v.name === 'string' && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? { name: v.name.trim(), lat: v.lat, lng: v.lng } : null))
    .filter(Boolean);
  data.roles = (a.roles ?? []).map((r) => ({ role: str(r.role).trim(), org: str(r.org).trim() })).filter((r) => r.role || r.org);
  data.links = (a.links ?? []).map((l) => ({ label: str(l.label).trim(), url: str(l.url).trim() })).filter((l) => l.label || l.url);
  for (const l of data.links) if (!l.label || !isUrl(l.url)) throw new Error(`The link “${l.label || l.url}” needs a name and a full address starting with https://`);
  await fs.writeFile(path.join(CONTENT, 'about.md'), join(data, str(a.bio), 'Edited with Studio. Editing this file by hand still works.'));
}
