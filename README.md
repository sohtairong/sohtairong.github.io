# Tai Rong — photographs, sorted by where I was

A travel photography portfolio built with [Astro](https://astro.build). Each trip is a folder of photos plus one text file. Add a folder and the site updates itself: the list of places, the home-page carousels, and a page for the trip.

## Studio: edit the site without commands

Studio is a private editor for this site. It runs only on your computer and never becomes part of the public site.

**To open it:** double-click **Open Studio.command** in this folder. A Terminal window opens (leave it open while you work) and Studio appears in your browser. Close the Terminal window when you're done.

What you can do in Studio:

- **Add a trip:** press **+ New trip**, or drag a folder of photos anywhere onto the page. Type the country and month; the month is read from the first photo when it can be. iPhone HEIC photos are converted, every photo is resized, and all location data is removed.
- **Add photos to a trip:** open the trip and drag photos or a folder onto the page. New photos are added in the order they were taken.
- **Write titles and stories:** type in the boxes beside each photo. Changes save on their own a moment after you stop typing.
- **Arrange photos:** drag a photo by its ⠿ handle, or use the ← → arrows.
- **Choose the home carousel photos:** press **★ Home carousel** on the ones you want.
- **Choose a photo's size on the trip page:** normal, or large (two columns across).
- **Crop a photo:** press **Crop** under it, pick a shape (square, wide, tall or free), and drag the frame over the part to keep. This is how you turn a tall photo into a wide one so the trip page looks more varied. The full photo is kept in the trip's `photos/` folder, so **Edit crop** and **Remove crop** work at any time.
- **Remove a photo or delete a trip:** an **Undo** button appears for a few seconds afterwards.
- **Hide a trip for now:** tick "Hide this trip from the site".
- **Edit the home page and About:** the top photo and its caption, headline, portrait, bio, roles, links, and the places on the map you haven't posted yet.
- **Use a trip photo as the top photo:** press **Use as top photo** under it.
- **Preview:** **Preview site** opens the real site as visitors will see it, running on your computer.
- **Publish:** **Publish** lists what changed in plain words, then sends it to the live site. It updates in a minute or two.

Good to know:

- Studio works on the same files described in the rest of this README, so editing by hand and the commands below still work. Reload the Studio page after editing a file by hand.
- Removed photos and deleted trips go to a hidden `.studio-trash` folder in this project, not the Mac's Trash. It isn't published. You can empty it whenever you like.
- A trip with no photos is kept but stays off the site until it has one.
- If the double-click is blocked the first time, right-click the file and choose **Open**. You can also start Studio with `npm run studio`.
- Publishing uses the GitHub login already set up on this computer.

## Quick reference

Prefer typing commands? Everything Studio does can also be done this way. Run commands in this folder.

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
| Publish | `git add . && git commit -m "Add Taiwan" && git push`, live in a minute or two |
| See whether it published | The repository's **Actions** tab on github.com: green tick = live |

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
├─ lib/                        ← sorting, labels, map positions (countries.json has the country list)
├─ scripts/motion.ts           ← transitions, arrival motion, light/dark switch, map hovering
├─ styles/tokens.css           ← colours (light and dark), fonts, sizes, carousel speed
└─ content.config.ts           ← the rules each content file must follow
studio/                        ← Studio, the private editor (server.mjs + its interface in ui/)
Open Studio.command            ← double-click to open Studio
scripts/lib/                   ← photo and content handling shared by Studio and the tools
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
    # layout: wide             # optional: a large tile, two columns across, on the trip page
    # alt: "Empty subway platform at night"   # optional: description for screen readers
---

A short paragraph about the trip.
```

- **Reorder photos:** move whole entries up or down the list.
- **Choose the carousel photos:** set `featured: true` on the ones you want. If none are featured, the first six are used.
- **Trip page layout:** photos are tiled in columns (three on a computer, two on a phone), each in its own shape, so a mix of tall, wide and square photos gives the most varied page. Add `layout: wide` to make a photo a large tile two columns across.
- **Cropped photos:** when Studio crops a photo it adds an `original:` line pointing at the uncropped file. Leave both files in `photos/`; delete the `original:` line and point `src:` back at the original to undo a crop by hand.
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
| A place is missing from the map | The build prints a `[map]` warning. Add `map: { lat: …, lng: … }` to the trip, or add the country to `src/lib/countries.json`. |
| The import tool fails on a HEIC photo | In Photos on your Mac, use File › Export › Export Photos and pick JPEG, then import that folder. |
| Changes don't appear | Stop the dev server (Ctrl+C) and run `npm run dev` again. |

## The map

Right under the top photo, the home page has a world map beside the list of places. Pointing at a place in the list lights up its dot (and the other way round), and places with photos show a small preview. It builds itself:

- **Solid dot:** a trip with photos. It links to the trip page. If you've been to a country more than once, the dot opens the newest trip.
- **Ring:** a place you've been but haven't posted yet. List these in `src/content/about.md` under `alsoVisited: [Taiwan, Korea]`. When you add a trip for one, its ring becomes a solid dot on its own; you can leave the name in the list or remove it.
- **Position:** dots sit at the centre of the country. To move one, add `map: { lat: 35.01, lng: 135.77 }` to the trip's `index.md`. For a country the site doesn't know, use `- { name: "Bhutan", lat: 27.5, lng: 90.4 }` in `alsoVisited`, or add it to the list in `src/lib/countries.json`.

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
- **Trip page tiles:** a trip page shows only the photos. Pointing at a photo (or tabbing to it) darkens it and shows its title, place and story. On phones and tablets, where there is no pointer, the title and place sit along the bottom of each photo and a tap opens the viewer with the full story.
- **Photo viewer:** on a trip page, click a photo to see it full-screen with its story. Use the arrow keys, the on-screen arrows or a swipe to move through the trip; Esc closes it.
- **Arrival motion:** photos fade in as you scroll to them, and the top photo on the home page drifts slowly as you scroll away.

All of it switches off for visitors whose device is set to reduce motion. The code is in `src/scripts/motion.ts`, `src/components/PhotoGrid.astro` (tiles and captions; the tiling itself is worked out in `src/lib/grid.ts`), `src/components/Lightbox.astro` and the end of `src/styles/global.css`.

## Changing the look

`src/styles/tokens.css` controls the colours, fonts, page width, carousel photo size and carousel speed. Change a value there and it updates everywhere.

The site has a light and a dark mode. It follows the visitor's device setting, and the Dark/Light switch in the menu lets them choose; the choice is remembered on that device. Both sets of colours are in `tokens.css`. The full-screen photo viewer is always dark.

## Publishing (GitHub Pages)

The site is live at **https://sohtairong.github.io**. It is published from the GitHub repository `sohtairong/sohtairong.github.io`, and publishing is automatic: every push to the `main` branch rebuilds the site and puts it online.

### Publishing a change

1. Check it locally first: `npm run dev` to look at it, `npm run check` to catch mistakes.
2. Save and send it:

   ```sh
   git add .
   git commit -m "Add Taiwan"
   git push
   ```

3. Wait a minute or two, then reload https://sohtairong.github.io. If you still see the old version, do a hard refresh (Cmd+Shift+R).

### Checking that it published

On github.com, open the repository's **Actions** tab. Each push adds a run called **Deploy to GitHub Pages**:

- **Green tick:** the site built and is online.
- **Yellow dot:** it's still running.
- **Red cross:** the build failed and the live site stays on the last good version. Click the run, then the red step, to read the error. It is nearly always a mistake in a trip's `index.md`, and `npm run check` shows the same error on your Mac. Fix it and push again.

To publish again without changing anything, open that workflow in the Actions tab and choose **Run workflow**.

Red runs named **pages build and deployment** are something else: GitHub's older built-in publisher, which can't build this project. They don't affect the site. To stop them, set **Settings > Pages > Source** to **GitHub Actions**.

### How it's set up

- `.github/workflows/deploy.yml` is the recipe GitHub follows on every push. You shouldn't need to edit it.
- `site:` in `astro.config.mjs` holds the public address. Link previews and page addresses are built from it.
- **Settings > Pages > Source** on github.com is set to **GitHub Actions**.
- The repository must be **public** on GitHub's free plan, so the photo files and trip text are visible there too.
- The repository name matters. `sohtairong.github.io` puts the site at the top of the address, which the site's links expect. Renaming the repository, or your GitHub username, changes the address and breaks them until `site:` is updated to match.

### Moving to your own domain later

1. Buy the domain and, in the repository, open **Settings > Pages > Custom domain** and follow GitHub's steps.
2. Change `site:` in `astro.config.mjs` to the new address, for example `https://tairong.dev`.
3. Add a file `public/CNAME` containing just the domain name, so the setting survives each publish.
4. Commit and push.

### Setting it up again from scratch

Only needed if you ever move the project to a new repository:

1. Create a **public** repository named `<your-username>.github.io`.
2. Set `site:` in `astro.config.mjs` to `https://<your-username>.github.io`.
3. Run `git remote set-url origin https://github.com/<your-username>/<your-username>.github.io.git` and `git push -u origin main`.
4. Set **Settings > Pages > Source** to **GitHub Actions**.

## Storage notes

Each imported photo is about 400–700KB, so 300–400 photos keep the repository around 250MB, well within GitHub's limits. Keep your full-resolution originals in iCloud Photos. If the collection grows far beyond that, the `photos/` folders can move to Cloudflare R2 or Cloudinary without changing the components.

## The sample content

The trips `2026-03-usa`, `2025-03-japan` and `2024-12-singapore` hold grey sample photos and bracketed placeholder text so you can see the layout. Delete those folders once you've added your own trips.
