// Works out the dots for the map: one per place, from your trips plus the
// "alsoVisited" list in about.md (places you've been but haven't posted photos from yet).
import type { CollectionEntry } from 'astro:content';
import { WORLD } from './world';
import countries from './countries.json';
import type { ImageMetadata } from 'astro';
import { dateLabel, featuredOf, type Trip } from './trips';

/** Rough centre of each country: [latitude, longitude], in countries.json next to this file.
 *  Dots sit at country level, never an exact spot.
 *  Missing a country? Add it there, or set `map: { lat, lng }` on the trip. */
const COUNTRIES = countries as unknown as Record<string, [number, number]>;

export interface Place {
  /** Short id used to link a dot to its row in the list. */
  id: string;
  name: string;
  /** Number of photos, when a trip exists. */
  count?: number;
  /** Photo shown in the small preview when the place is hovered. */
  cover?: ImageMetadata;
  x: number;
  y: number;
  /** Trip page to open, when photos are up. */
  href?: string;
  /** e.g. "March 2025", or "Photos coming" */
  note: string;
}

const slug = (k: string) => k.replace(/[^a-z0-9]+/g, '-');
const key = (name: string) => name.replace(/[\[\]]/g, '').trim().toLowerCase();

function project(lat: number, lng: number) {
  return {
    x: +(((lng + 180) / 360) * WORLD.width).toFixed(1),
    y: +(((WORLD.latTop - lat) / (WORLD.latTop - WORLD.latBottom)) * WORLD.height).toFixed(1),
  };
}

function locate(name: string, override?: { lat: number; lng: number }) {
  if (override) return project(override.lat, override.lng);
  const hit = COUNTRIES[key(name)];
  if (hit) return project(hit[0], hit[1]);
  console.warn(`[map] No position known for "${name}". Add "map: { lat: …, lng: … }" to show it on the map.`);
  return undefined;
}

/** `trips` must be newest first, so a country visited twice links to the latest trip. */
export function placesFor(trips: Trip[], about: CollectionEntry<'about'>): Place[] {
  const places = new Map<string, Place>();
  for (const trip of trips) {
    const k = key(trip.data.country);
    if (places.has(k)) continue;
    const at = locate(trip.data.country, trip.data.map);
    if (!at) continue;
    places.set(k, {
      id: slug(k), name: trip.data.country, ...at,
      href: `/places/${trip.id}/`, note: dateLabel(trip),
      count: trip.data.photos.length, cover: featuredOf(trip)[0]?.src,
    });
  }
  for (const entry of about.data.alsoVisited) {
    const name = typeof entry === 'string' ? entry : entry.name;
    const k = key(name);
    if (places.has(k)) continue; // a trip for it exists now
    const at = locate(name, typeof entry === 'string' ? undefined : entry);
    if (at) places.set(k, { id: slug(k), name, ...at, note: 'Photos coming' });
  }
  return [...places.values()];
}
