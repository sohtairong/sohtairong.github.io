// @ts-check
import { defineConfig } from 'astro/config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // The site's public address (used for link previews and canonical URLs). Change it if you move to your own domain.
  site: 'https://sohtairong.github.io',
  vite: {
    server: {
      // Lets you share the dev server (npm run dev) through an ngrok link, e.g. to view it on your phone.
      // The leading dot allows any ngrok address, so this keeps working when ngrok gives you a new one.
      allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    },
  },
});
