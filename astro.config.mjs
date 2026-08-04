// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://sunithkumar.is-a.dev';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  output: 'static',
  integrations: [mdx(), sitemap()],
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
