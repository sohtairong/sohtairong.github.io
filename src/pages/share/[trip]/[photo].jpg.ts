// The picture shown when a single photo's link is shared (/share/<trip>/<photo>.jpg).
// Link previews are wide (1200 × 630). A plain crop would cut most of a tall photo away, so the whole
// photo is shown in the middle, over a blurred, darkened copy of itself that fills the rest.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getTrips, photoFiles, photosOf } from '../../../lib/trips';

const W = 1200, H = 630;

export async function getStaticPaths() {
  const trips = await getTrips();
  return trips.flatMap((trip) => {
    const files = photoFiles(trip);
    return photosOf(trip).map((p, i) => ({ params: { trip: trip.id, photo: p.key }, props: { file: files[i] } }));
  });
}

export const GET: APIRoute = async ({ props }) => {
  const source = sharp(props.file as string).rotate();
  const backdrop = await source.clone().resize(W, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.62 }).toBuffer();
  const photo = await source.clone().resize(W, H, { fit: 'inside' }).toBuffer();
  const out = await sharp(backdrop).composite([{ input: photo, gravity: 'centre' }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/jpeg' } });
};
