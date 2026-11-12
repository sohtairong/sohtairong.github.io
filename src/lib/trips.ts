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

/** All published trips (not hidden, at least one photo), newest first. */
export async function getTrips(): Promise<Trip[]> {
  const trips = await getCollection('trips', (t) => !t.data.draft && t.data.photos.length > 0);
  return trips.sort((a, b) => b.data.date.localeCompare(a.data.date));
}
