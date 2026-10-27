# Tai Rong — photographs, sorted by where I was

A travel photography portfolio built with [Astro](https://astro.build). Each trip is a folder of photos plus one text file. Add a folder and the site updates itself: the list of places, the home-page carousels, and a page for the trip.

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
├─ content/
│  ├─ about.md                 ← your name, headline, portrait, bio, roles, links
│  ├─ portrait.jpg             ← photo of you on the home page
│  └─ trips/
│     └─ 2026-03-usa/          ← one folder per trip: <year>-<month>-<place>
│        ├─ index.md           ← trip details + one entry per photo
│        └─ photos/            ← the photos (added by the import tool)
├─ components/                 ← the building blocks of each page
├─ pages/                      ← home page and the automatic trip pages
├─ lib/trips.ts                ← sorting, labels, photo rows
├─ styles/tokens.css           ← colours, fonts, sizes, carousel speed
└─ content.config.ts           ← the rules each content file must follow
scripts/add-trip.mjs           ← the photo import tool
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

## Changing your details

`src/content/about.md` holds the headline, the intro line, the portrait caption, your roles, your links and your email. The text below the `---` lines is your bio. Replace `src/content/portrait.jpg` with a photo of you (a 4:5 portrait crop looks best). To show Instagram in the menu, remove the `#` in front of the `instagram:` line and add your link.

## Changing the look

`src/styles/tokens.css` controls the colours, fonts, page width, carousel photo size and carousel speed. Change a value there and it updates everywhere.

## Putting it online

1. Create a new repository on GitHub and push this folder to it.
2. Sign in to [Cloudflare Pages](https://pages.cloudflare.com), [Netlify](https://www.netlify.com) or [Vercel](https://vercel.com) with GitHub and import the repository. All three are free for a site like this.
3. Use build command `npm run build` and output folder `dist`.
4. Set your real address in `astro.config.mjs` (`site:`).

From then on, every `git push` updates the live site within a minute or two.

## Storage notes

Each imported photo is about 400–700KB, so 300–400 photos keep the repository around 250MB, well within GitHub's limits. Keep your full-resolution originals in iCloud Photos. If the collection grows far beyond that, the `photos/` folders can move to Cloudflare R2 or Cloudinary without changing the components.

## The sample content

The trips `2026-03-usa`, `2025-03-japan` and `2024-12-singapore` hold grey sample photos and bracketed placeholder text so you can see the layout. Delete those folders once you've added your own trips.
