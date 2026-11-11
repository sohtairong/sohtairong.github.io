# Tai Rong — photographs, sorted by where I was

A travel photography portfolio built with [Astro](https://astro.build). Each trip is a folder of photos plus one text file. Add a folder and the site updates itself: the list of places, the home-page carousels, and a page for the trip.

## Quick reference

Everything you'll do regularly, in one place. Run commands in this folder.

| I want to… | Do this |
|---|---|
| Preview the site | `npm run dev`, then open http://localhost:4321 |
| Add a new trip | `npm run add-trip -- <folder of photos> --country Taiwan`, then fill in the trip's `index.md` |
| Add photos to an existing trip | The same command, with that trip's `--country` and `--date 2025-01` |
| Write or fix titles and stories | Edit `src/content/trips/<trip>/index.md` |
| Choose the carousel photos | Set `featured: true` on those photos in the trip's `index.md` |
| List a place I haven't posted yet | Add its name to `alsoVisited` in `src/content/about.md` |
| Change the big photo at the top | `npm run set-hero -- <photo> --caption "Kyoto, March 2025"` |
| Change my portrait | Replace `src/content/portrait.jpg` |
| Change my headline, bio, roles or links | Edit `src/content/about.md` |
| Hide a trip for now | Set `draft: true` in its `index.md` |
| Check for mistakes before publishing | `npm run check` |
| Publish | `git add . && git commit -m "Add Taiwan" && git push` (once the site is online) |

You never need to touch the code to do any of these. The list of places, the map, the carousels, the trip pages, the photo counts and the link previews all update themselves.

## What is Astro?

Astro is a tool that turns a folder of files into a finished website. You write content in plain text files (Markdown) and small page templates; Astro combines them into ordinary HTML pages when you run `npm run build`.

For this site it also:

- **checks your content**: a typo in a trip file stops the build and tells you the file and field;
- **resizes photos**: it makes small, fast versions of every image for phones and large screens;
- **ships no JavaScript by default**: the pages are plain HTML and CSS, so they load quickly.

The result (the `dist/` folder) is a static website that any free host can serve.

## First-time setup

1. Install [Node.js](https://nodejs.org) version 22.12 or newer.
2. In this folder, run:

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:4321. The site reloads as you edit files.

## Folder map

```
src/
├─ content/                    ← EVERYTHING YOU EDIT LIVES HERE
│  ├─ about.md                 ← name, headline, bio, roles, links, places not posted yet
│  ├─ portrait.jpg             ← photo of you on the home page
│  ├─ hero.jpg                 ← big photo at the top (created by `npm run set-hero`)
│  └─ trips/
│     └─ 2026-03-usa/          ← one folder per trip: <year>-<month>-<place>
│        ├─ index.md           ← trip details + one entry per photo
│        └─ photos/            ← the photos (added by the import tool)
├─ components/                 ← the building blocks of each page
├─ pages/                      ← home page, the automatic trip pages, the "not found" page
├─ lib/                        ← sorting, labels, map positions (places.ts has the country list)
├─ scripts/motion.ts           ← transitions, arrival motion, light/dark switch, map hovering
├─ styles/tokens.css           ← colours (light and dark), fonts, sizes, carousel speed
└─ content.config.ts           ← the rules each content file must follow
scripts/add-trip.mjs           ← the photo import tool
scripts/set-hero.mjs           ← sets the big photo at the top
public/favicon.svg             ← the browser tab icon
```

## Adding a new trip

1. **Export your photos.** In the iPhone Photos app or Photos on your Mac, select your favourites and export them into a new folder. HEIC files are fine.
2. **Import them:**

   ```sh
   npm run add-trip -- ~/Desktop/usa-photos --country USA
   ```

   The tool:
   - reads the trip month from the photos (or use `--date 2026-03`)
   - creates `src/content/trips/2026-03-usa/`
   - converts HEIC to JPEG and resizes each photo to 2400px on its long edge
   - **removes all metadata, including GPS location**
   - writes `index.md` with a blank title and story for every photo

   Other options: `--city "New York"` pre-fills the city on every photo, and `--featured 8` changes how many photos go in the home-page carousel.
3. **Write the words.** Open the trip's `index.md` and fill in each `title` and `story`, the `cities` list and the paragraph at the bottom.
4. **Preview, then publish:** run `npm run dev` to check it, then `git add . && git commit -m "Add USA" && git push`.

### Adding photos to a trip you already have

Run the same command with the same `--country` and `--date`. The new photos are added to the end of that trip's list.

## Editing a trip's `index.md`

```yaml
---
country: "USA"
cities: ["New York", "Boston"]
date: "2026-03"                # sets the order and the "March 2026" label
# dateLabel: "Home, ongoing"   # optional: text shown instead of the month
draft: false                   # true hides the trip without deleting it
photos:
  - src: ./photos/img-0412.jpg
    title: "Last train out"
    story: "The platform emptied out right after this."
    city: "New York"
    featured: true             # shows in the home-page carousel
    # layout: wide             # optional: wide | pair on the trip page
    # alt: "Empty subway platform at night"   # optional: description for screen readers
---

A short paragraph about the trip.
```

- **Reorder photos:** move whole entries up or down the list.
- **Choose the carousel photos:** set `featured: true` on the ones you want. If none are featured, the first six are used.
- **Trip page layout:** photos alternate between one full-width photo and a side-by-side pair. Add `layout: wide` or `layout: pair` to a photo to override this.
- **Remove a photo:** delete its entry and its file in `photos/`.

### Writing titles and stories without breaking the file

The trip file is strict about punctuation. Three rules keep it safe:

- Keep the text **inside the double quotes**: `title: "Last train out"`.
- Apostrophes are fine as they are: `story: "It's the one I'd keep."`
- To use a double quote inside the text, put a backslash before it: `story: "She said \"wait\" and I did."`

Keep the spacing at the start of each line as the import tool wrote it. If you slip, `npm run check` (or the dev server) tells you which file and line to fix.

### If something goes wrong

| What you see | What to do |
|---|---|
| An error naming a trip's `index.md` | A field has a typo or broken quotes. The message gives the line. Compare it with another photo's entry. |
| "Use YYYY-MM, e.g. 2026-03" | The trip's `date:` must look like `"2026-03"`. |
| A photo doesn't show | Its `src:` must match the file name in the trip's `photos/` folder exactly. |
| A place is missing from the map | The build prints a `[map]` warning. Add `map: { lat: …, lng: … }` to the trip, or add the country to `src/lib/places.ts`. |
| The import tool fails on a HEIC photo | In Photos on your Mac, use File › Export › Export Photos and pick JPEG, then import that folder. |
| Changes don't appear | Stop the dev server (Ctrl+C) and run `npm run dev` again. |

## The map

Right under the top photo, the home page has a world map beside the list of places. Pointing at a place in the list lights up its dot (and the other way round), and places with photos show a small preview. It builds itself:

- **Solid dot:** a trip with photos. It links to the trip page. If you've been to a country more than once, the dot opens the newest trip.
- **Ring:** a place you've been but haven't posted yet. List these in `src/content/about.md` under `alsoVisited: [Taiwan, Korea]`. When you add a trip for one, its ring becomes a solid dot on its own; you can leave the name in the list or remove it.
- **Position:** dots sit at the centre of the country. To move one, add `map: { lat: 35.01, lng: 135.77 }` to the trip's `index.md`. For a country the site doesn't know, use `- { name: "Bhutan", lat: 27.5, lng: 90.4 }` in `alsoVisited`, or add it to the list in `src/lib/places.ts`.

## Changing your details

`src/content/about.md` holds the headline, the intro line, the portrait caption, your roles, your links and your email. The text below the `---` lines is your bio. Replace `src/content/portrait.jpg` with a photo of you (a 4:5 portrait crop looks best). To show Instagram in the menu, remove the `#` in front of the `instagram:` line and add your link.

## The photo behind the top of the home page

Pick one of your favourite landscape shots and run:

```sh
npm run set-hero -- ~/Desktop/IMG_1234.HEIC --caption "Kyoto, March 2025"
```

This converts and resizes the photo, removes its location data, saves it as `src/content/hero.jpg` and switches it on in `about.md`. The caption shows small in the corner of the photo. Run the command again any time to swap the photo.

If no hero photo is set, the site uses the first featured photo of your newest trip, so the top of the page changes each time you add a trip. To go back to that, delete the `hero:` line in `about.md`.

## Motion and the photo viewer

- **Page transitions:** pages fade into each other, and clicking a carousel photo grows it into the same photo on its trip page.
- **Photo viewer:** on a trip page, click a photo to see it full-screen with its story. Use the arrow keys, the on-screen arrows or a swipe to move through the trip; Esc closes it.
- **Arrival motion:** photos fade in as you scroll to them, and the top photo on the home page drifts slowly as you scroll away.

All of it switches off for visitors whose device is set to reduce motion. The code is in `src/scripts/motion.ts`, `src/components/Lightbox.astro` and the end of `src/styles/global.css`.

## Changing the look

`src/styles/tokens.css` controls the colours, fonts, page width, carousel photo size and carousel speed. Change a value there and it updates everywhere.

The site has a light and a dark mode. It follows the visitor's device setting, and the Dark/Light switch in the menu lets them choose; the choice is remembered on that device. Both sets of colours are in `tokens.css`. The full-screen photo viewer is always dark.

## Putting it online

1. Create a new repository on GitHub and push this folder to it.
2. Sign in to [Cloudflare Pages](https://pages.cloudflare.com), [Netlify](https://www.netlify.com) or [Vercel](https://vercel.com) with GitHub and import the repository. All three are free for a site like this.
3. Use build command `npm run build` and output folder `dist`.
4. Set your real address in `astro.config.mjs` (`site:`).

From then on, every `git push` updates the live site within a minute or two.

## Sharing links, the tab icon and the "not found" page

- **Link previews:** when a page's link is shared (LinkedIn, WhatsApp, Telegram…), it shows a photo, the title and a one-line description. The home page uses the hero photo; each trip page uses its first featured photo. These only work once the site is online **and** `site:` in `astro.config.mjs` is set to your real address.
- **Tab icon:** `public/favicon.svg` is a plain "TR". Replace that file to change it.
- **Not found page:** `src/pages/404.astro` is shown for addresses that don't exist. It lists your places so visitors can carry on.

## Storage notes

Each imported photo is about 400–700KB, so 300–400 photos keep the repository around 250MB, well within GitHub's limits. Keep your full-resolution originals in iCloud Photos. If the collection grows far beyond that, the `photos/` folders can move to Cloudflare R2 or Cloudinary without changing the components.

## The sample content

The trips `2026-03-usa`, `2025-03-japan` and `2024-12-singapore` hold grey sample photos and bracketed placeholder text so you can see the layout. Delete those folders once you've added your own trips.
