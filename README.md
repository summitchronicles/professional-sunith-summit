# Summit Site

Astro static site configured for Cloudflare Pages.

## Local

```sh
npm install
npm run dev
```

## Deploy To Cloudflare Pages (Free)

This repo is set up for the best fast path: Cloudflare `pages.dev`.

1. Build once locally:
```sh
npm run build
```
2. Log in to Cloudflare:
```sh
npx wrangler login
```
3. Create the Pages project (run once):
```sh
npx wrangler pages project create summit --production-branch main
```
4. Deploy:
```sh
npx wrangler pages deploy dist --project-name summit
```

The live URL will be:
`https://summit.pages.dev` (or a variant if that name is taken).

## Optional Free Branded Domain Later

After `pages.dev` is live, connect a free subdomain such as `*.is-a.dev`:
1. Register and get approval on is-a.dev.
2. In Cloudflare Pages, add the custom domain.
3. Follow the DNS/CNAME instructions shown by Cloudflare.

## Domain-Aware SEO

`astro.config.mjs` and `src/pages/robots.txt.ts` automatically use:
1. `SITE_URL` if set.
2. Otherwise `CF_PAGES_URL` on Cloudflare Pages.
3. Otherwise fallback to `https://sunith.dev`.
