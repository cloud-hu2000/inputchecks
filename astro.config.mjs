// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rm, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** @type {import('astro').AstroIntegration} */
const singleSitemap = {
  name: 'inputchecks-single-sitemap',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const output = fileURLToPath(dir);
      await rename(join(output, 'sitemap-0.xml'), join(output, 'sitemap.xml'));
      await rm(join(output, 'sitemap-index.xml'));
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://inputchecks.com',
  integrations: [sitemap({ entryLimit: 50_000 }), singleSitemap],
});
