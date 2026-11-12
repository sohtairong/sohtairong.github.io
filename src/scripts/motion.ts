import { navigate } from 'astro:transitions/client';
// Site-wide motion. Runs once and keeps working across page transitions.
//
// 1. Photo morph: clicking a carousel photo grows it into the same photo on the trip page.
// 2. Arrival motion: [data-reveal] elements fade in as they scroll into view.
// 5. Smooth scrolling: the page glides to a stop instead of moving in steps.
// 6. Teleport: clicking a place on the atlas zooms the map into it, then opens the trip (end of this file).

const MORPH = 'photo-morph';
let pendingTarget: string | null = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clearMorph() {
  document.querySelectorAll<HTMLElement>('[data-morphing]').forEach((el) => {
    el.style.viewTransitionName = '';
    el.removeAttribute('data-morphing');
  });
}

function tag(el: HTMLElement | null) {
  if (!el) return;
  el.style.viewTransitionName = MORPH;
  el.setAttribute('data-morphing', '');
}

// --- 1. Photo morph ---------------------------------------------------------
document.addEventListener('click', (e) => {
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-morph]');
  if (!link || reducedMotion()) return;
  clearMorph();
  tag(link.querySelector('img'));
  pendingTarget = new URL(link.href).hash || null;
});

document.addEventListener('astro:after-swap', () => {
  document.documentElement.classList.add('js');
  if (!pendingTarget) return;
  const figure = document.querySelector<HTMLElement>(pendingTarget);
  pendingTarget = null;
  if (!figure) return;
  // Make sure the destination photo is fully visible before the browser takes its snapshot.
  const reveal = figure.closest<HTMLElement>('[data-reveal]');
  reveal?.classList.add('in', 'no-anim');
  figure.scrollIntoView({ block: 'start', behavior: 'instant' });
  tag(figure.querySelector('img'));
});

// --- 2. Arrival motion ------------------------------------------------------
let observer: IntersectionObserver | undefined;

function watchReveals() {
  observer?.disconnect();
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)');
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  items.forEach((el) => observer!.observe(el));
}

document.addEventListener('astro:page-load', () => {
  clearMorph();
  watchReveals();
});

// --- 3. Light / dark switch ---------------------------------------------------
// Follows the device setting until the visitor picks a mode; the choice is remembered.
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme(): 'light' | 'dark' {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'light' || set === 'dark') return set;
  return systemDark.matches ? 'dark' : 'light';
}

function labelToggles() {
  const next = currentTheme() === 'dark' ? 'Light' : 'Dark';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
    btn.textContent = next;
    btn.setAttribute('aria-label', `Switch to ${next.toLowerCase()} mode`);
  });
}

document.addEventListener('click', (e) => {
  if (!(e.target as Element | null)?.closest('[data-theme-toggle]')) return;
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    document.documentElement.setAttribute('data-theme', next);
    labelToggles();
  };
  try { localStorage.setItem('theme', next); } catch { /* private window: the choice lasts for this visit only */ }
  // Crossfade between the themes where the browser supports it.
  const start = (document as any).startViewTransition?.bind(document);
  if (start && !reducedMotion()) start(apply); else apply();
});

systemDark.addEventListener('change', labelToggles);
document.addEventListener('astro:page-load', labelToggles);

// --- 4. Atlas: link each dot on the map to its row in the list -------------------
// Pointing at (or tabbing to) either one lights up both, and shows the photo preview.
function setActivePlace(atlas: Element, id: string | null) {
  atlas.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  if (id) atlas.querySelectorAll(`[data-place="${CSS.escape(id)}"]`).forEach((el) => el.classList.add('is-active'));
}

function placeFrom(target: EventTarget | null) {
  const el = (target as Element | null)?.closest?.('[data-place]');
  const atlas = el?.closest('[data-atlas]');
  return el && atlas ? { atlas, id: el.getAttribute('data-place') } : null;
}

for (const type of ['pointerover', 'focusin'] as const) {
  document.addEventListener(type, (e) => {
    const hit = placeFrom(e.target);
    if (hit) setActivePlace(hit.atlas, hit.id);
  });
}
for (const type of ['pointerout', 'focusout'] as const) {
  document.addEventListener(type, (e) => {
    const from = placeFrom(e.target);
    if (!from) return;
    const to = placeFrom((e as PointerEvent | FocusEvent).relatedTarget);
    if (!to || to.id !== from.id) setActivePlace(from.atlas, to ? to.id : null);
  });
}

// --- 5. Smooth scrolling ---------------------------------------------------------
// Scrolling with a mouse wheel or trackpad eases the page along and lets it glide to a stop.
// Left alone: touch screens (already smooth), reduced-motion devices, the photo viewer,
// pinch-zoom, sideways scrolling, and anything that scrolls inside the page.
const EASE = 40; // higher = snappier, lower = floatier
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let glideTo = 0, glideAt = 0, gliding = false, lastFrame = 0;

function stopGlide() { gliding = false; }

function glide(now: number) {
  if (!gliding) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  glideAt += (glideTo - glideAt) * (1 - Math.exp(-EASE * dt));
  if (Math.abs(glideTo - glideAt) < 0.5) { glideAt = glideTo; gliding = false; }
  window.scrollTo({ top: glideAt, behavior: 'instant' });
  if (gliding) requestAnimationFrame(glide);
}

