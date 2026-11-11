// Site-wide motion. Runs once and keeps working across page transitions.
//
// 1. Photo morph: clicking a carousel photo grows it into the same photo on the trip page.
// 2. Arrival motion: [data-reveal] elements fade in as they scroll into view.

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
  figure.scrollIntoView({ block: 'start' });
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
