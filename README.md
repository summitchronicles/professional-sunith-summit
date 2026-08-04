# Sunith Kumar Portfolio

Astro static site hosted on GitHub Pages.

- Production: <https://sunithkumar.is-a.dev>
- Repository: <https://github.com/summitchronicles/professional-sunith-summit>

## Local Development

```sh
npm install
npm run dev
```

## Automatic Deployment

Pushes to `main` are built and deployed by GitHub Actions. No hosting API token
is required.

Configure the repository once under **Settings > Pages**:

1. Set **Source** to **GitHub Actions**.
2. Set the custom domain to `sunithkumar.is-a.dev`.
3. Enable **Enforce HTTPS** after the certificate becomes available.

The normal update flow is:

```sh
git add .
git commit -m "Describe the update"
git push origin main
```

The deployment can also be started from the repository's **Actions** tab using
the **Run workflow** button.

## Custom Domain

The `is-a.dev` DNS record must point to GitHub Pages:

```json
{
  "owner": {
    "username": "summitchronicles"
  },
  "records": {
    "CNAME": "summitchronicles.github.io"
  }
}
```

This is a one-time DNS migration. Future site updates require only a push to
`main`.

## Domain-Aware SEO

`astro.config.mjs` and `src/pages/robots.txt.ts` use `SITE_URL` when explicitly
set and otherwise default to `https://sunithkumar.is-a.dev`.
