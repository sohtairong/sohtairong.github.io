#!/usr/bin/env node
// Set the big photo behind the top of the home page.
//
//   npm run set-hero -- ~/Desktop/IMG_1234.HEIC --caption "Kyoto, March 2025"
//   npm run set-hero -- src/content/trips/2025-03-japan/photos/img-0412.jpg
//
// Converts HEIC, turns the photo the right way up, resizes it to 3000px on the
// long edge, removes all metadata (including GPS), saves it as src/content/hero.jpg
// and switches it on in src/content/about.md.
// To go back to using the newest trip's photo, delete the "hero:" line in about.md.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const capIdx = args.indexOf('--caption');
const caption = capIdx > -1 ? args[capIdx + 1] : undefined;
const input = args.find((a, i) => !a.startsWith('--') && i !== capIdx + 1);
if (!input) {
  console.log('Usage: npm run set-hero -- <photo> [--caption "Place, Month Year"]');
  process.exit(1);
}
const src = path.resolve(input.replace(/^~(?=$|\/)/, os.homedir()));
const OUT = path.resolve('src/content/hero.jpg');
const ABOUT = path.resolve('src/content/about.md');

let buf;
try { buf = await fs.readFile(src); } catch { console.error(`Can't open ${src}.`); process.exit(1); }
if (/\.(heic|heif)$/i.test(src)) {
  const heicConvert = (await import('heic-convert')).default;
  buf = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.95 }));
}
const out = await sharp(buf)
  .rotate()
  .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(OUT);
if (out.width < out.height) console.warn('Note: this photo is portrait. A landscape photo fills the wide header better.');

// Turn the hero on in about.md (and set the caption if given).
let md = await fs.readFile(ABOUT, 'utf8');
const end = md.indexOf('\n---', 4);
let front = md.slice(0, end);
const setLine = (key, value) => {
  const re = new RegExp(`^#?\\s*${key}:.*$`, 'm');
  const line = `${key}: ${value}`;
  front = re.test(front) ? front.replace(re, line) : front.replace(/^name:.*$/m, (m) => `${m}\n${line}`);
};
setLine('hero', './hero.jpg');
if (caption) setLine('heroCaption', JSON.stringify(caption));
md = front + md.slice(end);
await fs.writeFile(ABOUT, md);

console.log(`Saved src/content/hero.jpg (${out.width}×${out.height}, ${Math.round(out.size / 1024)} KB, location data removed).`);
console.log('Run "npm run dev" to see it.');
