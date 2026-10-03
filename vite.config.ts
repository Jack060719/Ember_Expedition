import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [{
    name: 'inline-apple-touch-icon',
    transformIndexHtml(html) {
      // The home-screen picker may fetch icon URLs without the site's login session.
      const icon=readFileSync(new URL('./public/assets/icon-180.png',import.meta.url));
      return html.replace(/href="[^"]*\/assets\/icon-180\.png"/,`href="data:image/png;base64,${icon.toString('base64')}"`);
    },
  }],
});
