// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  // No adapter - pure static build. Cloudflare Pages serves dist/ directly.
  vite: {
    plugins: [tailwindcss()],
  },
});
