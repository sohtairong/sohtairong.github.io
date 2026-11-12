// Works out the tiled (Pinterest-style) layout of a trip page at build time.
// Each photo keeps its own shape; photos go into whichever column is shortest,
// so the page reads left to right and stays compact even with many tall photos.
import type { Photo } from './trips';

/** A column is this many grid rows wide, so a square photo is UNIT rows tall. */
export const UNIT = 24;
/** The gap between tiles, in grid rows. */
export const GAP = 1;

export interface Slot { col: number; row: number; cols: number; rows: number }

const ratioOf = (p: Photo) => Math.min(2.4, Math.max(0.5, p.src.width / p.src.height));

/** Places the photos into `columns` columns. Returns one slot per photo, in the same order. */
export function pack(photos: Photo[], columns: number): Slot[] {
  const height = new Array(columns).fill(0); // rows used so far in each column
  const last: (Slot & { own: number } | undefined)[] = new Array(columns).fill(undefined);
  const slots: Slot[] = new Array(photos.length);
  const waiting: number[] = []; // large photos that haven't found a level spot yet

  // A large photo sits across two neighbouring columns. They are rarely the same height, so the
  // photo above it in the shorter column grows to meet it. `force` allows any amount of growing.
  const placeLarge = (i: number, force: boolean): boolean => {
    let best = -1, bestTop = Infinity;
    for (let c = 0; c < columns - 1; c++) {
      const top = Math.max(height[c], height[c + 1]);
      const short = height[c] < height[c + 1] ? c : c + 1, grow = top - height[short], above = last[short];
      // Growing a photo by more than a quarter of its height would crop it too much.
      const ok = grow === 0 || (above && above.cols === 1 && above.rows + grow <= above.own * 1.25);
      if ((ok || force) && top < bestTop) { best = c; bestTop = top; }
    }
    if (best < 0) return false;
    for (const c of [best, best + 1]) { const above = last[c]; if (above && above.cols === 1) above.rows += bestTop - height[c]; }
    const rows = Math.round((2 * UNIT + GAP) / ratioOf(photos[i])) + GAP;
    const slot = { col: best, row: bestTop, cols: 2, rows, own: rows };
    slots[i] = slot; height[best] = height[best + 1] = bestTop + rows; last[best] = last[best + 1] = slot;
    return true;
  };

  photos.forEach((p, i) => {
    if (p.layout === 'wide' && columns > 1) {
      // If there's no level spot yet, the photo waits a turn or two while smaller ones fill in.
      if (waiting.length || !placeLarge(i, false)) waiting.push(i);
      return;
    }
    const col = height.indexOf(Math.min(...height));
    const rows = Math.round(UNIT / ratioOf(p)) + GAP;
    const slot = { col, row: height[col], cols: 1, rows, own: rows };
    slots[i] = slot; height[col] += rows; last[col] = slot;
    while (waiting.length && placeLarge(waiting[0], false)) waiting.shift();
  });
  for (const i of waiting) placeLarge(i, true);
  return slots.map(({ col, row, cols, rows }) => ({ col, row, cols, rows }));
}