function scrollsItself(el: Element | null, dy: number) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const o = getComputedStyle(el).overflowY;
    if ((o === 'auto' || o === 'scroll') && (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1)) return true;
  }
  return false;
}

window.addEventListener('wheel', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || !finePointer.matches || reducedMotion()) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  if (scrollsItself(e.target as Element | null, e.deltaY)) return;
  e.preventDefault();
  if (document.querySelector('dialog[open]')) return; // the page stays put behind the photo viewer
  const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
  if (!gliding) { glideAt = glideTo = window.scrollY; gliding = true; lastFrame = performance.now(); requestAnimationFrame(glide); }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  glideTo = Math.max(0, Math.min(max, glideTo + dy));
}, { passive: false });

// Anything else that moves the page (keys, dragging the scrollbar, a link, a new page) takes over at once.
window.addEventListener('keydown', stopGlide);
window.addEventListener('pointerdown', stopGlide);
document.addEventListener('click', stopGlide);
document.addEventListener('astro:before-swap', stopGlide);

// --- 6. Teleport ---------------------------------------------------------------
// Clicking a place with photos (its dot or its row in the list) lifts the map off the page,
// dives into that spot while everything else falls away, shows the place name, then opens the trip.
const ZOOM = 9;          // how far the map zooms in
const DIVE_MS = 950;     // how long the dive takes
let teleporting = false;

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement | SVGAElement>('[data-atlas] a.spot, [data-atlas] a.row');
  const atlas = link?.closest('[data-atlas]');
  if (!link || !atlas || teleporting || reducedMotion()) return;
  const id = link.closest('[data-place]')?.getAttribute('data-place');
  const map = atlas.querySelector<SVGSVGElement>('svg');
  const spot = id ? map?.querySelector<SVGGraphicsElement>(`.spot[data-place="${CSS.escape(id)}"]`) : null;
  const dot = spot?.querySelector<SVGCircleElement>('.dot');
  const href = link instanceof HTMLAnchorElement ? link.href : (link as SVGAElement).href.baseVal;
  if (!map || !spot || !dot || !href || typeof map.animate !== 'function') return;
  e.preventDefault();
  teleporting = true;

  const vw = window.innerWidth, vh = window.innerHeight;
  // Start exactly where the map is; if it is off-screen (reached from the list), start it centred.
  let box = map.getBoundingClientRect();
  if (box.width < 40 || box.bottom < 0 || box.top > vh) {
    const w = Math.min(vw - 32, 900), h = w * (map.viewBox.baseVal.height / map.viewBox.baseVal.width);
    box = new DOMRect((vw - w) / 2, (vh - h) / 2, w, h);
  }
  const px = (dot.cx.baseVal.value / map.viewBox.baseVal.width) * box.width;   // the dot, inside the map
  const py = (dot.cy.baseVal.value / map.viewBox.baseVal.height) * box.height;

  const layer = document.createElement('div');
  layer.className = 'teleport';
  layer.setAttribute('aria-hidden', 'true');
  const veil = document.createElement('div');
  veil.className = 'teleport-veil';
  const copy = map.cloneNode(true) as SVGSVGElement;
  copy.removeAttribute('role'); copy.removeAttribute('aria-label');
  copy.querySelectorAll('.spot').forEach((el) => { if (el.getAttribute('data-place') !== id) el.remove(); });
  copy.querySelectorAll('.tip, .ping').forEach((el) => el.remove());
  Object.assign(copy.style, { position: 'absolute', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, transformOrigin: `${px}px ${py}px` });
  const row = atlas.querySelector(`li[data-place="${CSS.escape(id!)}"]`);
  const name = document.createElement('div');
  name.className = 'teleport-name';
  name.innerHTML = '<span class="label"></span><span class="display"></span>';
  name.children[0].textContent = row?.querySelector('.meta')?.textContent ?? '';
  name.children[1].textContent = row?.querySelector('.name')?.textContent ?? '';
  layer.append(veil, copy, name);
  document.body.append(layer);

  const ease = 'cubic-bezier(0.65, 0, 0.25, 1)';
  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
  copy.animate(
    [{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${vw / 2 - (box.left + px)}px, ${vh / 2 - (box.top + py)}px) scale(${ZOOM})` }],
    { duration: DIVE_MS, easing: ease, fill: 'forwards' },
  );
  copy.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 0, offset: 1 }], { duration: DIVE_MS, fill: 'forwards' });
  // The dot makes way for the place name.
  copy.querySelector('.spot')?.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.6 }, { opacity: 0, offset: 1 }], { duration: DIVE_MS, fill: 'forwards' });
  name.animate(
    [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)', offset: 0 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)', offset: 0.5 }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 1 }],
    { duration: DIVE_MS, easing: 'ease-out', fill: 'forwards' },
  );

  window.setTimeout(() => {
    teleporting = false;
    navigate(href).catch(() => { window.location.href = href; });
  }, DIVE_MS + 120);
}, true); // runs before the page-transition router, so the dive plays first

// If the visitor comes back with the browser's Back button, make sure nothing is left covering the page.
document.addEventListener('astro:page-load', () => { teleporting = false; document.querySelectorAll('.teleport').forEach((el) => el.remove()); });
window.addEventListener('pageshow', () => { teleporting = false; document.querySelectorAll('.teleport').forEach((el) => el.remove()); });
