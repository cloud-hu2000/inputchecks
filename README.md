# InputChecks

A fast, static Astro site for browser-based mouse diagnostics at `inputchecks.com`. The homepage is a **Scroll Wheel Test** with a live Canvas signal, direction comparison, reverse-event count, rate, event gaps, and local-only processing.

## Local development

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

For end-to-end checks, install the Playwright browser once:

```bash
npx playwright install chromium
npm run test:e2e
```

## Included routes

- `/` — Scroll Wheel Test
- `/mouse-test` — buttons, wheel, and movement
- `/double-click-test` — repeated click timing
- `/mouse-polling-rate-test` — browser pointer-event estimate
- `/guides/mouse-wheel-scrolls-wrong-way`
- `/guides/mouse-wheel-jumping`
- `/guides/how-to-test-mouse-wheel`
- `/about`, `/privacy`, `/terms`

All editorial content, navigation, metadata, canonicals, JSON-LD, and internal links are generated as static HTML. `@astrojs/sitemap` generates `sitemap-index.xml` during the production build.

## Configuration

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Production site origin; used by canonical URLs, sitemap, and Open Graph URLs. |
| `PUBLIC_GA_ID` | Optional GA4 measurement ID. When empty, no GA script is loaded. |
| `PUBLIC_ADSENSE_CLIENT_ID` | Optional AdSense client ID. When empty, no AdSense request is made. |
| `PUBLIC_ADSENSE_SLOT_TOP` | Optional slot ID for the post-tool ad reservation. |
| `PUBLIC_ADSENSE_SLOT_CONTENT` | Reserved for an in-content slot. |
| `PUBLIC_ADSENSE_SLOT_SIDEBAR` | Reserved for a desktop sidebar slot. |

`SITE_URL` already defaults to `https://inputchecks.com`; set it explicitly in Cloudflare Pages so production configuration remains unambiguous. `public/robots.txt` is already set to the production sitemap URL.

## Cloudflare Pages deployment

Follow the complete [Cloudflare deployment guide](DEPLOYMENT.md). The essential settings are build command `npm run build`, output directory `dist`, Node.js 22+, and `SITE_URL=https://inputchecks.com`.

No Worker, database, account system, or server-side test-record storage is required.

## SEO and monetization checklist

- [x] One indexable page per distinct tool intent; no near-duplicate keyword pages
- [x] Static title, description, H1, canonical, Open Graph, breadcrumb, internal links, and structured data
- [x] Sitemap and robots file
- [x] Original tool-page and guide content
- [x] Advertising reserve after the tester with fixed height to minimize layout shift
- [x] Ads and analytics disabled when unconfigured
- [x] Local browser processing for detailed input samples

When AdSense is enabled, set the approved client and slot values in deployment variables. `AdSlot` appears after results—not beside controls—and reserves vertical space before an ad arrives.
