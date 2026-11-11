// Works out the dots for the map: one per place, from your trips plus the
// "alsoVisited" list in about.md (places you've been but haven't posted photos from yet).
import type { CollectionEntry } from 'astro:content';
import { WORLD } from './world';
import type { ImageMetadata } from 'astro';
import { dateLabel, featuredOf, type Trip } from './trips';

/** Rough centre of each country: [latitude, longitude]. Dots sit at country level, never an exact spot.
 *  Missing a country? Add it here, or set `map: { lat, lng }` on the trip. */
const COUNTRIES: Record<string, [number, number]> = {
  argentina: [-34.6, -64.0], australia: [-25.3, 134.5], austria: [47.6, 14.1], belgium: [50.6, 4.6],
  brazil: [-10.8, -52.9], cambodia: [12.6, 104.9], canada: [56.0, -106.0], chile: [-33.5, -70.7],
  china: [35.0, 105.0], croatia: [45.1, 15.4], 'czech republic': [49.8, 15.5], czechia: [49.8, 15.5],
  denmark: [56.0, 10.0], egypt: [26.8, 30.8], finland: [63.0, 26.0], france: [46.6, 2.4],
  germany: [51.1, 10.4], greece: [39.0, 22.0], 'hong kong': [22.3, 114.2], hungary: [47.2, 19.4],
  iceland: [64.9, -18.6], india: [22.0, 79.0], indonesia: [-2.5, 117.5], ireland: [53.2, -8.0],
  italy: [42.8, 12.6], japan: [36.2, 138.3], korea: [36.5, 127.9], 'south korea': [36.5, 127.9],
  laos: [19.9, 102.5], macau: [22.2, 113.5], malaysia: [3.9, 102.2], maldives: [3.2, 73.2],
  mexico: [23.6, -102.5], morocco: [31.8, -7.1], nepal: [28.4, 84.1], netherlands: [52.2, 5.3],
  'new zealand': [-41.5, 172.8], norway: [61.5, 9.5], peru: [-9.2, -75.0], philippines: [12.9, 121.8],
  poland: [52.1, 19.4], portugal: [39.6, -8.0], singapore: [1.35, 103.82], 'south africa': [-30.6, 24.0],
  spain: [40.2, -3.6], 'sri lanka': [7.9, 80.7], sweden: [62.0, 15.0], switzerland: [46.8, 8.2],
  taiwan: [23.7, 121.0], thailand: [15.1, 101.0], turkey: [39.0, 35.2], 'united arab emirates': [24.3, 54.3],
  uae: [24.3, 54.3], uk: [54.0, -2.5], 'united kingdom': [54.0, -2.5], england: [52.5, -1.5],
  scotland: [56.8, -4.2], usa: [39.8, -98.6], 'united states': [39.8, -98.6], vietnam: [16.2, 107.8],
};

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
