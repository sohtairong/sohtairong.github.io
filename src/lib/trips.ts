// Turns the raw trip files into what the pages need: sorted, labelled, with defaults filled in.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Trip = CollectionEntry<'trips'>;
export type Photo = Trip['data']['photos'][number] & {
  alt: string;
  /** position in the trip, used for #p-<n> links */ index: number;
  /** the photo's own address within the trip (/places/<trip>/<key>/), taken from its file name so it survives reordering and cropping */ key: string;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "2026-03" → "March 2026", unless the trip sets its own dateLabel. */
export function dateLabel(trip: Trip): string {
  if (trip.data.dateLabel) return trip.data.dateLabel;
  const [y, m] = trip.data.date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** The file names of a trip's photos, read straight from its index.md (the loaded entry no longer has them). */
function fileNames(trip: Trip): string[] {
  try {
    const md = fs.readFileSync(path.resolve(trip.filePath ?? `src/content/trips/${trip.id}/index.md`), 'utf8');
    const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '';
    const photos = (YAML.parse(head)?.photos ?? []) as { src?: string; original?: string }[];
    return photos.map((p) => path.basename(String(p.original ?? p.src ?? '')).replace(/\.[a-z0-9]+$/i, ''));
  } catch { return []; }
}

// File names exported from Photos are long codes (0a366f0c-30a5-41d6-…); their first eight characters are enough.
const slug = (s: string) => {
  const clean = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(clean) ? clean.slice(0, 8) : clean;
};

export function photosOf(trip: Trip): Photo[] {
  const names = fileNames(trip);
  const used = new Set<string>();
  return trip.data.photos.map((p, index) => {
    let key = slug(names[index] ?? '') || `photo-${index + 1}`;
    if (used.has(key)) key = `${key}-${index + 1}`;
    used.add(key);
    return { key, ...rest(p, index) };
  });

  function rest(p: Trip['data']['photos'][number], index: number) { return {
    ...p,
    index,
    alt: p.alt || [p.title, p.city ?? trip.data.country].filter(Boolean).join(', ') || `Photo from ${trip.data.country}`,
  }; }
}

/** Photos for the home-page carousel: the featured ones, or the first six if none are featured. */
export function featuredOf(trip: Trip, fallback = 6): Photo[] {
  const all = photosOf(trip);
  const picked = all.filter((p) => p.featured);
  return picked.length ? picked : all.slice(0, fallback);
}

/** All published trips (not hidden, at least one photo), newest first. */
export async function getTrips(): Promise<Trip[]> {
  const trips = await getCollection('trips', (t) => !t.data.draft && t.data.photos.length > 0);
  return trips.sort((a, b) => b.data.date.localeCompare(a.data.date));
}
