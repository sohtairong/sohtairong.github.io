// The content rules. If a trip's index.md is missing something required or has a
// typo in a field name, `npm run build` stops and tells you which file and field.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const trips = defineCollection({
  // One folder per trip: src/content/trips/<yyyy-mm-country>/index.md
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/trips',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      country: z.string(),
      cities: z.array(z.string()).default([]),
      // Year and month of the trip, e.g. "2026-03". Trips are sorted newest first by this.
      date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM, e.g. 2026-03'),
      // Optional text to show instead of the month, e.g. "Home, ongoing".
      dateLabel: z.string().optional(),
      // Set to true to hide a trip without deleting it.
      draft: z.boolean().default(false),
      photos: z
        .array(
          z.object({
            src: image(),
            title: z.string().default(''),
            story: z.string().default(''),
            city: z.string().optional(),
            // Describe the photo for screen readers. Falls back to the title.
            alt: z.string().optional(),
            // Featured photos appear in the home-page carousel.
            featured: z.boolean().default(false),
            // Trip page layout: "wide" = full width, "pair" = side by side. Leave out for automatic.
            layout: z.enum(['wide', 'pair']).optional(),
          }),
        )
        .min(1, 'A trip needs at least one photo'),
    }),
});

const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: './src/content' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      headline: z.string(),
      // Wrap the words to emphasise in *asterisks* — they render in muted italic.
      intro: z.string(),
      portrait: image().optional(),
      portraitCaption: z.string().optional(),
      email: z.string().optional(),
      instagram: z.string().url().optional(),
      roles: z.array(z.object({ role: z.string(), org: z.string() })).default([]),
      links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    }),
});

export const collections = { trips, about };
