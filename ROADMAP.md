# Roadmap

Ideas for carrying the site on, most valuable first within each group. Written on 16 November 2026.
How everything works is in `README.md`.

## Progress checklist

Updated as each item is finished and placed in this folder. Anything ticked is in the folder but still needs **Publish** in Studio.

- [x] 7. Build check before publishing (Studio: studio/server.mjs, studio/ui/app.js)
- [x] 8. Flag photos with no title or description (Studio: studio/ui/app.js, studio/ui/app.css)
- [x] 4. Sitemap and robots file (src/pages/sitemap.xml.ts, src/pages/robots.txt.ts)
- [x] 3. Padded link previews for tall photos (src/pages/share/, src/layouts/Base.astro)
- [ ] 9. Keep cropped originals out of the public repository — NOT done. It needs a decision first: if the originals stay off GitHub, a crop can only be changed or undone on the computer that still has the original file.
- [x] 11. Remove leftover code (the unused cut-out upload; nothing else was removed)

## For visitors

1. **Add more trips.** The map shows eight places with only one filled in. This matters more than any further design work.
2. **Use sharper source photos.** The saved top photo is about 100 KB and the portrait is 768 px wide, so both look soft on large screens. Re-add them from the originals in Studio ("Home page & About").
3. **Better link previews for tall photos.** A shared photo link crops the picture to a wide 1200×630 rectangle (`src/layouts/Base.astro`), which cuts off most of a portrait shot. A padded preview image would show the whole photo.
4. **Let search engines find it.** There is no sitemap or robots file yet.
5. **A custom domain**, for something shorter than `sohtairong.github.io`. Steps are in the README under "Moving to your own domain later".
6. **An accessibility pass.** Check the white text at the top stays readable over whatever top photo is chosen, and that everything works by keyboard.

## For Studio

7. **Check the site builds before publishing.** Publish sends changes straight to GitHub without building first (`publish()` in `studio/server.mjs`), so a mistake in a content file only shows up as a failed deploy on GitHub. Run the build first and report any problem in plain words.
8. **Flag photos with no title or description**, so hover captions and screen-reader text are never blank.
9. **Keep cropped originals out of the public repository.** When a photo is cropped, the uncropped file stays in the trip's `photos/` folder and is published to GitHub (not to the site).
10. **Plan for storage.** When Studio's storage meter passes about 70%, lower the saved photo size or move photos to Cloudflare R2.

## Housekeeping

11. **Remove leftovers.** The cut-out upload code is still in `studio/server.mjs` and `scripts/lib/content.mjs` though its slot is gone from Studio's screen. Check for other unused pieces from earlier layouts.
12. **Test on real devices.** Everything so far was tested in a simulated browser. Still unchecked: pinch zoom and the share sheet on a real phone, trackpad zoom, HEIC photos straight from an iPhone, dragging a Finder folder into Studio, and real message previews for photo links.
13. **Work from one copy of the project.** Use the Desktop copy, or run `git pull` before editing another copy.
14. **Update Astro and the other packages** every few months (`npm outdated`, then `npm update`, then `npm run build` to check).
