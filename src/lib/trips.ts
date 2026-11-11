// Turns the raw trip files into what the pages need: sorted, labelled, with defaults filled in.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Trip = CollectionEntry<'trips'>;
export type Photo = Trip['data']['photos'][number] & { alt: string; /** position in the trip, used for #p-<n> links */ index: number };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** "2026-03" → "March 2026", unless the trip sets its own dateLabel. */
export function dateLabel(trip: Trip): string {
  if (trip.data.dateLabel) return trip.data.dateLabel;
  const [y, m] = trip.data.date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function photosOf(trip: Trip): Photo[] {
  return trip.data.photos.map((p, index) => ({
    ...p,
    index,
    alt: p.alt || [p.title, p.city ?? trip.data.country].filter(Boolean).join(', ') || `Photo from ${trip.data.country}`,
  }));
}

/** Photos for the home-page carousel: the featured ones, or the first six if none are featured. */
export function featuredOf(trip: Trip, fallback = 6): Photo[] {
  const all = photosOf(trip);
  const picked = all.filter((p) => p.featured);
  return picked.length ? picked : all.slice(0, fallback);
}

/** All published trips, newest first. */
export async function getTrips(): Promise<Trip[]> {
  const trips = await getCollection('trips', (t) => !t.data.draft);
  return trips.sort((a, b) => b.data.date.localeCompare(a.data.date));
}

/** Groups photos into rows for the trip page: one wide photo, or two side by side. */
export function rowsOf(trip: Trip): Photo[][] {
  const photos = photosOf(trip);
  const rows: Photo[][] = [];
  let i = 0;
  let nextWide = true; // automatic rhythm: wide, pair, wide, pair…
  while (i < photos.length) {
    const p = photos[i];
    const wide = p.layout ? p.layout === 'wide' : nextWide;
    const partner = photos[i + 1];
    if (!wide && partner && partner.layout !== 'wide') {
      rows.push([p, partner]);
      i += 2;
    } else {
      rows.push([p]);
      i += 1;
    }
    nextWide = rows[rows.length - 1].length === 2;
  }
  return rows;
}
