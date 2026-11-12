#!/usr/bin/env node
// Import a folder of photos as a trip (or add more photos to an existing trip).
//
//   npm run add-trip -- ~/Desktop/usa-export --country USA
//   npm run add-trip -- ~/Desktop/more-japan --country Japan --date 2025-03   (adds to the existing trip)
//
// Options:
//   --country  <name>     Country or place name shown on the site (asked for if left out)
//   --date     <YYYY-MM>  Trip month. Default: read from the photos' capture dates
//   --city     <name>     City to pre-fill on every photo (you can edit each one later)
//   --slug     <name>     Folder name suffix. Default: the country, lower-case
//   --max      <px>       Longest edge of the saved photo. Default: 2400
//   --featured <n>        How many photos to mark for the home-page carousel. Default: 6
//
// What it does to every photo:
//   • converts HEIC/HEIF (iPhone) to JPEG
//   • turns it the right way up, resizes it to --max px, saves at web quality
//   • removes ALL metadata, including GPS location
//   • writes an entry in the trip's index.md for you to fill in a title and story

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import sharp from 'sharp';
import exifr from 'exifr';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);
const TRIPS_DIR = path.resolve('src/content/trips');

// ---------- arguments ----------
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1]?.startsWith('--') ? true : args[++i];
  else positional.push(args[i]);
}
if (!positional[0] || flags.help) {
  console.log('Usage: npm run add-trip -- <folder of photos> --country <name> [--date YYYY-MM] [--city <name>]');
  process.exit(positional[0] ? 0 : 1);
}
const source = path.resolve(positional[0].replace(/^~(?=$|\/)/, os.homedir()));
const maxEdge = Number(flags.max ?? 2400);
const featuredCount = Number(flags.featured ?? 6);

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer;
}

const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const yamlStr = (s) => JSON.stringify(s ?? ''); // JSON strings are valid YAML strings

// ---------- read the source folder ----------
let entries;
try {
  entries = await fs.readdir(source);
} catch {
  console.error(`Can't open ${source}. Check the folder path.`);
  process.exit(1);
}
const files = entries.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()) && !f.startsWith('.'));
if (!files.length) {
  console.error(`No photos found in ${source} (looked for ${[...IMAGE_EXT].join(', ')}).`);
  process.exit(1);
}

// Read capture dates so photos are ordered as you took them.
const photos = [];
for (const f of files) {
  const full = path.join(source, f);
  let taken;
  try {
    const exif = await exifr.parse(full, ['DateTimeOriginal', 'CreateDate']);
    taken = exif?.DateTimeOriginal ?? exif?.CreateDate;
  } catch { /* no EXIF: fall back to file time */ }
  if (!(taken instanceof Date)) taken = (await fs.stat(full)).mtime;
  photos.push({ file: f, full, taken });
}
photos.sort((a, b) => a.taken - b.taken);

// ---------- trip details ----------
const country = flags.country || (await ask('Country or place name (as it should appear on the site): '));
if (!country) { console.error('A country/place name is needed.'); process.exit(1); }
const first = photos[0].taken;
const date = flags.date || `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) { console.error('--date must look like 2026-03'); process.exit(1); }
const tripId = `${date}-${slugify(flags.slug || country)}`;
const tripDir = path.join(TRIPS_DIR, tripId);
const photoDir = path.join(tripDir, 'photos');
const indexPath = path.join(tripDir, 'index.md');
await fs.mkdir(photoDir, { recursive: true });

const existing = await fs.readFile(indexPath, 'utf8').catch(() => null);
const usedNames = new Set(await fs.readdir(photoDir));

// ---------- convert each photo ----------
let heicConvert;
const written = [];
for (const p of photos) {
  const ext = path.extname(p.file).toLowerCase();
  let base = slugify(path.basename(p.file, path.extname(p.file))) || 'photo';
  let name = `${base}.jpg`;
  for (let n = 2; usedNames.has(name); n++) name = `${base}-${n}.jpg`;
  usedNames.add(name);

  let input = await fs.readFile(p.full);
  if (ext === '.heic' || ext === '.heif') {
    heicConvert ??= (await import('heic-convert')).default;
    input = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 0.95 }));
  }
  // sharp drops all metadata (EXIF, GPS) unless asked to keep it — we don't.
  const out = await sharp(input)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await fs.writeFile(path.join(photoDir, name), out.data);
  written.push({ name, kb: Math.round(out.info.size / 1024) });
  process.stdout.write(`  ✓ ${p.file} → photos/${name} (${out.info.width}×${out.info.height}, ${Math.round(out.info.size / 1024)} KB)\n`);
}

// ---------- write index.md ----------
const alreadyFeatured = existing ? (existing.match(/featured:\s*true/g) || []).length : 0;
const photoYaml = written.map((w, i) => [
  `  - src: ./photos/${w.name}`,
  `    title: ""`,
  `    story: ""`,
  `    city: ${yamlStr(flags.city || '')}`,
  `    featured: ${alreadyFeatured + i < featuredCount}`,
].join('\n')).join('\n');

if (existing) {
  // Append to the photos list at the end of the existing frontmatter.
  const end = existing.indexOf('\n---', 4);
  if (end === -1) { console.error(`Couldn't read the frontmatter in ${indexPath}.`); process.exit(1); }
  const updated = existing.slice(0, end).replace(/\s*$/, '') + '\n' + photoYaml + existing.slice(end);
  await fs.writeFile(indexPath, updated);
  console.log(`\nAdded ${written.length} photos to ${path.relative(process.cwd(), indexPath)}`);
} else {
  const cities = flags.city ? `[${yamlStr(flags.city)}]` : '[]';
  const md = `---
country: ${yamlStr(country)}
cities: ${cities}            # e.g. ["New York", "Boston"]
date: "${date}"
# dateLabel: "Home, ongoing"   # optional: replaces "Month Year" on the site
# map: { lat: 35.01, lng: 135.77 }   # optional: move this trip's dot on the map (default: centre of the country)
draft: false
# Each photo: title + story show under it. featured: true puts it in the home-page carousel.
# Keep text inside the double quotes. For a double quote inside the text, write \\" .
# layout: wide makes a photo a large tile (two columns) on the trip page.
photos:
${photoYaml}
---

A short paragraph about the trip: why you went, how long you stayed, what the place felt like.
`;
  await fs.writeFile(indexPath, md);
  console.log(`\nCreated trip ${tripId} with ${written.length} photos.`);
}

const total = written.reduce((s, w) => s + w.kb, 0);
console.log(`Saved ${(total / 1024).toFixed(1)} MB of web-ready photos (all location data removed).`);
console.log(`\nNext: open ${path.relative(process.cwd(), indexPath)}, fill in titles and stories, then run "npm run dev" to preview.`);
