// The list of pages for search engines: the home page and one entry per trip.
// (Each photo's own address is left out on purpose; it shows the same page as its trip.)
import type { APIRoute } from 'astro';
import { getTrips } from '../lib/trips';

export const GET: APIRoute = async ({ site }) => {
  const trips = await getTrips();
  const urls = ['/', ...trips.map((t) => `/places/${t.id}/`)].map((p) => new URL(p, site).href);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
