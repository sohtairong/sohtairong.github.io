// Shared photo handling for the import tool, the hero tool and Studio.
// Every photo that enters the site goes through prepare(): HEIC → JPEG, turned the
// right way up, resized, and stripped of ALL metadata (including GPS location).
import path from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

export const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);

export const isImageName = (name) => IMAGE_EXT.has(path.extname(name).toLowerCase()) && !path.basename(name).startsWith('.');

export const slugify = (s) =>
  String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** When the photo was taken, from its own data. Returns a Date or null. Call BEFORE prepare(). */
export async function takenAt(buffer) {
  try {
    const exif = await exifr.parse(buffer, ['DateTimeOriginal', 'CreateDate']);
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

let heicConvert;
/** Returns a web-ready JPEG: { data, width, height, size }. */
export async function prepare(buffer, originalName, { maxEdge = 2400, quality = 82 } = {}) {
  let input = buffer;
  if (/\.(heic|heif)$/i.test(originalName)) {
    heicConvert ??= (await import('heic-convert')).default;
    input = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.95 }));
  }
  // sharp drops all metadata (EXIF, GPS) unless asked to keep it. We never ask.
  const out = await sharp(input)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height, size: out.info.size };
}

/** A file name that isn't taken yet: img-0412.jpg, img-0412-2.jpg, … */
export function uniqueName(originalName, taken) {
  const base = slugify(path.basename(originalName, path.extname(originalName))) || 'photo';
  let name = `${base}.jpg`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}.jpg`;
  taken.add(name);
  return name;
}
